import { describe, expect, test } from "bun:test";

import { createSectionControllerSubscriptionManager } from "../section-controller-subscription.js";

type FakeController = { id: string };

function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => queueMicrotask(resolve));
}

describe("createSectionControllerSubscriptionManager", () => {
	test("subscribes once for a stable target and skips a redundant ensure", () => {
		let controller: FakeController | null = { id: "a" };
		let subscribeCalls = 0;
		const manager = createSectionControllerSubscriptionManager<FakeController>({
			getController: () => controller,
			subscribe: () => {
				subscribeCalls += 1;
				return () => {};
			},
		});

		manager.ensure("section-1", "attempt-1");
		manager.ensure("section-1", "attempt-1");
		expect(subscribeCalls).toBe(1);
		expect(manager.isActiveTarget("section-1", "attempt-1")).toBe(true);
	});

	test("resubscribes when the target changes", () => {
		const controller: FakeController = { id: "a" };
		let subscribeCalls = 0;
		let teardownCalls = 0;
		const manager = createSectionControllerSubscriptionManager<FakeController>({
			getController: () => controller,
			subscribe: () => {
				subscribeCalls += 1;
				return () => {
					teardownCalls += 1;
				};
			},
		});

		manager.ensure("section-1", "attempt-1");
		manager.ensure("section-2", "attempt-1");
		expect(subscribeCalls).toBe(2);
		expect(teardownCalls).toBe(1);
		expect(manager.isActiveTarget("section-1", "attempt-1")).toBe(false);
		expect(manager.isActiveTarget("section-2", "attempt-1")).toBe(true);
	});

	test("detaches and reports unavailable when no controller is found", () => {
		let controller: FakeController | null = { id: "a" };
		let teardownCalls = 0;
		let unavailableCalls = 0;
		const manager = createSectionControllerSubscriptionManager<FakeController>({
			getController: () => controller,
			subscribe: () => () => {
				teardownCalls += 1;
			},
			onControllerUnavailable: () => {
				unavailableCalls += 1;
			},
		});

		manager.ensure("section-1", "attempt-1");
		controller = null;
		manager.ensure("section-1", "attempt-1");
		expect(teardownCalls).toBe(1);
		expect(unavailableCalls).toBe(1);
		expect(manager.isActiveTarget("section-1", "attempt-1")).toBe(false);
	});

	test("bindLifecycle detaches and queues a resubscribe on a matching disposed event", async () => {
		const controller: FakeController = { id: "a" };
		let subscribeCalls = 0;
		const manager = createSectionControllerSubscriptionManager<FakeController>({
			getController: () => controller,
			subscribe: () => {
				subscribeCalls += 1;
				return () => {};
			},
		});
		manager.ensure("section-1", "attempt-1");
		expect(subscribeCalls).toBe(1);

		let lifecycleListener: ((event: unknown) => void) | null = null;
		const coordinator = {
			onSectionControllerLifecycle: (listener: (event: unknown) => void) => {
				lifecycleListener = listener;
				return () => {
					lifecycleListener = null;
				};
			},
		};
		manager.bindLifecycle(coordinator, "section-1", "attempt-1");

		lifecycleListener?.({
			type: "disposed",
			key: { sectionId: "section-1", attemptId: "attempt-1" },
		});
		// detachController runs synchronously; the resubscribe is queued as a microtask.
		expect(manager.isActiveTarget("section-1", "attempt-1")).toBe(false);
		await flushMicrotasks();
		expect(subscribeCalls).toBe(2);
	});

	test("bindLifecycle ignores events for a different section/attempt", () => {
		const controller: FakeController = { id: "a" };
		let subscribeCalls = 0;
		const manager = createSectionControllerSubscriptionManager<FakeController>({
			getController: () => controller,
			subscribe: () => {
				subscribeCalls += 1;
				return () => {};
			},
		});
		manager.ensure("section-1", "attempt-1");

		let lifecycleListener: ((event: unknown) => void) | null = null;
		const coordinator = {
			onSectionControllerLifecycle: (listener: (event: unknown) => void) => {
				lifecycleListener = listener;
				return () => {};
			},
		};
		let matchingEventCount = 0;
		manager.bindLifecycle(coordinator, "section-1", "attempt-1", () => {
			matchingEventCount += 1;
		});

		lifecycleListener?.({
			type: "ready",
			key: { sectionId: "section-other", attemptId: "attempt-1" },
		});
		expect(matchingEventCount).toBe(0);
		expect(subscribeCalls).toBe(1);
	});
});
