import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	ItemEntity,
} from "@pie-players/pie-players-shared";
import { SectionController } from "../src/controllers/SectionController";

/**
 * PIE-512 Phase C invariants.
 *
 * Validates the three controller-side guarantees that make late
 * subscribers race-free across cohort flips and same-section
 * `updateInput` refreshes:
 *
 *  1. `updateInput` with the SAME section identifier preserves
 *     lifecycle tracking — `loadedRenderableKeys`,
 *     `trackedRenderables`, `sectionLoadingComplete` — so a subscriber
 *     that attaches between the input refresh and the next live event
 *     still sees the correct `runtimeState` snapshot.
 *  2. `handleContentRegistered` is idempotent: re-registering an
 *     already-tracked `(canonicalItemId, contentKind)` pair does not
 *     re-emit `section-loading-complete`.
 *  3. `handleContentLoaded` is idempotent: re-loading an already-loaded
 *     `(canonicalItemId, contentKind)` pair does not duplicate
 *     `content-loaded` and does not re-evaluate
 *     `section-loading-complete`.
 *
 * Together these enable the engine to safely re-feed its registry into
 * the controller on every `initialize(...)` call (the gate-drop change
 * in `SectionRuntimeEngine`) — both fresh-controller cohort flips and
 * same-cohort `updateInput` resolves are handled by a single replay
 * code path with no duplicate emits.
 */

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: {
			elements: {},
			models: [],
			markup: "<div></div>",
		},
	} as unknown as ItemEntity;
}

function makeSection(
	sectionId: string,
	canonicalIds: string[],
): AssessmentSection {
	return {
		identifier: sectionId,
		assessmentItemRefs: canonicalIds.map((canonicalId, index) => ({
			identifier: canonicalId,
			item: makeItem(`runtime-${sectionId}-${index + 1}`),
		})),
		rubricBlocks: [],
	} as unknown as AssessmentSection;
}

