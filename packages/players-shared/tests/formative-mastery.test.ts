import { describe, expect, test } from "bun:test";
import {
	rollupFormativeMastery,
	type FormativeCorrectness,
	type FormativeItemState,
} from "../src/formative/index.js";

const stateOf = (
	itemIdentifier: string,
	args: {
		tryCount: number;
		correctness?: FormativeCorrectness;
		firstCorrectTry?: number;
	},
): FormativeItemState => ({
	version: 1,
	itemIdentifier,
	tryCount: args.tryCount,
	revealed: false,
	lastOutcome: args.correctness
		? {
				correctness: args.correctness,
				scoredElementCount: args.correctness === "unknown" ? 0 : 1,
				totalElementCount: 1,
			}
		: undefined,
	firstCorrectTry: args.firstCorrectTry,
});

describe("rollupFormativeMastery", () => {
	test("an empty section is not vacuously complete", () => {
		expect(
			rollupFormativeMastery({ itemIdentifiers: [], states: {} }),
		).toMatchObject({
			totalItems: 0,
			scorableItems: 0,
			masteredItems: 0,
			complete: false,
		});
	});

	test("an untried section is not complete", () => {
		expect(
			rollupFormativeMastery({
				itemIdentifiers: ["q1", "q2"],
				states: {},
			}),
		).toMatchObject({
			totalItems: 2,
			scorableItems: 2,
			masteredItems: 0,
			triedItems: 0,
			complete: false,
		});
	});

	test("one correct answer out of three does not read as complete", () => {
		// The regression this guards: counting only *outcomes seen* as the
		// denominator would report mastery after the first correct item.
		const rollup = rollupFormativeMastery({
			itemIdentifiers: ["q1", "q2", "q3"],
			states: {
				q1: stateOf("q1", {
					tryCount: 1,
					correctness: "correct",
					firstCorrectTry: 1,
				}),
			},
		});
		expect(rollup).toMatchObject({
			scorableItems: 3,
			masteredItems: 1,
			triedItems: 1,
			complete: false,
		});
	});

	test("every item mastered completes the section", () => {
		const rollup = rollupFormativeMastery({
			itemIdentifiers: ["q1", "q2"],
			states: {
				q1: stateOf("q1", { tryCount: 1, correctness: "correct", firstCorrectTry: 1 }),
				q2: stateOf("q2", { tryCount: 3, correctness: "correct", firstCorrectTry: 3 }),
			},
		});
		expect(rollup).toMatchObject({
			scorableItems: 2,
			masteredItems: 2,
			complete: true,
		});
		expect(rollup.averageTriesToMastery).toBe(2);
	});

	test("a not-scorable item leaves the denominator rather than scoring zero", () => {
		const rollup = rollupFormativeMastery({
			itemIdentifiers: ["q1", "q2", "rubric"],
			states: {
				q1: stateOf("q1", { tryCount: 1, correctness: "correct", firstCorrectTry: 1 }),
				q2: stateOf("q2", { tryCount: 1, correctness: "correct", firstCorrectTry: 1 }),
				rubric: stateOf("rubric", { tryCount: 1, correctness: "unknown" }),
			},
		});
		expect(rollup).toMatchObject({
			totalItems: 3,
			scorableItems: 2,
			masteredItems: 2,
			triedItems: 3,
			complete: true,
		});
	});

	test("a section of only not-scorable items is never complete", () => {
		expect(
			rollupFormativeMastery({
				itemIdentifiers: ["rubric"],
				states: { rubric: stateOf("rubric", { tryCount: 1, correctness: "unknown" }) },
			}),
		).toMatchObject({ scorableItems: 0, complete: false });
	});

	test("mastery survives a later incorrect try", () => {
		const rollup = rollupFormativeMastery({
			itemIdentifiers: ["q1"],
			states: {
				q1: stateOf("q1", {
					tryCount: 3,
					correctness: "incorrect",
					firstCorrectTry: 2,
				}),
			},
		});
		expect(rollup).toMatchObject({ masteredItems: 1, complete: true });
		expect(rollup.averageTriesToMastery).toBe(2);
	});

	test("state for an item outside the section is ignored", () => {
		expect(
			rollupFormativeMastery({
				itemIdentifiers: ["q1"],
				states: {
					q1: stateOf("q1", { tryCount: 1, correctness: "incorrect" }),
					stale: stateOf("stale", {
						tryCount: 1,
						correctness: "correct",
						firstCorrectTry: 1,
					}),
				},
			}),
		).toMatchObject({ totalItems: 1, masteredItems: 0, complete: false });
	});
});
