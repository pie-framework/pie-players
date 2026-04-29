/**
 * PIE-512 Phase B regression — persistent-shell cohort handoff.
 *
 * Pins the gap that the original 0.3.32 fix did not cover. That fix
 * solved "events fired live before subscriber attached → replay them at
 * subscribe time" by surfacing `loadedRenderables` on the section
 * controller. It assumes the new cohort's `SectionController` actually
 * received `handleContentRegistered` + `handleContentLoaded` calls in
 * the first place.
 *
 * Darin's follow-up report (2026-04-29) shows the assumption breaks in
 * a passage-only narrow viewport when the same passage object is reused
 * across two consecutive sections. In that scenario:
 *
 *   - The layout custom element is persistent across the cohort flip
 *     (the host re-binds `section-id` / `section` props rather than
 *     remounting).
 *   - The items pane is collapsed away in the responsive split-pane
 *     layout, so item shells unmount on the way out (and remount on the
 *     way in to the new cohort) — those re-fire `pie-register` /
 *     `pie-content-loaded`.
 *   - The passage shell stays mounted across the flip because Svelte
 *     diffs the same passage element to the same DOM position. Its
 *     registration `$effect` does not re-run, so it does NOT re-dispatch
 *     `pie-register` and the underlying item player does not re-emit
 *     `load-complete`.
 *   - In passage-only viewport the items pane is unmounted, so the
 *     items-side re-registration does not fire either, and the new
 *     cohort's `SectionController` ends up with an empty
 *     `trackedRenderables` / `loadedRenderableKeys`.
 *
 * Net effect: the new cohort's late subscriber sees zero events. The
 * existing PIE-512 e2e missed this because it drives
 * `handleContentRegistered` / `handleContentLoaded` directly on each
 * cohort's controller via the test harness (the demo runs with
 * `lazy-init={true}`), bypassing the engine layer where the gap lives.
 *
 * This test exercises the `SectionRuntimeEngine` cohort handoff
 * directly:
 *
 *   1. `engine.register(passage)` + `engine.handleContentRegistered(...)`
 *      + `engine.handleContentLoaded(...)` for cohort A — simulates the
 *      passage shell mounting, registering, and emitting `load-complete`.
 *   2. `engine.initialize({ sectionId: "B", ... })` — cohort flip; the
 *      coordinator returns a fresh `SectionController` for B. The
 *      engine's `RuntimeRegistry` still holds the passage entry because
 *      the persistent shell never fired `pie-unregister`.
 *   3. The new B controller should observe register + load for the
 *      passage (it is, by construction, currently mounted and loaded),
 *      so a late subscriber on cohort B sees the same `content-loaded`
 *      replay that a fresh-cohort live subscriber would have seen.
 *
 * Pre-fix expectation: B's controller receives nothing — assertion
 * fails. The fix (PR forthcoming) makes `engine.initialize` re-feed the
 * new controller with the registry's current registered + loaded set.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
} from "../src/index.js";
import {
	type RuntimeRegistrationDetail,
} from "../src/runtime/registration-events.js";
import { SectionRuntimeEngine } from "../src/runtime/SectionRuntimeEngine.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

interface ControllerCall {
	method:
		| "handleContentRegistered"
		| "handleContentLoaded"
		| "handleContentUnregistered";
	itemId: string;
	contentKind: string | undefined;
}

interface TrackingController extends SectionControllerHandle {
	__sectionId: string;
	__calls: ControllerCall[];
}

/**
 * Tracking controller that records every `handleContent*` call so the
 * test can assert which renderables the cohort's controller saw.
 *
 * Intentionally minimal: it does NOT internally evaluate readiness or
 * emit replay events. The assertion is at the engine→controller seam
 * (did the engine forward register+loaded into the new cohort's
 * controller?), not at the coordinator replay layer (which the existing
 * `pie-512-cross-section-event-delivery.test.ts` already pins).
 */
function createTrackingController(sectionId: string): TrackingController {
	const calls: ControllerCall[] = [];
	const controller: TrackingController = {
		__sectionId: sectionId,
		__calls: calls,
		subscribe(_listener: (event: SectionControllerEvent) => void) {
			return () => {};
		},
		getRuntimeState() {
			return null;
		},
		getSession() {
			return { itemSessions: {} };
		},
		dispose() {
			calls.length = 0;
		},
		handleContentRegistered(args) {
			calls.push({
				method: "handleContentRegistered",
				itemId: args.itemId,
				contentKind: args.contentKind,
			});
		},
		handleContentLoaded(args) {
			calls.push({
				method: "handleContentLoaded",
				itemId: args.itemId,
				contentKind: args.contentKind,
			});
		},
		handleContentUnregistered(args) {
			calls.push({
				method: "handleContentUnregistered",
				itemId: args.itemId,
				contentKind: args.contentKind,
			});
		},
	} as TrackingController;
	return controller;
}

const PASSAGE_ITEM_ID = "pie-512-shared-passage";
const PASSAGE_CONTENT_KIND = "passage";

function makePassageRegistration(): RuntimeRegistrationDetail {
	const element = document.createElement("pie-passage-shell");
	element.setAttribute("data-item-id", PASSAGE_ITEM_ID);
	return {
		kind: "passage",
		itemId: PASSAGE_ITEM_ID,
		canonicalItemId: PASSAGE_ITEM_ID,
		contentKind: PASSAGE_CONTENT_KIND,
		item: null,
		element,
	};
}

