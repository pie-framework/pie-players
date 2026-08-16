import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	FormativeDeliveryPolicy,
	FormativeItemPolicy,
	ItemEntity,
} from "@pie-players/pie-players-shared";
import { SectionController } from "../src/controllers/SectionController";
import type { SectionControllerChangeEvent } from "../src/controllers/types";

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: { elements: {}, models: [], markup: "<div></div>" },
	} as unknown as ItemEntity;
}

function makeSection(args: {
	formative?: FormativeDeliveryPolicy;
	items: Array<{ identifier: string; formative?: FormativeItemPolicy }>;
}): AssessmentSection {
	return {
		identifier: "formative-section",
		formative: args.formative,
		assessmentItemRefs: args.items.map((entry) => ({
			identifier: entry.identifier,
			item: makeItem(`${entry.identifier}-item`),
			formative: entry.formative,
		})),
		rubricBlocks: [],
	} as unknown as AssessmentSection;
}

async function bootstrap(section: AssessmentSection): Promise<{
	controller: SectionController;
	events: SectionControllerChangeEvent[];
}> {
	const controller = new SectionController();
	await controller.initialize({
		section,
		sectionId: "formative-section",
		assessmentId: "assessment-1",
		view: ["candidate"],
	});
	const events: SectionControllerChangeEvent[] = [];
	controller.subscribe((event) => events.push(event));
	return { controller, events };
}

/** Shaped like what `provideScore()` returns: one entry per model. */
const scored = (score: number, max = 1) => [{ score, max }];