describe("SectionController PIE-512 Phase C invariants", () => {
	test("same-section updateInput preserves trackedRenderables and loadedRenderableKeys", async () => {
		const controller = new SectionController();
		const section = makeSection("section-pc-1", ["item-pc-1"]);

		await controller.initialize({
			section,
			sectionId: "section-pc-1",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});
		controller.handleContentRegistered({
			itemId: "runtime-section-pc-1-1",
			canonicalItemId: "item-pc-1",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-section-pc-1-1",
			canonicalItemId: "item-pc-1",
			contentKind: "item",
		});

		const beforeUpdate = controller.getRuntimeState();
		expect(beforeUpdate?.totalRegistered).toBe(1);
		expect(beforeUpdate?.totalLoaded).toBe(1);
		expect(beforeUpdate?.loadingComplete).toBe(true);

		await controller.updateInput({
			section: {
				...section,
				title: "Section PC-1 (refresh)",
			},
			sectionId: "section-pc-1",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});

		const afterUpdate = controller.getRuntimeState();
		expect(afterUpdate?.totalRegistered).toBe(1);
		expect(afterUpdate?.totalLoaded).toBe(1);
		expect(afterUpdate?.loadingComplete).toBe(true);
		expect(afterUpdate?.loadedRenderables?.[0]).toEqual(
			expect.objectContaining({
				canonicalItemId: "item-pc-1",
				contentKind: "item",
			}),
		);
	});

	test("different-section updateInput still wipes lifecycle tracking", async () => {
		const controller = new SectionController();
		const sectionOne = makeSection("section-pc-2", ["item-pc-2"]);
		const sectionTwo = makeSection("section-pc-3", ["item-pc-3"]);

		await controller.initialize({
			section: sectionOne,
			sectionId: "section-pc-2",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});
		controller.handleContentRegistered({
			itemId: "runtime-section-pc-2-1",
			canonicalItemId: "item-pc-2",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-section-pc-2-1",
			canonicalItemId: "item-pc-2",
			contentKind: "item",
		});

		await controller.updateInput({
			section: sectionTwo,
			sectionId: "section-pc-3",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});

		const afterFlip = controller.getRuntimeState();
		expect(afterFlip?.totalRegistered).toBe(0);
		expect(afterFlip?.totalLoaded).toBe(0);
		expect(afterFlip?.loadingComplete).toBe(false);
	});

	test("handleContentRegistered is idempotent — duplicate register does not re-emit section-loading-complete", async () => {
		const controller = new SectionController();
		const section = makeSection("section-pc-4", ["item-pc-4"]);

		await controller.initialize({
			section,
			sectionId: "section-pc-4",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});

		const loadingCompleteEvents: unknown[] = [];
		const unsubscribe = controller.subscribe((event) => {
			if (event.type === "section-loading-complete") {
				loadingCompleteEvents.push(event);
			}
		});

		controller.handleContentRegistered({
			itemId: "runtime-section-pc-4-1",
			canonicalItemId: "item-pc-4",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-section-pc-4-1",
			canonicalItemId: "item-pc-4",
			contentKind: "item",
		});

		expect(loadingCompleteEvents).toHaveLength(1);

		controller.handleContentRegistered({
			itemId: "runtime-section-pc-4-1",
			canonicalItemId: "item-pc-4",
			contentKind: "item",
		});

		unsubscribe();
		expect(loadingCompleteEvents).toHaveLength(1);
	});

	test("handleContentLoaded is idempotent — duplicate load does not re-emit content-loaded", async () => {
		const controller = new SectionController();
		const section = makeSection("section-pc-5", ["item-pc-5"]);

		await controller.initialize({
			section,
			sectionId: "section-pc-5",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});

		const contentLoadedEvents: unknown[] = [];
		const loadingCompleteEvents: unknown[] = [];
		const unsubscribe = controller.subscribe((event) => {
			if (event.type === "content-loaded") {
				contentLoadedEvents.push(event);
			}
			if (event.type === "section-loading-complete") {
				loadingCompleteEvents.push(event);
			}
		});

		controller.handleContentRegistered({
			itemId: "runtime-section-pc-5-1",
			canonicalItemId: "item-pc-5",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-section-pc-5-1",
			canonicalItemId: "item-pc-5",
			contentKind: "item",
		});

		expect(contentLoadedEvents).toHaveLength(1);
		expect(loadingCompleteEvents).toHaveLength(1);

		controller.handleContentLoaded({
			itemId: "runtime-section-pc-5-1",
			canonicalItemId: "item-pc-5",
			contentKind: "item",
		});

		unsubscribe();
		expect(contentLoadedEvents).toHaveLength(1);
		expect(loadingCompleteEvents).toHaveLength(1);
	});

	test("late subscriber on same-section updateInput observes preserved runtime state", async () => {
		// Concrete reproduction of Darin's flake: a subscriber that
		// attaches AFTER the engine has already replayed shells into a
		// same-cohort `updateInput`-resolved controller must see the
		// preserved lifecycle state via `getRuntimeState()` without
		// needing replay events on its own subscription. Pre-Phase-C
		// `updateInput` wiped state, so a late subscriber observed
		// `totalLoaded === 0` here.
		const controller = new SectionController();
		const section = makeSection("section-pc-6", ["item-pc-6"]);

		await controller.initialize({
			section,
			sectionId: "section-pc-6",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});
		controller.handleContentRegistered({
			itemId: "runtime-section-pc-6-1",
			canonicalItemId: "item-pc-6",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-section-pc-6-1",
			canonicalItemId: "item-pc-6",
			contentKind: "item",
		});

		await controller.updateInput({
			section: {
				...section,
				title: "Section PC-6 (refresh)",
			},
			sectionId: "section-pc-6",
			assessmentId: "assessment-pc",
			view: ["candidate"],
		});

		const lateSnapshot = controller.getRuntimeState();
		expect(lateSnapshot?.totalRegistered).toBe(1);
		expect(lateSnapshot?.totalLoaded).toBe(1);
		expect(lateSnapshot?.loadingComplete).toBe(true);
		expect(lateSnapshot?.loadedRenderables).toHaveLength(1);
	});
});
