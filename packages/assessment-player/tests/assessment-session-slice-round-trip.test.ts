import { describe, expect, test } from "bun:test";
import type { SectionControllerSessionState } from "@pie-players/pie-players-shared/types";
import { AssessmentController } from "../src/controller/AssessmentController";

/**
 * The assessment session carries whole section snapshots, delivery slices
 * included. This was previously unprovable from here: `getSectionSession` was
 * typed as a local three-field `SectionSessionSnapshot` and cast to it, so
 * `formative` and `timedMedia` were unreadable through the assessment layer even
 * though the runtime passed them through by reference. These tests assert the
 * pass-through so a future narrowing fails here rather than in a host's rollup.
 */

function makeSnapshot(): SectionControllerSessionState {
	return {
		currentItemIndex: 1,
		visitedItemIdentifiers: ["item-1", "item-2"],
		itemSessions: {
			"item-1": { id: "item-1", data: [{ id: "mc-1", value: ["a"] }] },
		},
		formative: {
			version: 1,
			items: {
				"item-1": {
					version: 1,
					itemIdentifier: "item-1",
					tryCount: 2,
					revealed: true,
					firstCorrectTry: 2,
					lastOutcome: {
						correctness: "correct",
						points: 1,
						max: 1,
						scoredElementCount: 1,
						totalElementCount: 1,
					},
				},
			},
		},
		timedMedia: {
			version: 1,
			mediaCurrentTime: 42.5,
			mediaCompleted: false,
			visitedCueIdentifiers: ["cue-1"],
			completedCueIdentifiers: [],
		},
	};
}

function makeController(): AssessmentController {
	return new AssessmentController({
		assessmentId: "assessment-1",
		attemptId: "attempt-1",
		assessment: null,
	});
}

describe("assessment session section slices", () => {
	test("round-trips the formative slice through the assessment session", () => {
		const controller = makeController();
		const snapshot = makeSnapshot();

		controller.updateSectionSession("section-1", snapshot);
		const restored = controller.getSectionSession("section-1");

		expect(restored?.formative).toEqual(snapshot.formative);
		expect(restored?.formative?.items["item-1"]?.tryCount).toBe(2);
		expect(restored?.formative?.items["item-1"]?.revealed).toBe(true);
	});

	test("round-trips the timed-media slice through the assessment session", () => {
		const controller = makeController();
		const snapshot = makeSnapshot();

		controller.updateSectionSession("section-1", snapshot);
		const restored = controller.getSectionSession("section-1");

		expect(restored?.timedMedia).toEqual(snapshot.timedMedia);
		expect(restored?.timedMedia?.mediaCurrentTime).toBe(42.5);
	});

	test("survives JSON serialization, which is how a host persists it", () => {
		const controller = makeController();
		controller.updateSectionSession("section-1", makeSnapshot());

		const restored = JSON.parse(
			JSON.stringify(controller.getSectionSession("section-1")),
		) as SectionControllerSessionState;

		expect(restored.formative?.items["item-1"]?.lastOutcome?.correctness).toBe(
			"correct",
		);
		expect(restored.timedMedia?.visitedCueIdentifiers).toEqual(["cue-1"]);
	});

	test("keeps item sessions and slices independent per section", () => {
		const controller = makeController();
		controller.updateSectionSession("section-1", makeSnapshot());
		controller.updateSectionSession("section-2", {
			itemSessions: {},
		});

		expect(controller.getSectionSession("section-1")?.formative).toBeDefined();
		expect(controller.getSectionSession("section-2")?.formative).toBeUndefined();
	});

	test("a null section session clears the slices", () => {
		const controller = makeController();
		controller.updateSectionSession("section-1", makeSnapshot());
		controller.updateSectionSession("section-1", null);

		expect(controller.getSectionSession("section-1")).toBeNull();
	});
});
