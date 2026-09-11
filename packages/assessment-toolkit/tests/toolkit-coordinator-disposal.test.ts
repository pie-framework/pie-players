import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerHandle,
	ToolRegistry,
	type ToolRegistration,
} from "../src/index.js";
import { FrameworkErrorBus } from "../src/services/framework-error-bus.js";

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function controller(
	overrides: Partial<SectionControllerHandle> = {},
): SectionControllerHandle {
	return {
		getSession: () => ({ itemSessions: {} }),
		...overrides,
	};
}

describe("ToolkitCoordinator disposal", () => {
	test("reacquiring a cohort during delayed disposal creates and retains a replacement", async () => {
		const persistGate = deferred();
		const persistStarted = deferred();
		let oldDisposeCount = 0;
		let replacementDisposeCount = 0;
		let durableState = "stale";
		let replacementHydratedState: string | null = null;
		const oldController = controller({
			async persist() {
				persistStarted.resolve();
				await persistGate.promise;
				durableState = "fresh";
			},
			dispose() {
				oldDisposeCount += 1;
			},
		});
		const replacementController = controller({
			hydrate() {
				replacementHydratedState = durableState;
			},
			dispose() {
				replacementDisposeCount += 1;
			},
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "delayed-disposal-reacquire",
			lazyInit: true,
		});
		const lifecycle: string[] = [];
		coordinator.onSectionControllerLifecycle((event) => {
			lifecycle.push(event.type);
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			attemptId: "attempt-1",
			createDefaultController: () => oldController,
		});

		const disposal = coordinator.disposeSectionController({
			sectionId: "section-a",
			attemptId: "attempt-1",
		});
		await persistStarted.promise;

		let replacementFactoryCalls = 0;
		const reacquisition = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			attemptId: "attempt-1",
			createDefaultController: () => {
				replacementFactoryCalls += 1;
				return replacementController;
			},
		});
		await Promise.resolve();
		expect(replacementFactoryCalls).toBe(0);

		persistGate.resolve();
		const [reacquired] = await Promise.all([reacquisition, disposal]);

		expect(reacquired).toBe(replacementController);
		expect(replacementFactoryCalls).toBe(1);
		expect(replacementHydratedState).toBe("fresh");
		expect(oldDisposeCount).toBe(1);
		expect(
			coordinator.getSectionController({
				sectionId: "section-a",
				attemptId: "attempt-1",
			}),
		).toBe(replacementController);
		expect(lifecycle).toEqual(["ready", "disposed", "ready"]);

		await coordinator.dispose();
		expect(replacementDisposeCount).toBe(1);
	});

	test("disposing a key during its factory retires that admission and gates a replacement", async () => {
		const factoryStarted = deferred();
		const factoryGate = deferred();
		let retiredDisposeCount = 0;
		let replacementFactoryCalls = 0;
		let replacementDisposeCount = 0;
		const retiredController = controller({
			dispose() {
				retiredDisposeCount += 1;
			},
		});
		const replacementController = controller({
			dispose() {
				replacementDisposeCount += 1;
			},
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "factory-retirement",
			lazyInit: true,
		});
		const lifecycle: string[] = [];
		const frameworkErrorKinds: string[] = [];
		coordinator.onSectionControllerLifecycle((event) => {
			lifecycle.push(event.type);
		});
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});

		const firstAcquisition = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: async () => {
				factoryStarted.resolve();
				await factoryGate.promise;
				return retiredController;
			},
		});
		const firstResult = firstAcquisition.then(
			() => null,
			(error: unknown) => error,
		);
		await factoryStarted.promise;

		const sectionDisposal = coordinator.disposeSectionController({
			sectionId: "section-a",
		});
		const replacementAcquisition = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: () => {
				replacementFactoryCalls += 1;
				return replacementController;
			},
		});
		await Promise.resolve();
		expect(replacementFactoryCalls).toBe(0);

		factoryGate.resolve();
		const [firstError, , replacement] = await Promise.all([
			firstResult,
			sectionDisposal,
			replacementAcquisition,
		]);

		expect(firstError).toBeInstanceOf(Error);
		expect((firstError as Error).message).toMatch(/retired/i);
		expect(retiredDisposeCount).toBe(1);
		expect(replacementFactoryCalls).toBe(1);
		expect(replacement).toBe(replacementController);
		expect(coordinator.getSectionController({ sectionId: "section-a" })).toBe(
			replacementController,
		);
		expect(lifecycle).toEqual(["ready"]);
		expect(frameworkErrorKinds).toEqual([]);

		await coordinator.dispose();
		expect(replacementDisposeCount).toBe(1);
	});

	test("an initialization rejection after retirement still cleans the unpublished candidate", async () => {
		const initializeStarted = deferred();
		let rejectInitialize!: (reason: Error) => void;
		const initializeGate = new Promise<void>((_resolve, reject) => {
			rejectInitialize = reject;
		});
		let controllerDisposeCount = 0;
		const candidate = controller({
			async initialize() {
				initializeStarted.resolve();
				await initializeGate;
			},
			dispose() {
				controllerDisposeCount += 1;
				throw new Error("candidate cleanup failed");
			},
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "initialize-rejection-retirement",
			lazyInit: true,
		});
		const frameworkErrors: Array<{ kind: string; message: string }> = [];
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrors.push({ kind: model.kind, message: model.message });
		});

		const acquisition = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: () => candidate,
		});
		const acquisitionResult = acquisition.then(
			() => null,
			(error: unknown) => error,
		);
		await initializeStarted.promise;

		const sectionDisposal = coordinator.disposeSectionController({
			sectionId: "section-a",
		});
		rejectInitialize(new Error("initialize failed"));
		const [acquisitionError] = await Promise.all([
			acquisitionResult,
			sectionDisposal,
		]);

		expect(acquisitionError).toBeInstanceOf(Error);
		expect((acquisitionError as Error).message).toBe("initialize failed");
		expect(controllerDisposeCount).toBe(1);
		expect(
			coordinator.getSectionController({ sectionId: "section-a" }),
		).toBeUndefined();
		expect(frameworkErrors).toEqual([
			{
				kind: "section-controller-dispose",
				message: "candidate cleanup failed",
			},
			{ kind: "section-controller-init", message: "initialize failed" },
		]);

		await coordinator.dispose();
		expect(controllerDisposeCount).toBe(1);
	});

	test("disposing a ready controller during its init hook rejects the original acquisition", async () => {
		const readyHookStarted = deferred();
		const readyHookGate = deferred();
		let controllerDisposeCount = 0;
		const candidate = controller({
			dispose() {
				controllerDisposeCount += 1;
			},
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "ready-hook-retirement",
			lazyInit: true,
			hooks: {
				async onSectionControllerReady() {
					readyHookStarted.resolve();
					await readyHookGate.promise;
				},
			},
		});
		const lifecycle: string[] = [];
		const frameworkErrorKinds: string[] = [];
		coordinator.onSectionControllerLifecycle((event) => {
			lifecycle.push(event.type);
		});
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});

		const acquisition = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: () => candidate,
		});
		const acquisitionResult = acquisition.then(
			() => null,
			(error: unknown) => error,
		);
		await readyHookStarted.promise;
		expect(coordinator.getSectionController({ sectionId: "section-a" })).toBe(
			candidate,
		);

		const sectionDisposal = coordinator.disposeSectionController({
			sectionId: "section-a",
		});
		readyHookGate.resolve();
		const [acquisitionError] = await Promise.all([
			acquisitionResult,
			sectionDisposal,
		]);

		expect(acquisitionError).toBeInstanceOf(Error);
		expect((acquisitionError as Error).message).toMatch(/retired/i);
		expect(controllerDisposeCount).toBe(1);
		expect(
			coordinator.getSectionController({ sectionId: "section-a" }),
		).toBeUndefined();
		expect(lifecycle).toEqual(["ready", "disposed"]);
		expect(frameworkErrorKinds).toEqual([]);

		await coordinator.dispose();
		expect(controllerDisposeCount).toBe(1);
	});

	test("a persistence failure does not skip controller disposal", async () => {
		let controllerDisposeCount = 0;
		const frameworkErrorKinds: string[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "persistence-failure-cleanup",
			lazyInit: true,
		});
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: () =>
				controller({
					persist() {
						throw new Error("storage unavailable");
					},
					dispose() {
						controllerDisposeCount += 1;
					},
				}),
		});

		await coordinator.disposeSectionController({ sectionId: "section-a" });

		expect(controllerDisposeCount).toBe(1);
		expect(frameworkErrorKinds).toEqual(["section-controller-dispose"]);
		expect(
			coordinator.getSectionController({ sectionId: "section-a" }),
		).toBeUndefined();
		await coordinator.dispose();
	});

	test("dispose is idempotent and releases coordinator-owned services", async () => {
		let controllerDisposeCount = 0;
		let providerDestroyCount = 0;
		let highlightDestroyCount = 0;
		const coordinator = new ToolkitCoordinator({
			assessmentId: "aggregate-disposal",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: () =>
				controller({
					dispose() {
						controllerDisposeCount += 1;
					},
				}),
		});
		coordinator.toolProviderRegistry.register("owned-provider", {
			provider: {
				providerId: "owned-provider",
				providerName: "Owned provider",
				category: "other",
				version: "1",
				requiresAuth: false,
				initialize: async () => {},
				createInstance: async () => ({}),
				getCapabilities: () => ({
					supportsOffline: true,
					requiresAuth: false,
					features: {},
				}),
				isReady: () => true,
				destroy() {
					providerDestroyCount += 1;
				},
			},
			config: {},
			lazy: true,
		});
		coordinator.toolCoordinator.registerTool("floating", "Floating");
		coordinator.registerToolRequestTarget({
			level: "section",
			hostsTool: () => true,
			open: () => {},
		});

		const originalHighlightDestroy =
			coordinator.highlightCoordinator.destroy.bind(
				coordinator.highlightCoordinator,
			);
		coordinator.highlightCoordinator.destroy = () => {
			highlightDestroyCount += 1;
			originalHighlightDestroy();
		};
		const policyReasons: string[] = [];
		coordinator.onPolicyChange((event) => policyReasons.push(event.reason));

		const firstDispose = coordinator.dispose();
		const secondDispose = coordinator.dispose();
		expect(secondDispose).toBe(firstDispose);
		await firstDispose;

		expect(controllerDisposeCount).toBe(1);
		expect(providerDestroyCount).toBe(1);
		expect(highlightDestroyCount).toBe(1);
		expect(coordinator.toolProviderRegistry.has("owned-provider")).toBe(false);
		expect(coordinator.toolCoordinator.getRegisteredTools()).toEqual([]);
		expect(coordinator.canRequestTool("anything")).toBe(false);
		expect(policyReasons).toEqual(["disposed"]);
		await expect(
			coordinator.getOrCreateSectionController({
				sectionId: "after-disposal",
				createDefaultController: () => controller(),
			}),
		).rejects.toThrow(/disposed/i);
	});

	test("dispose waits for admitted readiness and suppresses late ready callbacks", async () => {
		const ttsInitStarted = deferred();
		const ttsInitGate = deferred();
		let ttsReadyCount = 0;
		let coordinatorReadyCount = 0;
		const frameworkErrorKinds: string[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pending-readiness-disposal",
			lazyInit: true,
			hooks: {
				async onBeforeTTSInit() {
					ttsInitStarted.resolve();
					await ttsInitGate.promise;
				},
				onTTSReady() {
					ttsReadyCount += 1;
				},
				onCoordinatorReady() {
					coordinatorReadyCount += 1;
				},
			},
		});
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});
		const readiness = coordinator.waitUntilReady();
		const readinessResult = readiness.then(
			() => null,
			(error: unknown) => error,
		);
		await ttsInitStarted.promise;

		let disposalSettled = false;
		const disposal = coordinator.dispose().then(() => {
			disposalSettled = true;
		});
		await Promise.resolve();
		expect(disposalSettled).toBe(false);

		ttsInitGate.resolve();
		const [readinessError] = await Promise.all([readinessResult, disposal]);

		expect(readinessError).toBeInstanceOf(Error);
		expect((readinessError as Error).message).toMatch(/disposed/i);
		expect(ttsReadyCount).toBe(0);
		expect(coordinatorReadyCount).toBe(0);
		expect(frameworkErrorKinds).toEqual([]);
	});

	test("dispose waits for admitted provider initialization before destroying it", async () => {
		const providerInitStarted = deferred();
		const providerInitGate = deferred();
		let providerReadyCount = 0;
		let providerDestroyCount = 0;
		const frameworkErrorKinds: string[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pending-provider-disposal",
			lazyInit: true,
			hooks: {
				onProviderReady() {
					providerReadyCount += 1;
				},
			},
		});
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});
		coordinator.toolProviderRegistry.register("slow-provider", {
			provider: {
				providerId: "slow-provider",
				providerName: "Slow provider",
				category: "other",
				version: "1",
				requiresAuth: false,
				async initialize() {
					providerInitStarted.resolve();
					await providerInitGate.promise;
				},
				createInstance: async () => ({}),
				getCapabilities: () => ({
					supportsOffline: true,
					requiresAuth: false,
					features: {},
				}),
				isReady: () => false,
				destroy() {
					providerDestroyCount += 1;
				},
			},
			config: {},
			lazy: true,
		});
		const provider = coordinator.ensureProviderReady("slow-provider");
		const providerResult = provider.then(
			() => null,
			(error: unknown) => error,
		);
		await providerInitStarted.promise;

		let disposalSettled = false;
		const disposal = coordinator.dispose().then(() => {
			disposalSettled = true;
		});
		await Promise.resolve();
		expect(disposalSettled).toBe(false);

		providerInitGate.resolve();
		const [providerError] = await Promise.all([providerResult, disposal]);

		expect(providerError).toBeInstanceOf(Error);
		expect((providerError as Error).message).toMatch(/disposed/i);
		expect(providerReadyCount).toBe(0);
		expect(providerDestroyCount).toBe(1);
		expect(frameworkErrorKinds).toEqual([]);
	});

	test("dispose waits for and releases a controller whose initialization is in flight", async () => {
		const factoryStarted = deferred();
		const factoryGate = deferred();
		let controllerDisposeCount = 0;
		const pendingController = controller({
			dispose() {
				controllerDisposeCount += 1;
			},
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pending-controller-disposal",
			lazyInit: true,
		});
		const frameworkErrorKinds: string[] = [];
		coordinator.subscribeFrameworkErrors((model) => {
			frameworkErrorKinds.push(model.kind);
		});
		const initialization = coordinator.getOrCreateSectionController({
			sectionId: "section-a",
			createDefaultController: async () => {
				factoryStarted.resolve();
				await factoryGate.promise;
				return pendingController;
			},
		});
		await factoryStarted.promise;

		const disposal = coordinator.dispose();
		const acquisition = initialization.then(
			() => null,
			(error: unknown) => error,
		);
		factoryGate.resolve();
		const [acquisitionError] = await Promise.all([acquisition, disposal]);

		expect(acquisitionError).toBeInstanceOf(Error);
		expect((acquisitionError as Error).message).toMatch(/disposed/i);
		expect(controllerDisposeCount).toBe(1);
		expect(frameworkErrorKinds).toEqual([]);
		expect(
			coordinator.getSectionController({ sectionId: "section-a" }),
		).toBeUndefined();
	});

	test("dispose detaches from but does not dispose borrowed host resources", async () => {
		const bus = new FrameworkErrorBus();
		const toolRegistry = new ToolRegistry();
		toolRegistry.register({
			toolId: "host-tool",
			name: "Host tool",
			description: "Owned by the host",
			icon: "host-tool",
			supportedLevels: ["section"],
			activation: "toolbar-toggle",
			pnpSupportIds: [],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
		} as ToolRegistration);
		const unsubscribeExternal = bus.subscribeFrameworkErrors(() => {});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "borrowed-error-bus",
			lazyInit: true,
			frameworkErrorBus: bus,
			toolRegistry,
		});
		expect(bus.getListenerCount()).toBe(2);

		await coordinator.dispose();

		expect(bus.getListenerCount()).toBe(1);
		expect(toolRegistry.has("host-tool")).toBe(true);
		unsubscribeExternal();
		expect(bus.getListenerCount()).toBe(0);
	});
});
