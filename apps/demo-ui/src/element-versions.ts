/**
 * The pie-elements-ng versions demo content loads under the `esm` strategy.
 *
 * npm `latest` of `@pie-element/*` is the legacy line, which publishes no
 * browser ESM, so `?player=esm` rewrites demo content to these exact versions.
 * Each publishes `./browser/delivery` and `./browser/controller`.
 */
export const ESM_DEMO_ELEMENT_VERSIONS: Readonly<Record<string, string>> =
	Object.freeze({
		"@pie-element/categorize": "13.2.0-next.17",
		"@pie-element/charting": "12.1.2-next.18",
		"@pie-element/complex-rubric": "7.1.2-next.17",
		"@pie-element/drag-in-the-blank": "10.2.0-next.17",
		"@pie-element/drawing-response": "12.1.2-next.17",
		"@pie-element/ebsr": "14.2.2-next.18",
		"@pie-element/explicit-constructed-response": "11.1.2-next.18",
		"@pie-element/extended-text-entry": "15.1.2-next.17",
		"@pie-element/fraction-model": "6.1.2-next.17",
		"@pie-element/graphing": "10.1.2-next.18",
		"@pie-element/graphing-solution-set": "6.1.2-next.18",
		"@pie-element/hotspot": "11.2.0-next.17",
		"@pie-element/image-cloze-association": "10.2.0-next.17",
		"@pie-element/inline-dropdown": "10.1.2-next.17",
		"@pie-element/likert": "4.1.2-next.16",
		"@pie-element/match": "12.1.2-next.17",
		"@pie-element/match-list": "7.1.2-next.17",
		"@pie-element/math-inline": "12.1.1-next.28",
		"@pie-element/math-templated": "7.1.1-next.28",
		"@pie-element/matrix": "4.1.2-next.16",
		"@pie-element/multi-trait-rubric": "8.1.2-next.16",
		"@pie-element/multiple-choice": "13.4.0-next.13",
		"@pie-element/number-line": "13.1.2-next.16",
		"@pie-element/passage": "7.1.2-next.17",
		"@pie-element/placement-ordering": "14.1.2-next.18",
		"@pie-element/rubric": "8.1.2-next.16",
		"@pie-element/select-text": "13.1.2-next.18",
	});

/**
 * The element version overrides demo content takes for a player strategy: the
 * ESM versions under `esm`, none otherwise. Overrides from the URL apply on top.
 */
export function strategyElementVersions(
	strategy: string | null | undefined,
): Record<string, string> {
	return strategy === "esm" ? { ...ESM_DEMO_ELEMENT_VERSIONS } : {};
}
