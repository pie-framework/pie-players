import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../src/index.js";

function createTestController(
	runtimeState?: SectionControllerRuntimeState | null,
) {
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
		emit(event: SectionControllerEvent) {
			for (const listener of listeners) {
				listener(event);
			}
		},
	};
}

function itemSelectedEvent(itemId: string): SectionControllerEvent {
	return {
		type: "item-selected",
		previousItemId: itemId,
		currentItemId: itemId,
		itemIndex: 0,
		totalItems: 1,
		currentItemIndex: 0,
		timestamp: Date.now(),
	};
}

function sectionErrorEvent(): SectionControllerEvent {
	return {
		type: "section-error",
		source: "controller",
		error: new Error("boom"),
		currentItemIndex: 0,
		timestamp: Date.now(),
	};
}

function sectionLoadingCompleteEvent(): SectionControllerEvent {
	return {
		type: "section-loading-complete",
		totalRegistered: 2,
		totalLoaded: 2,
		currentItemIndex: 0,
		timestamp: Date.now(),
	};
}

describe("ToolkitCoordinator section event subscriptions", () => {
	test("re-emits section-loading-complete for late subscribers", async () => {
		const controller = createTestController({
			sectionId: "section-1",
			currentItemIndex: 0,
			currentItemId: "item-1",
			itemIdentifiers: ["item-1"],
			visitedItemIdentifiers: ["item-1"],
			itemSessions: {},
			loadingComplete: true,
			totalRegistered: 2,
			totalLoaded: 2,
			itemsComplete: false,
			completedCount: 0,
			totalItems: 1,
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-late-subscriber",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeSectionLifecycleEvents({
			listener: (event) => received.push(event),
		});

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(
			expect.objectContaining({
				type: "section-loading-complete",
				totalRegistered: 2,
				totalLoaded: 2,
			}),
		);
		unsubscribe();
	});

	test("replays section-loading-complete when runtime reports complete without totals", async () => {
		const controller = createTestController({
			sectionId: "section-1",
			currentItemIndex: 0,
			currentItemId: "item-1",
			itemIdentifiers: ["item-1"],
			visitedItemIdentifiers: ["item-1"],
			itemSessions: {},
			loadingComplete: true,
			totalRegistered: 0,
			totalLoaded: 0,
			itemsComplete: false,
			completedCount: 0,
			totalItems: 1,
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-late-subscriber-no-totals",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeSectionLifecycleEvents({
			listener: (event) => received.push(event),
		});

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(
			expect.objectContaining({
				type: "section-loading-complete",
				totalRegistered: 0,
				totalLoaded: 0,
			}),
		);
		unsubscribe();
	});

	test("does not replay section-loading-complete for item-scoped helper", async () => {
		const controller = createTestController({
			sectionId: "section-1",
			currentItemIndex: 0,
			currentItemId: "item-1",
			itemIdentifiers: ["item-1"],
			visitedItemIdentifiers: ["item-1"],
			itemSessions: {},
			loadingComplete: true,
			totalRegistered: 2,
			totalLoaded: 2,
			itemsComplete: false,
			completedCount: 0,
			totalItems: 1,
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-item-no-replay",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeItemEvents({
			listener: (event) => received.push(event),
		});

		expect(received).toHaveLength(0);
		unsubscribe();
	});

	test("replay still respects section lifecycle event type filters", async () => {
		const controller = createTestController({
			sectionId: "section-1",
			currentItemIndex: 0,
			currentItemId: "item-1",
			itemIdentifiers: ["item-1"],
			visitedItemIdentifiers: ["item-1"],
			itemSessions: {},
			loadingComplete: true,
			totalRegistered: 2,
			totalLoaded: 2,
			itemsComplete: false,
			completedCount: 0,
			totalItems: 1,
		});
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-replay-filter",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-error"],
			listener: (event) => received.push(event),
		});

		expect(received).toHaveLength(0);
		unsubscribe();
	});

	test("filters item helper subscriptions by event type and item id", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-events",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			itemIds: ["item-b"],
			listener: (event) => received.push(event),
		});

		controller.emit(itemSelectedEvent("item-a"));
		controller.emit(sectionErrorEvent());
		controller.emit(itemSelectedEvent("item-b"));

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(
			expect.objectContaining({
				type: "item-selected",
				currentItemId: "item-b",
			}),
		);
		unsubscribe();
	});

	test("subscribeItemEvents receives item-scoped events only", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-item-helper",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeItemEvents({
			itemIds: ["item-b"],
			listener: (event) => received.push(event),
		});

		controller.emit(itemSelectedEvent("item-a"));
		controller.emit(sectionLoadingCompleteEvent());
		controller.emit(itemSelectedEvent("item-b"));

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(
			expect.objectContaining({
				type: "item-selected",
				currentItemId: "item-b",
			}),
		);
		unsubscribe();
	});

	test("subscribeSectionLifecycleEvents receives section-scoped events", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-section-helper",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeSectionLifecycleEvents({
			listener: (event) => received.push(event),
		});

		controller.emit(itemSelectedEvent("item-a"));
		controller.emit(sectionLoadingCompleteEvent());
		controller.emit(sectionErrorEvent());

		expect(received).toHaveLength(2);
		expect(received[0]?.type).toBe("section-loading-complete");
		expect(received[1]?.type).toBe("section-error");
		unsubscribe();
	});

	test("replaces existing subscription for the same listener", async () => {
		// Phase D: the dedup key is the listener identity alone (no
		// section key). Subscribing the same listener function twice
		// replaces the first subscription with the second, regardless of
		// filter args. Preserves the pre-Phase-D ergonomic that lets a
		// wrapper re-subscribe the same handler without first manually
		// unsubscribing.
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-replace",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		const listener = (event: SectionControllerEvent) => received.push(event);
		const unsubscribeFirst = coordinator.subscribeItemEvents({
			itemIds: ["item-a"],
			listener,
		});
		const unsubscribeSecond = coordinator.subscribeItemEvents({
			itemIds: ["item-b"],
			listener,
		});

		controller.emit(itemSelectedEvent("item-a"));
		controller.emit(itemSelectedEvent("item-b"));

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(
			expect.objectContaining({
				currentItemId: "item-b",
			}),
		);
		unsubscribeFirst();
		unsubscribeSecond();
	});
});
