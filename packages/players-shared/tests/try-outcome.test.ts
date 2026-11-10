import { describe, expect, test } from "bun:test";
import { aggregateTryOutcome } from "../src/item-session-control/index.js";

describe("aggregateTryOutcome", () => {
	test("no outcomes at all is unknown, not incorrect", () => {
		expect(aggregateTryOutcome([])).toEqual({
			correctness: "unknown",
			scoredElementCount: 0,
			totalElementCount: 0,
		});
		expect(aggregateTryOutcome(null).correctness).toBe("unknown");
	});

	test("a rubric-only item is unknown and still counts its element", () => {
		// `provideScore()` leaves an `undefined` slot for every model whose element
		// or controller was missing, which is the rubric case.
		const outcome = aggregateTryOutcome([undefined]);
		expect(outcome.correctness).toBe("unknown");
		expect(outcome.scoredElementCount).toBe(0);
		expect(outcome.totalElementCount).toBe(1);
		expect(outcome.points).toBeUndefined();
	});

	test("a single scored outcome is used directly", () => {
		expect(aggregateTryOutcome([{ score: 2, max: 4 }])).toMatchObject({
			correctness: "partial",
			points: 2,
			max: 4,
		});
	});

	test("a missing max normalizes to 1", () => {
		expect(aggregateTryOutcome([{ score: 1 }])).toMatchObject({
			correctness: "correct",
			points: 1,
			max: 1,
		});
	});

	test("full and zero credit classify at the boundaries", () => {
		expect(aggregateTryOutcome([{ score: 4, max: 4 }]).correctness).toBe(
			"correct",
		);
		expect(aggregateTryOutcome([{ score: 0, max: 4 }]).correctness).toBe(
			"incorrect",
		);
	});

	test("several scored outcomes average their normalized fractions", () => {
		const outcome = aggregateTryOutcome([
			{ score: 1, max: 1 },
			{ score: 0, max: 1 },
		]);
		expect(outcome).toMatchObject({ correctness: "partial", points: 0.5, max: 1 });
		expect(outcome.scoredElementCount).toBe(2);
	});

	test("three full-credit elements do not round down to partial", () => {
		// 1/3 + 1/3 + 1/3 lands a hair under 1 in binary floating point; reporting
		// that as partial credit would be visible to a learner.
		const outcome = aggregateTryOutcome([
			{ score: 3, max: 3 },
			{ score: 3, max: 3 },
			{ score: 3, max: 3 },
		]);
		expect(outcome.correctness).toBe("correct");
	});

	test("unscored slots are excluded from the average but counted in the total", () => {
		const outcome = aggregateTryOutcome([
			{ score: 1, max: 1 },
			undefined,
			{ score: 1, max: 1 },
		]);
		expect(outcome).toMatchObject({ correctness: "correct", points: 1, max: 1 });
		expect(outcome.scoredElementCount).toBe(2);
		expect(outcome.totalElementCount).toBe(3);
	});

	test("a non-numeric or non-finite score does not count as scored", () => {
		expect(
			aggregateTryOutcome([
				{ score: Number.NaN },
				{ score: "1" as never },
			]).correctness,
		).toBe("unknown");
	});

	test("an out-of-range score clamps instead of reading as full credit", () => {
		expect(aggregateTryOutcome([{ score: 9, max: 4 }])).toMatchObject({
			correctness: "correct",
			points: 4,
		});
		expect(aggregateTryOutcome([{ score: -3, max: 4 }])).toMatchObject({
			correctness: "incorrect",
			points: 0,
		});
	});

	test("a zero denominator normalizes rather than dividing by zero", () => {
		expect(aggregateTryOutcome([{ score: 1, max: 0 }])).toMatchObject({
			correctness: "correct",
			max: 1,
		});
	});
});

describe("raw element outcomes", () => {
	test("are retained verbatim for a host rendering its own feedback", () => {
		const raw = [
			{ id: "m1", element: "multiple-choice", score: 0, traceLog: ["a", "b"] },
			{ id: "m2", element: "text-entry", score: 1 },
		];
		const outcome = aggregateTryOutcome(raw);
		expect(outcome.elementOutcomes).toEqual(raw);
		// Same objects, not copies: the aggregate does not reshape element output.
		expect(outcome.elementOutcomes?.[0]).toBe(raw[0]);
	});

	test("empty slots are dropped but still counted in the total", () => {
		const outcome = aggregateTryOutcome([
			{ id: "m1", score: 1 },
			undefined,
		]);
		expect(outcome.elementOutcomes).toHaveLength(1);
		expect(outcome.totalElementCount).toBe(2);
	});

	test("a rubric-only item keeps no outcomes at all", () => {
		expect(aggregateTryOutcome([undefined]).elementOutcomes).toBeUndefined();
		expect(aggregateTryOutcome([]).elementOutcomes).toBeUndefined();
	});

	test("an unscored but present outcome is still retained", () => {
		// No numeric score, so it does not aggregate — but a host may still want it.
		const outcome = aggregateTryOutcome([{ id: "m1", element: "rubric" }]);
		expect(outcome.correctness).toBe("unknown");
		expect(outcome.elementOutcomes).toHaveLength(1);
	});
});
