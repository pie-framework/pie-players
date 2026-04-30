import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../src/index.js";

/**
 * PIE-512 regression contract pin.
 *
 * Reproduces the consumer-observable failure where, after navigating from
 * cohort A (passage + 1 item) to cohort B (3 items, no passage), the
 * `content-loaded` and `section-loading-complete` deliveries no longer
 * reach `coordinator.subscribeItemEvents` /
 * `coordinator.subscribeSectionLifecycleEvents`.
 *
 * These tests use the synthetic-controller harness from
 * `toolkit-coordinator-section-events.test.ts` so they pin the coordinator
 * contract precisely, without depending on the section-player runtime.
 */

type ControllerHarness = {
	handle: SectionControllerHandle;
	emit: (event: SectionControllerEvent) => void;
	dispose: () => void;
};

function createTestController(
	runtimeState?: SectionControllerRuntimeState | null,
): ControllerHarness {
	const listeners = new Set<(event: SectionControllerEvent) => void>();
	let currentRuntimeState: SectionControllerRuntimeState | null =
		runtimeState ?? null;
	const handle: SectionControllerHandle = {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getRuntimeState() {
			return currentRuntimeState;
		},
		getSession() {
			return { itemSessions: {} };
		},
		dispose() {
			listeners.clear();
			currentRuntimeState = null;
		},
	};

	return {
		handle,
		emit(event: SectionControllerEvent) {
			for (const listener of listeners) {
				listener(event);
			}
		},
		dispose() {
			listeners.clear();
			currentRuntimeState = null;
		},
	};
}

function contentLoadedEvent(itemId: string): SectionControllerEvent {
	return {
		type: "content-loaded",
		contentKind: "item",
		itemId,
		canonicalItemId: itemId,
		currentItemIndex: 0,
		timestamp: Date.now(),
	};
}

function sectionLoadingCompleteEvent(
	totalRegistered: number,
	totalLoaded: number,
): SectionControllerEvent {
	return {
		type: "section-loading-complete",
		totalRegistered,
		totalLoaded,
		currentItemIndex: 0,
		timestamp: Date.now(),
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
		// Mirror what the production `SectionController.getRuntimeState` now
		// reports: a per-renderable snapshot the coordinator uses to replay
		// `content-loaded` events to subscribers attaching after a renderable
		// has loaded.
		loadedRenderables: args.itemIdentifiers.map((itemId) => ({
			itemId,
			canonicalItemId: itemId,
			contentKind: "item" as const,
		})),
	};
}

const ATTEMPT_ID = "pie-512-attempt-1";

