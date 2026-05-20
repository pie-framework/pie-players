import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../src/index.js";

/**
 * PIE-512 Phase D contract pin.
 *
 * Phase D changes the contract of `subscribeSectionEvents` (and its two
 * helper wrappers) so that a listener follows the toolkit's *active section
 * cohort* across navigation, automatically migrating with snapshot replay
 * on every cohort transition.
 *
 * The pre-Phase-D contract bound the listener to the section controller
 * that was active at subscribe time, leaving hosts that subscribe once on
 * `toolkit-ready` (the supported pattern) silently pinned to a stale
 * controller after navigation. See PIE-512 for the consumer-observable
 * regression.
 *
 * These tests pin Phase D's coordinator-side behavior precisely, using
 * the synthetic-controller harness pattern from
 * `toolkit-coordinator-section-events.test.ts`. They assume the runtime
 * call signature ignores any `sectionId` / `attemptId` arg (back-compat
 * tolerance for hosts that still pass them) and binds purely against the
 * coordinator's active cohort.
 */

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

function sectionLoadingCompleteEvent(
	totalRegistered = 1,
	totalLoaded = 1,
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
		loadedRenderables: args.itemIdentifiers.map((itemId) => ({
			itemId,
			canonicalItemId: itemId,
			contentKind: "item" as const,
		})),
	};
}

const ATTEMPT_ID = "attempt-phase-d";

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((innerResolve) => {
		resolve = innerResolve;
	});
	return { promise, resolve };
}

