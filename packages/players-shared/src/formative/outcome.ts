import type {
	FormativeCorrectness,
	FormativeScoredOutcome,
	FormativeTryOutcome,
} from "./types.js";

/**
 * Full credit is a float comparison, so it needs a tolerance. Averaging
 * normalized fractions ("1/3 + 1/3 + 1/3") lands a hair under 1 in binary
 * floating point, and reporting that as partial credit would be a defect
 * visible to a learner.
 */
const FULL_CREDIT_EPSILON = 1e-9;

function isScored(
	outcome: FormativeScoredOutcome | null | undefined,
): outcome is FormativeScoredOutcome & { score: number } {
	return (
		!!outcome &&
		typeof outcome.score === "number" &&
		Number.isFinite(outcome.score)
	);
}

/** A denominator of 0 or a missing `max` both mean "normalized to 1". */
function denominatorOf(outcome: FormativeScoredOutcome): number {
	const max = outcome.max;
	return typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 1;
}

/**
 * Retained verbatim for a host rendering its own feedback. Empty slots are
 * dropped rather than preserved as holes: every real entry identifies its own
 * model, and `null` in a persisted array carries no information a host could
 * use.
 */
function definedOutcomes(
	outcomes: ReadonlyArray<FormativeScoredOutcome | null | undefined>,
): FormativeScoredOutcome[] | undefined {
	const defined = outcomes.filter(
		(outcome): outcome is FormativeScoredOutcome =>
			!!outcome && typeof outcome === "object",
	);
	return defined.length > 0 ? defined : undefined;
}

function classify(points: number, max: number): FormativeCorrectness {
	if (max <= 0) return "unknown";
	if (points + FULL_CREDIT_EPSILON >= max) return "correct";
	if (points <= 0) return "incorrect";
	return "partial";
}

/**
 * Reduce the array `pie-item-player.provideScore()` returns to one Try outcome.
 *
 * The aggregation mirrors the policy the persisted API scoring path already
 * documents (`docs/item-player/scoring-and-rubrics.md`), so a browser-derived
 * formative result and a server-derived score do not disagree about what a
 * multi-element item is worth:
 *
 * - one scored outcome: `points = score`, `max = max ?? 1`;
 * - several: the mean of normalized fractions, with `max = 1`;
 * - none scored: `"unknown"`, no points.
 *
 * `provideScore()` returns `undefined` in the slot of any model whose element or
 * controller was missing, which is exactly the rubric and no-controller case, so
 * those slots count toward `totalElementCount` and not toward
 * `scoredElementCount`.
 */
export function aggregateFormativeOutcome(
	outcomes: ReadonlyArray<FormativeScoredOutcome | null | undefined> | null,
): FormativeTryOutcome {
	const all = Array.isArray(outcomes) ? outcomes : [];
	const scored = all.filter(isScored);
	const totalElementCount = all.length;

	if (scored.length === 0) {
		return {
			correctness: "unknown",
			scoredElementCount: 0,
			totalElementCount,
			elementOutcomes: definedOutcomes(all),
		};
	}

	let points: number;
	let max: number;
	if (scored.length === 1) {
		const only = scored[0];
		max = denominatorOf(only);
		points = only.score;
	} else {
		max = 1;
		points =
			scored.reduce(
				(total, outcome) => total + outcome.score / denominatorOf(outcome),
				0,
			) / scored.length;
	}

	// An element reporting more than its own maximum is an element defect. The
	// aggregate is a ratio, so an out-of-range input has no meaning here; clamp
	// rather than let it read as full credit on a partially correct response.
	const clamped = Math.min(Math.max(points, 0), max);

	return {
		correctness: classify(clamped, max),
		points: clamped,
		max,
		scoredElementCount: scored.length,
		totalElementCount,
		elementOutcomes: definedOutcomes(all),
	};
}
