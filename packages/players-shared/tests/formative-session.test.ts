import { describe, expect, test } from "bun:test";
import {
	FORMATIVE_SLICE_VERSION,
	normalizeFormativeSectionSlice,
	toFormativeSectionSlice,
	type FormativeItemState,
} from "../src/formative/index.js";

const state = (
	overrides: Partial<FormativeItemState> & { itemIdentifier: string },
): FormativeItemState => ({
	version: 1,
	tryCount: 0,
	revealed: false,
	...overrides,
});

describe("toFormativeSectionSlice", () => {
	test("stamps the slice version", () => {
		const slice = toFormativeSectionSlice({
			q1: state({ itemIdentifier: "q1", tryCount: 1, revealed: true }),
		});
		expect(slice.version).toBe(FORMATIVE_SLICE_VERSION);
		expect(slice.items.q1?.tryCount).toBe(1);
	});
});

describe("normalizeFormativeSectionSlice", () => {
	const allowedItemIdentifiers = ["q1", "q2"];

	test("an absent slice is null, indistinguishable from a pre-formative save", () => {
		expect(
			normalizeFormativeSectionSlice({ slice: undefined, allowedItemIdentifiers }),
		).toBeNull();
		expect(
			normalizeFormativeSectionSlice({ slice: null, allowedItemIdentifiers }),
		).toBeNull();
	});

	test("an unknown slice version is rejected whole", () => {
		expect(
			normalizeFormativeSectionSlice({
				slice: { version: 2, items: { q1: state({ itemIdentifier: "q1" }) } },
				allowedItemIdentifiers,
			}),
		).toBeNull();
	});

	test("round-trips a full state", () => {
		const original: Record<string, FormativeItemState> = {
			q1: state({
				itemIdentifier: "q1",
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
			}),
		};
		const restored = normalizeFormativeSectionSlice({
			slice: toFormativeSectionSlice(original),
			allowedItemIdentifiers,
		});
		expect(restored).toEqual(original);
	});

	test("round-trips each correctness value", () => {
		for (const correctness of [
			"correct",
			"partial",
			"incorrect",
			"unknown",
		] as const) {
			const restored = normalizeFormativeSectionSlice({
				slice: toFormativeSectionSlice({
					q1: state({
						itemIdentifier: "q1",
						tryCount: 1,
						lastOutcome: {
							correctness,
							scoredElementCount: correctness === "unknown" ? 0 : 1,
							totalElementCount: 1,
						},
					}),
				}),
				allowedItemIdentifiers,
			});
			expect(restored?.q1?.lastOutcome?.correctness).toBe(correctness);
		}
	});

	test("state for an item no longer in the section is dropped", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: state({ itemIdentifier: "q1", tryCount: 1 }),
					removed: state({ itemIdentifier: "removed", tryCount: 5 }),
				},
			},
			allowedItemIdentifiers,
		});
		expect(Object.keys(restored ?? {})).toEqual(["q1"]);
	});

	test("an item state of an unknown version is dropped without failing the slice", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: { ...state({ itemIdentifier: "q1", tryCount: 1 }), version: 9 },
					q2: state({ itemIdentifier: "q2", tryCount: 2 }),
				},
			},
			allowedItemIdentifiers,
		});
		expect(Object.keys(restored ?? {})).toEqual(["q2"]);
	});

	test("the identifier comes from the key, not from the payload", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: { q1: state({ itemIdentifier: "spoofed", tryCount: 1 }) },
			},
			allowedItemIdentifiers,
		});
		expect(restored?.q1?.itemIdentifier).toBe("q1");
	});

	test("garbage fields are dropped rather than trusted", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: {
						version: 1,
						itemIdentifier: "q1",
						tryCount: -4,
						revealed: "yes",
						firstCorrectTry: 0,
						lastOutcome: { correctness: "brilliant" },
					},
					q2: {
						version: 1,
						itemIdentifier: "q2",
						tryCount: 1,
						revealed: "yes",
						firstCorrectTry: 0,
						lastOutcome: { correctness: "brilliant" },
					},
				},
			},
			allowedItemIdentifiers,
		});
		// `q1` had an unusable try count, so it is dropped entirely.
		expect(Object.keys(restored ?? {})).toEqual(["q2"]);
		expect(restored?.q2).toEqual({
			version: 1,
			itemIdentifier: "q2",
			tryCount: 1,
			revealed: false,
			lastOutcome: undefined,
			firstCorrectTry: undefined,
		});
	});
});

describe("normalizeFormativeSectionSlice extras", () => {
	const allowedItemIdentifiers = ["q1"];

	test("round-trips raw element outcomes and a host reveal override", () => {
		const original: Record<string, FormativeItemState> = {
			q1: state({
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: true,
				revealOverride: "solution",
				lastOutcome: {
					correctness: "incorrect",
					points: 0,
					max: 1,
					scoredElementCount: 1,
					totalElementCount: 1,
					elementOutcomes: [{ id: "m1", score: 0, traceLog: ["x"] }],
				},
			}),
		};
		expect(
			normalizeFormativeSectionSlice({
				slice: toFormativeSectionSlice(original),
				allowedItemIdentifiers,
			}),
		).toEqual(original);
	});

	test("a bogus reveal override is dropped, leaving the policy in charge", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: {
						version: 1,
						itemIdentifier: "q1",
						tryCount: 1,
						revealed: true,
						revealOverride: "everything",
					},
				},
			},
			allowedItemIdentifiers,
		});
		expect(restored?.q1?.revealOverride).toBeUndefined();
		expect(restored?.q1?.revealed).toBe(true);
	});

	test("element outcomes survive as objects and reject non-objects", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: {
						version: 1,
						itemIdentifier: "q1",
						tryCount: 1,
						revealed: false,
						lastOutcome: {
							correctness: "correct",
							scoredElementCount: 1,
							totalElementCount: 3,
							elementOutcomes: [{ id: "m1" }, null, "nope", ["nested"]],
						},
					},
				},
			},
			allowedItemIdentifiers,
		});
		expect(restored?.q1?.lastOutcome?.elementOutcomes).toEqual([{ id: "m1" }]);
	});

	test("a non-array elementOutcomes is dropped rather than coerced", () => {
		const restored = normalizeFormativeSectionSlice({
			slice: {
				version: FORMATIVE_SLICE_VERSION,
				items: {
					q1: {
						version: 1,
						itemIdentifier: "q1",
						tryCount: 1,
						revealed: false,
						lastOutcome: {
							correctness: "correct",
							scoredElementCount: 1,
							totalElementCount: 1,
							elementOutcomes: { id: "m1" },
						},
					},
				},
			},
			allowedItemIdentifiers,
		});
		expect(restored?.q1?.lastOutcome?.elementOutcomes).toBeUndefined();
	});
});
