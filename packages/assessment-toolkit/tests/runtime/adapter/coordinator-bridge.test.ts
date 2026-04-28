/**
 * Coordinator bridge tests (M7 PR 2).
 *
 * Asserts:
 *   - Framework errors emitted by the coordinator's bus translate into
 *     `{ kind: "framework-error" }` core inputs (one per emit), with
 *     listener isolation matching `FrameworkErrorBus`.
 *   - `resolveSectionController(...)` calls the coordinator's
 *     `getOrCreateSectionController(...)` with the correct args and
 *     dispatches `{ kind: "section-controller-resolved" }` after
 *     resolution.
 *   - Late resolutions are dropped after a more recent
 *     `resolveSectionController` call rolls the init token forward
 *     (mirrors `SectionRuntimeEngine.initialize`'s `activeInitToken`
 *     pattern).
 *   - `dispose()` is idempotent, unsubscribes from the bus, and calls
 *     `coordinator.disposeSectionController(...)` for the active
 *     cohort.
 *   - Controller `subscribe(listener)` events drive the optional
 *     `onCompositionChanged` callback.
 */

import { describe, expect, mock, test } from "bun:test";

import {
	createCoordinatorBridge,
	type CoordinatorPort,
} from "../../../src/runtime/adapter/coordinator-bridge.js";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import type { SectionEngineInput } from "../../../src/runtime/core/engine-input.js";
import type { FrameworkErrorModel } from "../../../src/services/framework-error.js";
import type {
	SectionControllerEvent,
	SectionControllerHandle,
} from "../../../src/services/section-controller-types.js";

interface FakeCoordinator extends CoordinatorPort {
	emitFrameworkError(model: FrameworkErrorModel): void;
	resolveControllerOnce(controller: SectionControllerHandle): void;
	resolveControllerWithDelay(args: {
		controller: SectionControllerHandle;
		signal: Promise<void>;
	}): void;
	disposeCalls: { sectionId: string; attemptId?: string }[];
	getOrCreateCalls: Parameters<
		CoordinatorPort["getOrCreateSectionController"]
	>[0][];
	listenerCount(): number;
}

