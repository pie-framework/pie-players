/**
 * PIE-512 Phase D: bridge + coordinator integration.
 *
 * Pins the path that backs Darin's persistent-host wrapper:
 *
 *     bridge.resolveSectionController(A) → bridge.resolveSectionController(B)
 *
 * with a coordinator-side listener subscribed before A is ever active. Under
 * Phase D, the coordinator follows the bridge's active cohort across the
 * transition and replays B's snapshot to the subscribed listener.
 *
 * Uses a *real* `ToolkitCoordinator` (not a fake) so the integration of
 * `getOrCreateSectionController` / `disposeSectionController` /
 * `subscribeSectionEvents` is exercised end to end.
 */

import { describe, expect, test } from "bun:test";

import {
	createCoordinatorBridge,
	type CoordinatorPort,
} from "../../../src/runtime/adapter/coordinator-bridge.js";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import type { SectionEngineInput } from "../../../src/runtime/core/engine-input.js";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../../../src/index.js";

type ControllerHarness = {
	handle: SectionControllerHandle;
	emit: (event: SectionControllerEvent) => void;
};

function createTestController(
	runtimeState?: SectionControllerRuntimeState | null,
): ControllerHarness {
	const listeners = new Set<(event: SectionControllerEvent) => void>();
	const handle: SectionControllerHandle = {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getRuntimeState() {
			return runtimeState ?? null;
		},
		getSession() {
			return { itemSessions: {} };
		},
	};
	return {
		handle,
		emit(event) {
			for (const listener of Array.from(listeners)) {
				listener(event);
			}
		},
	};
}

function loadedRuntimeState(args: {
	sectionId: string;
	itemIdentifiers: string[];
}): SectionControllerRuntimeState {
	return {
		sectionId: args.sectionId,
		currentItemIndex: 0,
		currentItemId: args.itemIdentifiers[0] ?? "",
		itemIdentifiers: args.itemIdentifiers,
		visitedItemIdentifiers: args.itemIdentifiers,
		itemSessions: {},
		loadingComplete: true,
		totalRegistered: args.itemIdentifiers.length,
		totalLoaded: args.itemIdentifiers.length,
		itemsComplete: false,
		completedCount: 0,
		totalItems: args.itemIdentifiers.length,
		loadedRenderables: args.itemIdentifiers.map((itemId) => ({
			itemId,
			canonicalItemId: itemId,
			contentKind: "item" as const,
		})),
	};
}

function bridgePortFor(coordinator: ToolkitCoordinator): CoordinatorPort {
	return {
		subscribeFrameworkErrors: (listener) =>
			coordinator.subscribeFrameworkErrors(listener),
		getOrCreateSectionController: (args) =>
			coordinator.getOrCreateSectionController(args),
		disposeSectionController: (args) =>
			coordinator.disposeSectionController(args),
	};
}

const ATTEMPT_ID = "attempt-bridge-handoff";

const COHORT_A: CohortKey = {
	sectionId: "section-A",
	attemptId: ATTEMPT_ID,
};
const COHORT_B: CohortKey = {
	sectionId: "section-B",
	attemptId: ATTEMPT_ID,
};