describe("PIE-512 persistent-shell cohort handoff", () => {
	let engine: SectionRuntimeEngine;
	let coordinator: ToolkitCoordinator;

	beforeEach(() => {
		engine = new SectionRuntimeEngine();
		coordinator = new ToolkitCoordinator({
			assessmentId: "pie-512-persistent-shell",
			lazyInit: true,
		});
	});

	test(
		"new cohort's controller receives registered + loaded renderables that " +
			"persisted across the cohort flip",
		async () => {
			const controllerA = createTrackingController("section-A");
			const controllerB = createTrackingController("section-B");

			// Cohort A: initialize, simulate the passage shell mounting and
			// firing its load-complete signal. These are the engine-side
			// surfaces that PieAssessmentToolkit's `pie-register` /
			// `pie-content-loaded` event handlers normally drive.
			await engine.initialize({
				coordinator,
				section: { identifier: "section-A" },
				sectionId: "section-A",
				assessmentId: "pie-512-persistent-shell",
				attemptId: "attempt-1",
				view: "candidate",
				createDefaultController: () => controllerA,
			});

			const passage = makePassageRegistration();
			engine.register(passage);
			engine.handleContentRegistered(passage);
			engine.handleContentLoaded({
				itemId: passage.itemId,
				canonicalItemId: passage.canonicalItemId,
				contentKind: passage.contentKind,
				timestamp: Date.now(),
			});

			expect(
				controllerA.__calls.some(
					(call) =>
						call.method === "handleContentRegistered" &&
						call.itemId === PASSAGE_ITEM_ID,
				),
			).toBe(true);
			expect(
				controllerA.__calls.some(
					(call) =>
						call.method === "handleContentLoaded" &&
						call.itemId === PASSAGE_ITEM_ID,
				),
			).toBe(true);

			// Cohort flip → B. The persistent passage shell did NOT unregister
			// (no `pie-unregister` fired because the DOM element stayed
			// mounted), so the engine's RuntimeRegistry still has the entry.
			// PieAssessmentToolkit's section-init effect re-runs and calls
			// engine.initialize for the new (sectionId, attemptId).
			//
			// Crucially: NO new register/load events fire — the test does NOT
			// call engine.register / engine.handleContentRegistered /
			// engine.handleContentLoaded again. That mirrors the real-world
			// passage-only-viewport repro where the passage shell does not
			// re-mount and item shells are unmounted.
			await engine.initialize({
				coordinator,
				section: { identifier: "section-B" },
				sectionId: "section-B",
				assessmentId: "pie-512-persistent-shell",
				attemptId: "attempt-1",
				view: "candidate",
				createDefaultController: () => controllerB,
			});

			// Assertion: the new cohort's controller MUST observe the
			// persistent passage's registered + loaded state. Otherwise the
			// late subscriber on cohort B has nothing to replay.
			expect(
				controllerB.__calls.some(
					(call) =>
						call.method === "handleContentRegistered" &&
						call.itemId === PASSAGE_ITEM_ID,
				),
			).toBe(true);
			expect(
				controllerB.__calls.some(
					(call) =>
						call.method === "handleContentLoaded" &&
						call.itemId === PASSAGE_ITEM_ID,
				),
			).toBe(true);
		},
	);

	test(
		"persistent shell registered but NOT yet loaded at cohort flip is " +
			"replayed register-only into the new controller",
		async () => {
			const controllerA = createTrackingController("section-A");
			const controllerB = createTrackingController("section-B");

			await engine.initialize({
				coordinator,
				section: { identifier: "section-A" },
				sectionId: "section-A",
				assessmentId: "pie-512-persistent-shell",
				attemptId: "attempt-1",
				view: "candidate",
				createDefaultController: () => controllerA,
			});

			// Passage shell mounts and registers in cohort A but its
			// underlying item player has not finished loading by the time the
			// cohort flips — only `pie-register` has fired so far.
			const passage = makePassageRegistration();
			engine.register(passage);
			engine.handleContentRegistered(passage);

			// Cohort flip → B. Same persistent shell, still mid-load.
			await engine.initialize({
				coordinator,
				section: { identifier: "section-B" },
				sectionId: "section-B",
				assessmentId: "pie-512-persistent-shell",
				attemptId: "attempt-1",
				view: "candidate",
				createDefaultController: () => controllerB,
			});

			// B's controller must observe the passage as registered (so that
			// `evaluateSectionLoadingState` knows there is a renderable to
			// wait for) but must NOT see a `handleContentLoaded` — replaying
			// a load that never happened would falsely flip
			// `sectionLoadingComplete` true and emit
			// `section-loading-complete` prematurely on cohort B, which is
			// the exact PIE-512 failure mode in the opposite direction.
			expect(
				controllerB.__calls.some(
					(call) =>
						call.method === "handleContentRegistered" &&
						call.itemId === PASSAGE_ITEM_ID,
				),
			).toBe(true);
			expect(
				controllerB.__calls.some(
					(call) => call.method === "handleContentLoaded",
				),
			).toBe(false);
		},
	);
});
