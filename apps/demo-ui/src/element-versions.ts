import categorize from "@pie-element/categorize/package.json";
import charting from "@pie-element/charting/package.json";
import complexRubric from "@pie-element/complex-rubric/package.json";
import dragInTheBlank from "@pie-element/drag-in-the-blank/package.json";
import drawingResponse from "@pie-element/drawing-response/package.json";
import ebsr from "@pie-element/ebsr/package.json";
import explicitConstructedResponse from "@pie-element/explicit-constructed-response/package.json";
import extendedTextEntry from "@pie-element/extended-text-entry/package.json";
import fractionModel from "@pie-element/fraction-model/package.json";
import graphing from "@pie-element/graphing/package.json";
import graphingSolutionSet from "@pie-element/graphing-solution-set/package.json";
import hotspot from "@pie-element/hotspot/package.json";
import imageClozeAssociation from "@pie-element/image-cloze-association/package.json";
import inlineDropdown from "@pie-element/inline-dropdown/package.json";
import likert from "@pie-element/likert/package.json";
import match from "@pie-element/match/package.json";
import matchList from "@pie-element/match-list/package.json";
import mathInline from "@pie-element/math-inline/package.json";
import mathTemplated from "@pie-element/math-templated/package.json";
import matrix from "@pie-element/matrix/package.json";
import mcPopulatedBlank from "@pie-element/mc-populated-blank/package.json";
import multiTraitRubric from "@pie-element/multi-trait-rubric/package.json";
import multipleChoice from "@pie-element/multiple-choice/package.json";
import numberLine from "@pie-element/number-line/package.json";
import passage from "@pie-element/passage/package.json";
import placementOrdering from "@pie-element/placement-ordering/package.json";
import rubric from "@pie-element/rubric/package.json";
import selectText from "@pie-element/select-text/package.json";

/**
 * The pie-elements-ng packages the demos install, and the versions they load
 * under the `esm` and `preloaded` strategies.
 *
 * npm `latest` of `@pie-element/*` is the legacy line, which publishes no
 * browser ESM; pie-elements-ng publishes to the `next` dist-tag. demo-ui
 * depends on each package at `next`, `bun.lock` pins the version, and
 * `bun update` moves them all to the newest release together. Under `dev:cdn`
 * each manifest, and so each version, is the local pie-elements-ng checkout's.
 */
const MANIFESTS: ReadonlyArray<{ name: string; version: string }> = [
	categorize,
	charting,
	complexRubric,
	dragInTheBlank,
	drawingResponse,
	ebsr,
	explicitConstructedResponse,
	extendedTextEntry,
	fractionModel,
	graphing,
	graphingSolutionSet,
	hotspot,
	imageClozeAssociation,
	inlineDropdown,
	likert,
	match,
	matchList,
	mathInline,
	mathTemplated,
	matrix,
	mcPopulatedBlank,
	multiTraitRubric,
	multipleChoice,
	numberLine,
	passage,
	placementOrdering,
	rubric,
	selectText,
];

export const ESM_DEMO_ELEMENT_VERSIONS: Readonly<Record<string, string>> =
	Object.freeze(
		Object.fromEntries(MANIFESTS.map(({ name, version }) => [name, version])),
	);

/**
 * The element version overrides demo content takes for a player strategy: the
 * installed versions under `esm`, none otherwise. The `preloaded` strategy
 * keeps the authored versions, which the players align to the registered ones.
 * Overrides from the URL apply on top.
 */
export function strategyElementVersions(
	strategy: string | null | undefined,
): Record<string, string> {
	return strategy === "esm" ? { ...ESM_DEMO_ELEMENT_VERSIONS } : {};
}