describe("PIE-512 Phase D: coordinator-bridge cohort handoff", () => {
	test("resolveSectionController(A) -> resolveSectionController(B) migrates a coordinator-bound listener with replay", async () => {
		const controllerA = createTestController(
			loadedRuntimeState({
				sectionId: COHORT_A.sectionId,
				itemIdentifiers: ["item-a-1"],
			}),
		);
		const controllerB = createTestController(
			loadedRuntimeState({
				sectionId: COHORT_B.sectionId,
				itemIdentifiers: ["item-b-1", "item-b-2"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-bridge-handoff",
			lazyInit: true,
		});
		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: bridgePortFor(coordinator),
			dispatchCoreInput: (input) => inputs.push(input),
		});

		await bridge.resolveSectionController({
			cohort: COHORT_A,
			assessmentId: "phase-d-bridge-handoff",
			view: "student",
			section: { id: COHORT_A.sectionId },
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeSectionEvents({
			eventTypes: ["content-loaded", "section-loading-complete"],
			listener: (event) => received.push(event),
		});

		// Subscribe-time replay sees A's snapshot.
		expect(received.map((event) => event.type)).toEqual([
			"content-loaded",
			"section-loading-complete",
		]);
		const aReplay = received.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(aReplay.map((event) => event.itemId)).toEqual(["item-a-1"]);

		const beforeMigration = received.length;

		await bridge.resolveSectionController({
			cohort: COHORT_B,
			assessmentId: "phase-d-bridge-handoff",
			view: "student",
			section: { id: COHORT_B.sectionId },
			createDefaultController: () => controllerB.handle,
		});

		// Migration to B replays B's snapshot in canonical order; A's replay
		// is not repeated and stale events on A's handle do not reach the
		// listener.
		controllerA.emit({
			type: "content-loaded",
			contentKind: "item",
			itemId: "stale-from-a",
			canonicalItemId: "stale-from-a",
			currentItemIndex: 0,
			timestamp: Date.now(),
		});

		const afterMigration = received.slice(beforeMigration);
		expect(afterMigration.map((event) => event.type)).toEqual([
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
		const bReplay = afterMigration.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(bReplay.map((event) => event.itemId)).toEqual([
			"item-b-1",
			"item-b-2",
		]);

		// Live emit on the active cohort (B) reaches the listener.
		controllerB.emit({
			type: "content-loaded",
			contentKind: "item",
			itemId: "live-from-b",
			canonicalItemId: "live-from-b",
			currentItemIndex: 0,
			timestamp: Date.now(),
		});
		expect(received[received.length - 1]).toMatchObject({
			type: "content-loaded",
			itemId: "live-from-b",
		});

		await bridge.dispose();
	});

	test("bridge.dispose() detaches coordinator-bound listeners from the disposed cohort", async () => {
		const controllerA = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-bridge-dispose-detaches",
			lazyInit: true,
		});
		const bridge = createCoordinatorBridge({
			coordinator: bridgePortFor(coordinator),
			dispatchCoreInput: () => {},
		});

		await bridge.resolveSectionController({
			cohort: COHORT_A,
			assessmentId: "phase-d-bridge-dispose-detaches",
			view: "student",
			section: { id: COHORT_A.sectionId },
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		controllerA.emit({
			type: "item-selected",
			previousItemId: "before-dispose",
			currentItemId: "before-dispose",
			itemIndex: 0,
			totalItems: 1,
			currentItemIndex: 0,
			timestamp: Date.now(),
		});
		expect(received).toHaveLength(1);

		await bridge.dispose();

		// After bridge.dispose(), the coordinator's active cohort is cleared
		// and the bound listener no longer receives events from the
		// disposed controller.
		controllerA.emit({
			type: "item-selected",
			previousItemId: "after-dispose",
			currentItemId: "after-dispose",
			itemIndex: 0,
			totalItems: 1,
			currentItemIndex: 0,
			timestamp: Date.now(),
		});
		expect(received).toHaveLength(1);
	});

	test("bridge token rollover: a stale getOrCreateSectionController resolution does not dispatch section-controller-resolved", async () => {
		// Pins the existing bridge invariant: when a more recent
		// `resolveSectionController` rolls the bridge's init token
		// forward, a stale `getOrCreateSectionController` promise that
		// resolves later must not dispatch `section-controller-resolved`
		// to the core. Phase D's coordinator-side active-cohort tracking
		// is layered on top of this and does not interfere with the
		// bridge's own discipline.
		//
		// In production the bridge is driven by the engine state machine,
		// which never issues concurrent resolves for different cohorts —
		// so the *coordinator's* active-cohort pointer can safely follow
		// the most-recently-finalized controller. This test deliberately
		// scopes its assertion to the bridge's core-input dispatch only.
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-bridge-token-rollover",
			lazyInit: true,
		});
		let firstCallCapturedResolver: ((value: void) => void) | null = null;
		const releaseFirstCall = new Promise<void>((resolve) => {
			firstCallCapturedResolver = resolve;
		});

		let firstCall = true;
		const port: CoordinatorPort = {
			subscribeFrameworkErrors: (listener) =>
				coordinator.subscribeFrameworkErrors(listener),
			getOrCreateSectionController: async (args) => {
				if (firstCall) {
					firstCall = false;
					await releaseFirstCall;
				}
				return coordinator.getOrCreateSectionController(args);
			},
			disposeSectionController: (args) =>
				coordinator.disposeSectionController(args),
		};

		const inputs: SectionEngineInput[] = [];
		const bridge = createCoordinatorBridge({
			coordinator: port,
			dispatchCoreInput: (input) => inputs.push(input),
		});

		const firstResolve = bridge.resolveSectionController({
			cohort: COHORT_A,
			assessmentId: "phase-d-bridge-token-rollover",
			view: "student",
			section: { id: COHORT_A.sectionId },
			createDefaultController: () => controllerA.handle,
		});

		// Roll the token forward before the first call resolves.
		const secondResolve = bridge.resolveSectionController({
			cohort: COHORT_B,
			assessmentId: "phase-d-bridge-token-rollover",
			view: "student",
			section: { id: COHORT_B.sectionId },
			createDefaultController: () => controllerB.handle,
		});

		firstCallCapturedResolver?.();
		await Promise.all([firstResolve, secondResolve]);

		// Exactly one `section-controller-resolved` was dispatched — the
		// one for B. A's stale resolution was caught by the bridge's
		// token mismatch and dropped silently.
		const resolveDispatches = inputs.filter(
			(input) => input.kind === "section-controller-resolved",
		);
		expect(resolveDispatches).toHaveLength(1);

		await bridge.dispose();
	});
});