function createFakeCoordinator(): FakeCoordinator {
	const listeners = new Set<(model: FrameworkErrorModel) => void>();
	let pendingResolve: ((controller: SectionControllerHandle) => void) | null =
		null;
	const disposeCalls: { sectionId: string; attemptId?: string }[] = [];
	const getOrCreateCalls: Parameters<
		CoordinatorPort["getOrCreateSectionController"]
	>[0][] = [];

	return {
		subscribeFrameworkErrors(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async getOrCreateSectionController(args) {
			getOrCreateCalls.push(args);
			return new Promise<SectionControllerHandle>((resolve) => {
				pendingResolve = resolve;
			});
		},
		async disposeSectionController(args) {
			disposeCalls.push(args);
		},
		emitFrameworkError(model) {
			for (const listener of Array.from(listeners)) {
				listener(model);
			}
		},
		resolveControllerOnce(controller) {
			pendingResolve?.(controller);
			pendingResolve = null;
		},
		resolveControllerWithDelay({ controller, signal }) {
			signal.then(() => {
				pendingResolve?.(controller);
				pendingResolve = null;
			});
		},
		disposeCalls,
		getOrCreateCalls,
		listenerCount() {
			return listeners.size;
		},
	};
}

function makeController(
	overrides?: Partial<SectionControllerHandle> & {
		subscribers?: Set<(event: SectionControllerEvent) => void>;
		getCompositionModel?: () => unknown;
	},
): SectionControllerHandle & {
	getCompositionModel?: () => unknown;
	__subscribers: Set<(event: SectionControllerEvent) => void>;
} {
	const subscribers = overrides?.subscribers ?? new Set();
	return {
		subscribe(listener) {
			subscribers.add(listener);
			return () => {
				subscribers.delete(listener);
			};
		},
		getCompositionModel:
			overrides?.getCompositionModel ?? (() => "composition-1"),
		__subscribers: subscribers,
		...overrides,
	} as SectionControllerHandle & {
		getCompositionModel?: () => unknown;
		__subscribers: Set<(event: SectionControllerEvent) => void>;
	};
}

const COHORT: CohortKey = { sectionId: "section-A", attemptId: "attempt-1" };

describe("coordinator-bridge", () => {
	test("framework errors from the coordinator translate into core inputs", () => {
		const fake = createFakeCoordinator();
		const inputs: SectionEngineInput[] = [];
		createCoordinatorBridge({
			coordinator: fake,
			dispatchCoreInput: (input) => inputs.push(input),
		});

		const model: FrameworkErrorModel = {
			kind: "tool-config",
			severity: "error",
			source: "test",
			message: "boom",
			details: [],
			recoverable: false,
		};
		fake.emitFrameworkError(model);

		expect(inputs).toEqual([{ kind: "framework-error", error: model }]);
	});

	test("a throwing dispatchCoreInput does not break later framework-error fan-out", () => {
		const fake = createFakeCoordinator();
		let callCount = 0;
		const consoleWarn = console.warn;
		console.warn = (() => {}) as typeof console.warn;
		try {
			createCoordinatorBridge({
				coordinator: fake,
				dispatchCoreInput: () => {
					callCount += 1;
					if (callCount === 1) throw new Error("boom");
				},
			});
			fake.emitFrameworkError({
				kind: "tool-config",
				severity: "error",
				source: "test",
				message: "first",
				details: [],
				recoverable: false,
			});
			fake.emitFrameworkError({
				kind: "tool-config",
				severity: "error",
				source: "test",
				message: "second",
				details: [],
				recoverable: false,
			});
			expect(callCount).toBe(2);
		} finally {
			console.warn = consoleWarn;
		}
	});

	test("resolveSectionController dispatches section-controller-resolved after the controller resolves", async () => {
		const fake = createFakeCoordinator();
		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: fake,
			dispatchCoreInput: (input) => inputs.push(input),
		});

		const controller = makeController();
		const onComposition = mock(() => {});
		const onResolved = mock(() => {});
		const pending = bridge.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => controller,
			onCompositionChanged: onComposition,
			onControllerResolved: onResolved,
		});

		expect(fake.getOrCreateCalls).toHaveLength(1);
		expect(fake.getOrCreateCalls[0]).toMatchObject({
			sectionId: "section-A",
			attemptId: "attempt-1",
			updateExisting: true,
		});

		fake.resolveControllerOnce(controller);
		await pending;

		expect(inputs).toEqual([{ kind: "section-controller-resolved" }]);
		expect(onResolved).toHaveBeenCalledTimes(1);
		expect(onComposition).toHaveBeenCalledWith("composition-1");
	});

	test("late controller resolution is dropped after dispose", async () => {
		const fake = createFakeCoordinator();
		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: fake,
			dispatchCoreInput: (input) => inputs.push(input),
		});

		const controller = makeController();
		const pending = bridge.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => controller,
		});

		await bridge.dispose();
		fake.resolveControllerOnce(controller);
		await pending;

		expect(inputs).not.toContainEqual({ kind: "section-controller-resolved" });
	});

	test("controller subscribe events trigger onCompositionChanged", async () => {
		const fake = createFakeCoordinator();
		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: fake,
			dispatchCoreInput: (input) => inputs.push(input),
		});

		let composition = "composition-1";
		const subscribers = new Set<(event: SectionControllerEvent) => void>();
		const controller = makeController({
			subscribers,
			getCompositionModel: () => composition,
		});
		const onComposition = mock(() => {});

		const pending = bridge.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => controller,
			onCompositionChanged: onComposition,
		});
		fake.resolveControllerOnce(controller);
		await pending;

		expect(onComposition).toHaveBeenCalledWith("composition-1");

		composition = "composition-2";
		for (const sub of subscribers) {
			sub({
				type: "item-selected",
				timestamp: 0,
				previousItemId: "",
				currentItemId: "x",
				itemIndex: 0,
				totalItems: 1,
				currentItemIndex: 0,
			} as SectionControllerEvent);
		}
		expect(onComposition).toHaveBeenCalledWith("composition-2");
	});

	test("dispose unsubscribes from the bus and disposes the active section controller", async () => {
		const fake = createFakeCoordinator();
		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: fake,
			dispatchCoreInput: (input) => inputs.push(input),
		});
		expect(fake.listenerCount()).toBe(1);

		const controller = makeController();
		const pending = bridge.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => controller,
		});
		fake.resolveControllerOnce(controller);
		await pending;

		await bridge.dispose();

		expect(fake.listenerCount()).toBe(0);
		expect(fake.disposeCalls).toEqual([
			{ sectionId: "section-A", attemptId: "attempt-1" },
		]);

		// dispose is idempotent
		await bridge.dispose();
		expect(fake.disposeCalls).toHaveLength(1);
	});
});