describe("SectionController formative delivery", () => {
	test("a section without a formative policy produces no projection", async () => {
		const { controller } = await bootstrap(
			makeSection({ items: [{ identifier: "q1" }] }),
		);
		expect(controller.getFormativeProjection()).toBeNull();
		expect(controller.getCompositionModel().formative).toBeNull();
		// And the persistence snapshot stays byte-identical to a pre-formative save.
		expect(controller.getSession()).not.toHaveProperty("formative");
	});

	test("recording a try on a non-formative section is a no-op", async () => {
		const { controller, events } = await bootstrap(
			makeSection({ items: [{ identifier: "q1" }] }),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(1) });
		expect(events).toHaveLength(0);
	});

	test("the projection carries resolved policies and reaches the composition model", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 2 },
				items: [{ identifier: "q1" }, { identifier: "q2", formative: { maxTries: 5 } }],
			}),
		);
		const projection = controller.getCompositionModel().formative;
		expect(projection).toMatchObject({ version: 1, enabled: true });
		expect(projection?.policies.q1?.maxTries).toBe(2);
		expect(projection?.policies.q2?.maxTries).toBe(5);
		expect(projection?.mastery).toMatchObject({
			totalItems: 2,
			scorableItems: 2,
			masteredItems: 0,
			complete: false,
		});
	});

	test("a try derives correctness, reveals feedback, and emits both events", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 2 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(1) });

		const tryEvent = events.find((event) => event.type === "formative-try-recorded");
		expect(tryEvent).toMatchObject({
			itemId: "q1",
			canonicalItemId: "q1",
			tryCount: 1,
			revealed: true,
		});
		expect(
			tryEvent && "outcome" in tryEvent ? tryEvent.outcome.correctness : null,
		).toBe("correct");

		const masteryEvent = events.find(
			(event) => event.type === "section-mastery-changed",
		);
		expect(
			masteryEvent && "mastery" in masteryEvent ? masteryEvent.mastery : null,
		).toMatchObject({ masteredItems: 1, scorableItems: 1, complete: true });
	});

	test("a rubric-shaped item records a try as unknown and leaves the denominator", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true },
				items: [{ identifier: "q1" }, { identifier: "rubric" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(1) });
		// `provideScore()` leaves an undefined slot where no controller was found.
		controller.recordFormativeTry({ itemId: "rubric", outcomes: [undefined] });

		const projection = controller.getFormativeProjection();
		expect(projection?.states.rubric?.lastOutcome?.correctness).toBe("unknown");
		expect(projection?.mastery).toMatchObject({
			totalItems: 2,
			scorableItems: 1,
			masteredItems: 1,
			complete: true,
		});
	});

	test("a second try before a retry is dropped rather than spending a try", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 3 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(1) });
		expect(
			events.filter((event) => event.type === "formative-try-recorded"),
		).toHaveLength(1);
		expect(controller.getFormativeProjection()?.states.q1?.tryCount).toBe(1);
	});

	test("a retry reopens the item and emits without changing the try count", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 3 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		controller.retryFormativeItem({ itemId: "q1" });

		expect(
			events.find((event) => event.type === "formative-reveal-changed"),
		).toMatchObject({
			itemId: "q1",
			canonicalItemId: "q1",
			tryCount: 1,
			revealed: false,
			source: "learner",
		});
		expect(controller.getFormativeProjection()?.states.q1).toMatchObject({
			tryCount: 1,
			revealed: false,
		});
	});

	test("mastery emits only when the rollup changes", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 3 },
				items: [{ identifier: "q1" }, { identifier: "q2" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		const afterFirst = events.filter(
			(event) => event.type === "section-mastery-changed",
		).length;
		controller.retryFormativeItem({ itemId: "q1" });
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		// Two wrong tries running: `triedItems` did not move and neither did mastery.
		expect(
			events.filter((event) => event.type === "section-mastery-changed"),
		).toHaveLength(afterFirst);
	});

	test("the slice persists and hydrates", async () => {
		const section = makeSection({
			formative: { enabled: true, maxTries: 3 },
			items: [{ identifier: "q1" }],
		});
		const { controller } = await bootstrap(section);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(1) });
		const saved = controller.getSession();
		expect(saved?.formative).toMatchObject({ version: 1 });
		expect(saved?.formative?.items.q1).toMatchObject({
			tryCount: 1,
			revealed: true,
			firstCorrectTry: 1,
		});

		const { controller: restored } = await bootstrap(section);
		await restored.applySession(saved, { mode: "replace" });
		expect(restored.getFormativeProjection()?.states.q1).toMatchObject({
			tryCount: 1,
			revealed: true,
			firstCorrectTry: 1,
		});
	});

	test("a rejected slice restarts tries and leaves item sessions applied", async () => {
		const section = makeSection({
			formative: { enabled: true, maxTries: 3 },
			items: [{ identifier: "q1" }],
		});
		const { controller } = await bootstrap(section);
		await controller.applySession(
			{
				itemSessions: { q1: { id: "session-1", data: [{ id: "1" }] } },
				formative: { version: 99, items: {} } as never,
			},
			{ mode: "replace" },
		);
		expect(controller.getFormativeProjection()?.states).toEqual({});
		expect(controller.getResolvedItemSessions().q1).toBeDefined();
	});

	test("a same-cohort input refresh rebuilds policy and keeps try state", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 2 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		await controller.updateInput({
			section: makeSection({
				formative: { enabled: true, maxTries: 5 },
				items: [{ identifier: "q1" }],
			}),
			sectionId: "formative-section",
			assessmentId: "assessment-1",
			view: ["candidate"],
		});
		const projection = controller.getFormativeProjection();
		expect(projection?.policies.q1?.maxTries).toBe(5);
		expect(projection?.states.q1?.tryCount).toBe(1);
	});

	test("a host can force a reveal on an untried item without spending a try", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 3, feedback: "correctness" },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.revealFormativeItem({ itemId: "q1", feedback: "solution" });

		expect(controller.getFormativeProjection()?.states.q1).toMatchObject({
			tryCount: 0,
			revealed: true,
			revealOverride: "solution",
		});
		expect(
			events.find((event) => event.type === "formative-reveal-changed"),
		).toMatchObject({
			itemId: "q1",
			revealed: true,
			feedback: "solution",
			tryCount: 0,
			source: "host",
		});
		// A forced reveal is not an answer, so mastery is untouched.
		expect(
			events.some((event) => event.type === "section-mastery-changed"),
		).toBe(false);
	});

	test("a host can withdraw a reveal an exhausted learner could not", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 1 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		controller.retryFormativeItem({ itemId: "q1" });
		// Out of tries: the learner's retry is refused.
		expect(controller.getFormativeProjection()?.states.q1?.revealed).toBe(true);

		controller.hideFormativeItem({ itemId: "q1" });
		expect(controller.getFormativeProjection()?.states.q1).toMatchObject({
			tryCount: 1,
			revealed: false,
			revealOverride: undefined,
		});
	});

	test("a forced reveal on a non-formative item is refused", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				formative: { enabled: true },
				items: [{ identifier: "q1" }, { identifier: "q2", formative: { enabled: false } }],
			}),
		);
		controller.revealFormativeItem({ itemId: "q2", feedback: "solution" });
		expect(controller.getFormativeProjection()?.states.q2).toBeUndefined();
		expect(events).toHaveLength(0);
	});

	test("a host reveal survives persistence", async () => {
		const section = makeSection({
			formative: { enabled: true, maxTries: 3 },
			items: [{ identifier: "q1" }],
		});
		const { controller } = await bootstrap(section);
		controller.revealFormativeItem({ itemId: "q1", feedback: "solution" });
		const saved = controller.getSession();

		const { controller: restored } = await bootstrap(section);
		await restored.applySession(saved, { mode: "replace" });
		expect(restored.getFormativeProjection()?.states.q1).toMatchObject({
			revealed: true,
			revealOverride: "solution",
		});
	});

	test("the recorded outcome carries the raw element outcomes", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({
			itemId: "q1",
			outcomes: [{ id: "m1", element: "multiple-choice", score: 0 }, undefined],
		});
		const outcome =
			controller.getFormativeProjection()?.states.q1?.lastOutcome;
		expect(outcome?.totalElementCount).toBe(2);
		expect(outcome?.elementOutcomes).toEqual([
			{ id: "m1", element: "multiple-choice", score: 0 },
		]);
	});

	test("the projection is a copy, so a caller cannot mutate controller state", async () => {
		const { controller } = await bootstrap(
			makeSection({
				formative: { enabled: true, maxTries: 3 },
				items: [{ identifier: "q1" }],
			}),
		);
		controller.recordFormativeTry({ itemId: "q1", outcomes: scored(0) });
		const projection = controller.getFormativeProjection();
		if (projection?.states.q1) projection.states.q1.tryCount = 99;
		expect(controller.getFormativeProjection()?.states.q1?.tryCount).toBe(1);
	});
});