describe("PIE-512 Phase D: subscribeSectionEvents follows the active cohort", () => {
	test("subscribeItemEvents (no sectionId) binds to the active cohort and migrates on cohort change", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-item-events-binds-to-active",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		controllerA.emit(itemSelectedEvent("item-a-1"));
		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({ currentItemId: "item-a-1" });

		// Cohort transition: a second `getOrCreateSectionController` for a
		// different cohort flips the active cohort to B *without* disposing A.
		// Persistent-host wrappers (Darin's pattern) hit this path on every
		// section navigation.
		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		controllerB.emit(itemSelectedEvent("item-b-1"));
		expect(received).toHaveLength(2);
		expect(received[1]).toMatchObject({ currentItemId: "item-b-1" });

		unsubscribe();
	});

	test("subscribeSectionLifecycleEvents (no sectionId) binds to the active cohort and migrates on cohort change", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-lifecycle-events-binds-to-active",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		const unsubscribe = coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => received.push(event),
		});

		controllerA.emit(sectionLoadingCompleteEvent(1, 1));
		expect(received).toHaveLength(1);
		expect(received[0]?.type).toBe("section-loading-complete");

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		controllerB.emit(sectionLoadingCompleteEvent(3, 3));
		expect(received).toHaveLength(2);
		expect(received[1]?.type).toBe("section-loading-complete");
		expect(received[1]).toMatchObject({ totalRegistered: 3, totalLoaded: 3 });

		unsubscribe();
	});

	test("listener does NOT receive events from inactive cohorts after migration", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-no-stale-cohort-events",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		// A is no longer active; events emitted on its handle must not reach
		// the migrated listener. Without active-cohort migration, the
		// pre-Phase-D contract pinned the listener to A's handle and would
		// (incorrectly) deliver this event.
		controllerA.emit(itemSelectedEvent("stale-from-a"));
		expect(received).toHaveLength(0);

		controllerB.emit(itemSelectedEvent("live-from-b"));
		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({ currentItemId: "live-from-b" });
	});

	test("snapshot replay fires on every cohort migration (no double-replay of A)", async () => {
		const controllerA = createTestController(
			loadedRuntimeState({
				sectionId: "section-A",
				itemIdentifiers: ["item-a-1"],
			}),
		);
		const controllerB = createTestController(
			loadedRuntimeState({
				sectionId: "section-B",
				itemIdentifiers: ["item-b-1", "item-b-2"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-replay-on-migration",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeSectionEvents({
			eventTypes: ["content-loaded", "section-loading-complete"],
			listener: (event) => received.push(event),
		});

		// Initial subscribe sees A's snapshot replay.
		const typesAfterAReplay = received.map((event) => event.type);
		expect(typesAfterAReplay).toEqual([
			"content-loaded",
			"section-loading-complete",
		]);
		const aContentLoaded = received.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(aContentLoaded.map((event) => event.itemId)).toEqual(["item-a-1"]);

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		// Migration to B replays *only* B's snapshot — A's events must not
		// appear again, and B's must arrive in canonical order.
		const typesAfterBReplay = received
			.slice(typesAfterAReplay.length)
			.map((event) => event.type);
		expect(typesAfterBReplay).toEqual([
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
		const bContentLoaded = received
			.slice(typesAfterAReplay.length)
			.filter(
				(event) => event.type === "content-loaded",
			) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(bContentLoaded.map((event) => event.itemId)).toEqual([
			"item-b-1",
			"item-b-2",
		]);
	});

	test("replay ordering: content-loaded × N (registration order) → section-loading-complete", async () => {
		const controller = createTestController(
			loadedRuntimeState({
				sectionId: "section-A",
				itemIdentifiers: ["item-1", "item-2", "item-3"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-replay-order",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeSectionEvents({
			eventTypes: ["content-loaded", "section-loading-complete"],
			listener: (event) => received.push(event),
		});

		expect(received.map((event) => event.type)).toEqual([
			"content-loaded",
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
		const contentLoaded = received.filter(
			(event) => event.type === "content-loaded",
		) as Array<Extract<SectionControllerEvent, { type: "content-loaded" }>>;
		expect(contentLoaded.map((event) => event.itemId)).toEqual([
			"item-1",
			"item-2",
			"item-3",
		]);
	});

	test("disposeSectionController for the active cohort detaches the listener", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-dispose-detaches",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		controller.emit(itemSelectedEvent("before-dispose"));
		expect(received).toHaveLength(1);

		await coordinator.disposeSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			persistBeforeDispose: false,
			clearPersistence: true,
		});

		controller.emit(itemSelectedEvent("after-dispose"));
		expect(received).toHaveLength(1);
	});

	test("subscribing before any cohort exists throws", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-subscribe-before-cohort",
			lazyInit: true,
		});

		expect(() => {
			coordinator.subscribeItemEvents({
				listener: () => {},
			});
		}).toThrow(/active section cohort/i);
	});

	test("subscribing after cohort transition lands on the new cohort", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-late-subscribe-after-transition",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		controllerA.emit(itemSelectedEvent("from-a"));
		controllerB.emit(itemSelectedEvent("from-b"));

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({ currentItemId: "from-b" });
	});

	test("listener throw isolation: a throwing listener does not break fan-out to other listeners", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-listener-throw-isolation",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		const receivedA: SectionControllerEvent[] = [];
		const receivedC: SectionControllerEvent[] = [];
		const warnings: string[] = [];
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map((arg) => String(arg)).join(" "));
		};

		try {
			coordinator.subscribeItemEvents({
				eventTypes: ["item-selected"],
				listener: (event) => receivedA.push(event),
			});
			coordinator.subscribeItemEvents({
				eventTypes: ["item-selected"],
				listener: () => {
					throw new Error("listener-b boom");
				},
			});
			coordinator.subscribeItemEvents({
				eventTypes: ["item-selected"],
				listener: (event) => receivedC.push(event),
			});

			controller.emit(itemSelectedEvent("event-1"));
			controller.emit(itemSelectedEvent("event-2"));

			expect(receivedA).toHaveLength(2);
			expect(receivedC).toHaveLength(2);
			expect(
				warnings.filter((line) => line.includes("listener-b boom")),
			).toHaveLength(2);
		} finally {
			console.warn = originalWarn;
		}
	});

	test("unsubscribe during fan-out is safe (other listeners still receive the event)", async () => {
		const controller = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-unsubscribe-during-fanout",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		const receivedA: SectionControllerEvent[] = [];
		const receivedB: SectionControllerEvent[] = [];
		let unsubscribeB: (() => void) | null = null;

		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => {
				receivedA.push(event);
				unsubscribeB?.();
			},
		});
		unsubscribeB = coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => receivedB.push(event),
		});

		controller.emit(itemSelectedEvent("first"));
		controller.emit(itemSelectedEvent("second"));

		// A always sees both. B sees the first event (snapshot iteration
		// inside the controller protects in-flight delivery), but the
		// second emit no longer reaches B because A unsubscribed it during
		// the first delivery. Pin both count and content so a regression
		// that drops the in-flight delivery (i.e. tightens the iteration
		// to drop B mid-fan-out) fails the assertion.
		expect(receivedA).toHaveLength(2);
		expect(receivedB).toHaveLength(1);
		expect(receivedB[0]).toMatchObject({ currentItemId: "first" });
	});

	test("same-cohort getOrCreateSectionController is a no-op (no double-replay on updateInput)", async () => {
		// Pins the `setActiveCohort` same-cohort early-return: a
		// same-cohort `updateInput` (PnP toggle, prompt edit) flows
		// through `resolveExistingSectionController`, which calls
		// `setActiveCohort(mapKey)`. Without the early-return, every
		// `updateInput` would re-replay the full snapshot to every
		// already-bound listener.
		const controller = createTestController(
			loadedRuntimeState({
				sectionId: "section-A",
				itemIdentifiers: ["item-a-1", "item-a-2"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-same-cohort-noop",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeSectionEvents({
			eventTypes: ["content-loaded", "section-loading-complete"],
			listener: (event) => received.push(event),
		});

		// Initial subscribe replays A's snapshot (2 content-loaded +
		// 1 section-loading-complete = 3 events).
		expect(received).toHaveLength(3);

		// Same-cohort re-resolve. Should NOT trigger a second replay.
		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controller.handle,
		});

		expect(received).toHaveLength(3);
	});

	test("stale async new-controller resolution does not move active cohort backward", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const releaseA = createDeferred();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-stale-new-controller-resolution",
			lazyInit: true,
		});

		const firstResolve = coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: async () => {
				await releaseA.promise;
				return controllerA.handle;
			},
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		controllerB.emit(itemSelectedEvent("from-b-before-stale-a"));
		releaseA.resolve();
		await firstResolve;
		controllerA.emit(itemSelectedEvent("stale-from-a"));
		controllerB.emit(itemSelectedEvent("from-b-after-stale-a"));

		expect(
			received.map((event) =>
				event.type === "item-selected" ? event.currentItemId : event.type,
			),
		).toEqual(["from-b-before-stale-a", "from-b-after-stale-a"]);
	});

	test("pending navigation to a new cohort detaches outgoing cohort events", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const releaseB = createDeferred();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-pending-navigation-detaches-outgoing",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		const pendingB = coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: async () => {
				await releaseB.promise;
				return controllerB.handle;
			},
		});

		controllerA.emit(itemSelectedEvent("stale-from-a-while-b-pending"));
		expect(received).toHaveLength(0);

		releaseB.resolve();
		await pendingB;
		controllerB.emit(itemSelectedEvent("live-from-b-after-pending"));

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({
			currentItemId: "live-from-b-after-pending",
		});
	});

	test("stale async existing-controller update does not move active cohort backward", async () => {
		const controllerA = createTestController();
		const controllerB = createTestController();
		const releaseAUpdate = createDeferred();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-stale-existing-controller-update",
			lazyInit: true,
		});
		controllerA.handle.updateInput = async () => {
			await releaseAUpdate.promise;
		};

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			eventTypes: ["item-selected"],
			listener: (event) => received.push(event),
		});

		const staleAUpdate = coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			input: { sectionId: "section-A", revision: "stale" },
			createDefaultController: () => controllerA.handle,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		controllerB.emit(itemSelectedEvent("from-b-before-stale-a-update"));
		releaseAUpdate.resolve();
		await staleAUpdate;
		controllerA.emit(itemSelectedEvent("stale-from-a-update"));
		controllerB.emit(itemSelectedEvent("from-b-after-stale-a-update"));

		expect(
			received.map((event) =>
				event.type === "item-selected" ? event.currentItemId : event.type,
			),
		).toEqual([
			"from-b-before-stale-a-update",
			"from-b-after-stale-a-update",
		]);
	});

	test("subscribing a new listener from inside another listener's replay during cohort migration replays exactly once", async () => {
		// Pins the re-entrancy guard in `setActiveCohort`: when listener
		// A subscribes a new listener Z synchronously during its own
		// replay delivery on a cohort migration, Z's snapshot must fire
		// exactly once. Without the snapshot guard (Array.from), the
		// outer iteration revisits the freshly-inserted Z and double-
		// replays it.
		const controllerA = createTestController(
			loadedRuntimeState({
				sectionId: "section-A",
				itemIdentifiers: ["item-a-1"],
			}),
		);
		const controllerB = createTestController(
			loadedRuntimeState({
				sectionId: "section-B",
				itemIdentifiers: ["item-b-1", "item-b-2"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-reentrant-subscribe",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const receivedZ: SectionControllerEvent[] = [];
		let zSubscribed = false;
		coordinator.subscribeSectionEvents({
			eventTypes: ["content-loaded", "section-loading-complete"],
			listener: (event) => {
				if (zSubscribed) return;
				if (event.type !== "section-loading-complete") return;
				zSubscribed = true;
				coordinator.subscribeSectionEvents({
					eventTypes: ["content-loaded", "section-loading-complete"],
					listener: (innerEvent) => receivedZ.push(innerEvent),
				});
			},
		});

		// While A is still active, listener Z gets subscribed during the
		// initial replay — this is the synchronous re-entry path. Z's
		// own subscribe call replays A's snapshot once.
		expect(receivedZ.map((event) => event.type)).toEqual([
			"content-loaded",
			"section-loading-complete",
		]);
		const receivedZBeforeMigration = [...receivedZ];

		// Cohort transition: any double-binding bug would surface here as
		// duplicate replays of B's snapshot to Z.
		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		const zAfterMigration = receivedZ.slice(receivedZBeforeMigration.length);
		expect(zAfterMigration.map((event) => event.type)).toEqual([
			"content-loaded",
			"content-loaded",
			"section-loading-complete",
		]);
	});

	test("back-compat: passing a stale sectionId arg is ignored at runtime — listener still binds to active cohort", async () => {
		// Mirrors Darin's wrapper, which subscribes once on `toolkit-ready`
		// and passes its captured `this.sectionId` (the section that was
		// active *at toolkit-ready time*). Phase D treats the arg as a
		// no-op so existing call sites still work; the listener follows
		// the active cohort regardless.
		const controllerA = createTestController();
		const controllerB = createTestController();
		const coordinator = new ToolkitCoordinator({
			assessmentId: "phase-d-back-compat-section-id-ignored",
			lazyInit: true,
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-A",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerA.handle,
		});

		const received: SectionControllerEvent[] = [];
		coordinator.subscribeItemEvents({
			// Intentionally cast to bypass the Phase D type signature so we
			// can assert the runtime tolerates the legacy arg shape.
			...({
				sectionId: "section-A",
				attemptId: ATTEMPT_ID,
				eventTypes: ["item-selected"],
				listener: (event: SectionControllerEvent) => received.push(event),
			} as unknown as { listener: (event: SectionControllerEvent) => void }),
		});

		await coordinator.getOrCreateSectionController({
			sectionId: "section-B",
			attemptId: ATTEMPT_ID,
			createDefaultController: () => controllerB.handle,
		});

		controllerB.emit(itemSelectedEvent("from-b-after-migration"));
		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({
			currentItemId: "from-b-after-migration",
		});
	});
});
