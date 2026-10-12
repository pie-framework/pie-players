import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import type {
	ToolProviderDescriptor,
	ToolRegistry,
} from "../src/services/ToolRegistry.js";
import type { FrameworkErrorModel } from "../src/services/framework-error.js";
import type { ToolProviderApi } from "../src/services/tool-providers/ToolProviderApi.js";
import {
	createTestToolRegistration,
	createTestToolRegistry,
} from "./fixtures/test-tool-registry.js";

/**
 * Provider registration from registry descriptors: a descriptor that throws, and a
 * config change that selects a different implementation. A provider registers
 * under its tool's id, so a vendor switch replaces it in place.
 */

let warnSpy: ReturnType<typeof spyOn>;
const unhandled: unknown[] = [];
const onUnhandledRejection = (reason: unknown) => {
	unhandled.push(reason);
};

beforeEach(() => {
	unhandled.length = 0;
	process.on("unhandledRejection", onUnhandledRejection);
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	process.off("unhandledRejection", onUnhandledRejection);
});

const warnings = (): string[] =>
	warnSpy.mock.calls.map((args: unknown[]) => args.map(String).join(" "));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function stubProvider(implementation: string): ToolProviderApi {
	return {
		providerName: `Stub ${implementation} provider`,
		category: "calculator",
		version: "0.0.0",
		requiresAuth: false,
		initialize: async () => undefined,
		createInstance: async () => ({}),
		isReady: () => true,
		destroy: () => undefined,
	} as unknown as ToolProviderApi;
}

/** The coordinator's default providers plus a calculator carrying `provider`. */
function registryWithCalculator(
	provider: ToolProviderDescriptor,
): ToolRegistry {
	const registry = createTestToolRegistry([
		"textToSpeech",
		"annotationToolbar",
	]);
	registry.register(
		createTestToolRegistration({
			toolId: "calculator",
			supportedLevels: ["item"],
			provider,
		}),
	);
	return registry;
}

/** Selects its implementation from config the way the packaged calculator does. */
const idFromConfig: ToolProviderDescriptor = {
	createProvider: (config) =>
		stubProvider(config?.provider?.id ?? "calculator-alpha"),
};

describe("ToolkitCoordinator provider descriptors that throw", () => {
	const cases: Array<[string, ToolProviderDescriptor]> = [
		[
			"createProvider",
			{
				createProvider: () => {
					throw new Error("createProvider exploded");
				},
			},
		],
		[
			"getInitConfig",
			{
				createProvider: () => stubProvider("calculator-broken"),
				getInitConfig: () => {
					throw new Error("getInitConfig exploded");
				},
			},
		],
	];

	for (const [method, descriptor] of cases) {
		test(`a throwing ${method} is reported as a provider-register error`, async () => {
			const errors: FrameworkErrorModel[] = [];
			const coordinator = new ToolkitCoordinator({
				assessmentId: `throwing-${method}`,
				lazyInit: true,
				toolRegistry: registryWithCalculator(descriptor),
				hooks: { onFrameworkError: (model) => errors.push(model) },
			});
			await settle();

			expect(unhandled).toEqual([]);
			const failures = warnings().filter((line) =>
				line.includes("[ToolkitCoordinator] Failed to register"),
			);
			expect(failures).toHaveLength(1);
			expect(failures[0]).toContain(`${method} exploded`);
			expect(errors.map((model) => model.kind)).toEqual(["provider-register"]);
			expect(errors[0].message).toBe(`${method} exploded`);
			expect(coordinator.toolProviderRegistry.has("calculator")).toBe(false);
		});
	}
});

describe("ToolkitCoordinator provider replacement", () => {
	test("a config change that selects another implementation replaces the provider under the tool id", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-id-change",
			lazyInit: true,
			toolRegistry: registryWithCalculator(idFromConfig),
			tools: {
				providers: { calculator: { enabled: true } },
				placement: { item: ["calculator"] },
			},
		});
		expect(coordinator.toolProviderRegistry.getProviderIds()).toEqual([
			"calculator",
		]);
		const before = await coordinator.ensureProviderReady("calculator");
		expect(before.providerName).toBe("Stub calculator-alpha provider");

		coordinator.updateToolConfig("calculator", {
			provider: { id: "calculator-beta" },
		});

		// Replaced before `updateToolConfig` returns, so a check that runs on the
		// policy change it dispatches finds the new implementation.
		expect(coordinator.toolProviderRegistry.getProviderIds()).toEqual([
			"calculator",
		]);
		const after = await coordinator.ensureProviderReady("calculator");
		expect(after.providerName).toBe("Stub calculator-beta provider");
		expect(after).not.toBe(before);
		await settle();
		expect(unhandled).toEqual([]);
	});

	test("a change that keeps the implementation replaces the provider", async () => {
		const created: Array<{ initialized: unknown[]; destroyed: boolean }> = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-id-kept",
			lazyInit: true,
			toolRegistry: registryWithCalculator({
				...idFromConfig,
				createProvider: () => {
					const record = { initialized: [] as unknown[], destroyed: false };
					created.push(record);
					return {
						...stubProvider("calculator-alpha"),
						requiresAuth: true,
						initialize: async (config: unknown) => {
							record.initialized.push(config);
						},
						destroy: () => {
							record.destroyed = true;
						},
					} as unknown as ToolProviderApi;
				},
				getInitConfig: (config) => config?.provider?.init ?? {},
				getAuthFetcher: (config) => config?.provider?.runtime?.authFetcher,
			}),
			tools: {
				providers: {
					calculator: {
						provider: {
							init: { apiKey: "old" },
							runtime: { authFetcher: async () => ({ token: "old" }) },
						},
					},
				},
			},
		});
		await coordinator.ensureProviderReady("calculator");

		coordinator.updateToolConfig("calculator", {
			provider: {
				init: { apiKey: "new" },
				runtime: { authFetcher: async () => ({ token: "new" }) },
			},
		});
		await coordinator.ensureProviderReady("calculator");

		expect(created).toHaveLength(2);
		expect(created[0]?.destroyed).toBe(true);
		expect(created[1]?.initialized).toEqual([
			expect.objectContaining({ apiKey: "new", token: "new" }),
		]);
		expect(unhandled).toEqual([]);
	});

	test("a caller waiting on a start that a replacement interrupts gets the replacement", async () => {
		let releaseFirstStart: () => void = () => {};
		const providers: ToolProviderApi[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-replaced-during-start",
			lazyInit: true,
			toolRegistry: registryWithCalculator({
				...idFromConfig,
				createProvider: () => {
					const first = providers.length === 0;
					const provider = {
						...stubProvider("calculator-alpha"),
						initialize: () =>
							first
								? new Promise<void>((resolve) => {
										releaseFirstStart = resolve;
									})
								: Promise.resolve(),
					} as unknown as ToolProviderApi;
					providers.push(provider);
					return provider;
				},
			}),
			tools: { providers: { calculator: { enabled: true } } },
		});

		const started = coordinator.ensureProviderReady("calculator");
		await settle();
		coordinator.updateToolConfig("calculator", { settings: { mode: "basic" } });
		releaseFirstStart();

		expect(await started).toBe(providers[1]);
		expect(coordinator.toolProviderRegistry.isInitialized("calculator")).toBe(
			true,
		);
		expect(unhandled).toEqual([]);
	});
});