describe("PIE-512 cross-section event delivery", () => {
	test("live delivery survives a cohort flip A -> B", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pie-512-a-to-b",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const receivedA: SectionControllerEvent[] = [];
		const unsubscribeAItems = coordinator.subscribeItemEvents({
			eventTypes: ["content-loaded"],
			listener: (event) => receivedA.push(event),
		});
		const unsubscribeASection = coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => receivedA.push(event),
		});

		controllerA.emit(contentLoadedEvent("pie-512-a-q1"));
		controllerA.emit(sectionLoadingCompleteEvent(1, 1));

		expect(
			receivedA.some((event) => event.type === "content-loaded"),
		).toBe(true);
		expect(
			receivedA.some((event) => event.type === "section-loading-complete"),
		).toBe(true);

		unsubscribeAItems();
		unsubscribeASection();
		await coordinator.disposeSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			persistBeforeDispose: false,
			clearPersistence: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-b",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		const receivedB: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["content-loaded"],
			listener: (event) => receivedB.push(event),
		});
		coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => receivedB.push(event),
		});

		controllerB.emit(contentLoadedEvent("pie-512-b-q1"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q2"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q3"));
		controllerB.emit(sectionLoadingCompleteEvent(3, 3));

		// Pin both COUNT and ORDER so a regression that emits only the first
		// item, drops events, or reorders content-loaded vs.
		// section-loading-complete fails the assertion. `>= 1` masked this
		// previously.
		const typesForB = receivedB.map((event) => event.type);
		expect(typesForB).toEqual([
			"content-loaded",
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
		const contentLoadedForB = receivedB.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(contentLoadedForB.map((event) => event.itemId)).toEqual([
			"pie-512-b-q1",
			"pie-512-b-q2",
			"pie-512-b-q3",
		]);
	});

	test("A -> B -> A delivers events on the second visit to A", async () => {
		const controllerAFirst = createTestController();
		const controllerB = createTestController();
		const controllerASecond = createTestController(
			loadedRuntimeState({
				sectionId: "pie-512-section-a",
				itemIdentifiers: ["pie-512-a-q1"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pie-512-roundtrip",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerAFirst.handle,
		});
		controllerAFirst.emit(contentLoadedEvent("pie-512-a-q1"));
		controllerAFirst.emit(sectionLoadingCompleteEvent(1, 1));

		await coordinator.disposeSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			persistBeforeDispose: false,
			clearPersistence: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-b",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});
		controllerB.emit(contentLoadedEvent("pie-512-b-q1"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q2"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q3"));
		controllerB.emit(sectionLoadingCompleteEvent(3, 3));

		await coordinator.disposeSectionController({
			sectionId: "pie-512-section-b",
			attemptId: ATTEMPT_ID,
			persistBeforeDispose: false,
			clearPersistence: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerASecond.handle,
		});

		const receivedASecond: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["content-loaded"],
			listener: (event) => receivedASecond.push(event),
		});
		coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => receivedASecond.push(event),
		});

		// Late-subscriber replay path: receivedASecond is populated entirely
		// by replay events synthesised from the seeded runtime state. Pin
		// COUNT and ORDER so a regression that drops content-loaded, fires
		// section-loading-complete first, or stamps the wrong item id fails.
		const typesForASecond = receivedASecond.map((event) => event.type);
		expect(typesForASecond).toEqual([
			"content-loaded",
			"section-loading-complete",
		]);
		const contentLoadedAfterRoundtrip = receivedASecond.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(contentLoadedAfterRoundtrip.map((event) => event.itemId)).toEqual([
			"pie-512-a-q1",
		]);
	});

	test("asymmetric multi-item cohort delivers content-loaded and section-loading-complete to a late subscriber", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController(
			loadedRuntimeState({
				sectionId: "pie-512-section-b",
				itemIdentifiers: [
					"pie-512-b-q1",
					"pie-512-b-q2",
					"pie-512-b-q3",
				],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "pie-512-asymmetric-late",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});
		controllerA.emit(contentLoadedEvent("pie-512-a-q1"));
		controllerA.emit(sectionLoadingCompleteEvent(1, 1));
		await coordinator.disposeSectionController({
			sectionId: "pie-512-section-a",
			attemptId: ATTEMPT_ID,
			persistBeforeDispose: false,
			clearPersistence: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "pie-512-section-b",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});
		controllerB.emit(contentLoadedEvent("pie-512-b-q1"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q2"));
		controllerB.emit(contentLoadedEvent("pie-512-b-q3"));
		controllerB.emit(sectionLoadingCompleteEvent(3, 3));

		const receivedB: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["content-loaded"],
			listener: (event) => receivedB.push(event),
		});
		coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => receivedB.push(event),
		});

		// Late-subscriber replay path on the asymmetric multi-item cohort.
		// Pin COUNT and ORDER so a regression that replays only the first
		// item, fires section-loading-complete before content-loaded, or
		// scrambles registration order fails. `>= 1` masked this previously.
		const typesForB = receivedB.map((event) => event.type);
		expect(typesForB).toEqual([
			"content-loaded",
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
		const contentLoadedReplays = receivedB.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(contentLoadedReplays.map((event) => event.itemId)).toEqual([
			"pie-512-b-q1",
			"pie-512-b-q2",
			"pie-512-b-q3",
		]);
	});
});
