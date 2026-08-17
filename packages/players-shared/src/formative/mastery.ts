import type { FormativeItemState, FormativeMasteryRollup } from "./types.js";

export const FORMATIVE_MASTERY_VERSION = 1 as const;

/**
 * Roll Try outcomes up to the section.
 *
 * The denominator is the load-bearing decision. An item whose last outcome was
 * `"unknown"` — a rubric item, or one whose element ships no controller — is
 * excluded rather than counted wrong, because counting it wrong would report a
 * false negative to whatever consumes the rollup. An *untried* item is not
 * excluded: nothing yet says it cannot be scored, so it keeps the section from
 * reading as complete after one correct answer.
 */
export function rollupFormativeMastery(args: {
	itemIdentifiers: readonly string[];
	states: Record<string, FormativeItemState>;
}): FormativeMasteryRollup {
	const identifiers = args.itemIdentifiers ?? [];
	const totalItems = identifiers.length;
	let notScorableItems = 0;
	let masteredItems = 0;
	let triedItems = 0;
	let triesToMasteryTotal = 0;

	for (const identifier of identifiers) {
		const state = args.states?.[identifier];
		if (!state) continue;
		if (state.tryCount > 0) triedItems += 1;
		if (state.lastOutcome?.correctness === "unknown") notScorableItems += 1;
		if (typeof state.firstCorrectTry === "number") {
			masteredItems += 1;
			triesToMasteryTotal += state.firstCorrectTry;
		}
	}

	const scorableItems = Math.max(0, totalItems - notScorableItems);
	return {
		version: FORMATIVE_MASTERY_VERSION,
		totalItems,
		scorableItems,
		masteredItems,
		triedItems,
		averageTriesToMastery:
			masteredItems > 0 ? triesToMasteryTotal / masteredItems : undefined,
		// A section with nothing scorable is never vacuously complete.
		complete: scorableItems > 0 && masteredItems === scorableItems,
	};
}
