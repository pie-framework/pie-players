import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../src/index.js";

function createTestController(runtimeState?: SectionControllerRuntimeState | null) {
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
			sectionId: "section-1",
			attemptId: "attempt-1",
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
			sectionId: "section-1",
			attemptId: "attempt-1",
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
			sectionId: "section-1",
			attemptId: "attempt-1",
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
			sectionId: "section-1",
			attemptId: "attempt-1",
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

	test("replaces existing subscription for the same listener and section key", async () => {
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
			sectionId: "section-1",
			attemptId: "attempt-1",
			itemIds: ["item-a"],
			listener,
		});
		const unsubscribeSecond = coordinator.subscribeItemEvents({
			sectionId: "section-1",
			attemptId: "attempt-1",
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

	test("does not subscribe when section is ambiguous without attempt id", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "assessment-ambiguous",
			lazyInit: true,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controllerA.handle,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-2",
			createDefaultController: () => controllerB.handle,
		});

		const warnings: string[] = [];
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map((arg) => String(arg)).join(" "));
		};

		try {
			const received: SectionControllerEvent[] = [];
			const unsubscribe = coordinator.subscribeItemEvents({
				sectionId: "section-1",
				listener: (event) => received.push(event),
			});
			controllerA.emit(itemSelectedEvent("item-a"));
			controllerB.emit(itemSelectedEvent("item-b"));
			unsubscribe();

			expect(received).toHaveLength(0);
			expect(
				warnings.some((entry) =>
					entry.includes("subscribeSectionEvents is ambiguous"),
				),
			).toBe(true);
		} finally {
			console.warn = originalWarn;
		}
	});
});
