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

import {
	applyElementVersionOverridesPreserveTags,
	type ElementOverrides,
} from "@pie-players/pie-players-shared/pie";
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * The pie-elements-ng packages the demos install, and the versions they load
 * under the `esm` and `preloaded` strategies.
 *
 * demo-ui depends on each package at the `next` dist-tag, `bun.lock` pins the
 * version, and `bun update` moves them all to the newest release together.
 * item-demos and section-demos declare some of them at `next` too and load
 * those modules from their own resolution, so `check:lock-consistency` fails
 * when the lock resolves them to another build than demo-ui's. Under `dev:cdn` each manifest, and so each version, is the local
 * pie-elements-ng checkout's.
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

/** The element loading strategies a demo's `?player` param selects. */
export const DEMO_STRATEGIES = ["iife", "esm", "preloaded"] as const;
export type DemoStrategy = (typeof DEMO_STRATEGIES)[number];

/**
 * The strategy a demo loads elements with when `?player` names none. `iife`
 * builds its bundles on the production bundle service, so a demo asks for it
 * only to exercise that strategy.
 */
export const DEFAULT_DEMO_STRATEGY: DemoStrategy = "esm";

export function demoStrategy(value: string | null | undefined): DemoStrategy {
	return DEMO_STRATEGIES.find((strategy) => strategy === value) ??
		DEFAULT_DEMO_STRATEGY;
}

/**
 * The element version overrides demo content takes for a player strategy: the
 * installed versions under `esm`, none otherwise. The `preloaded` strategy
 * keeps the authored versions, which the players align to the registered ones.
 * Overrides from the URL apply on top.
 */
export function strategyElementVersions(
	strategy: string | null | undefined,
): Record<string, string> {
	return demoStrategy(strategy) === "esm" ? { ...ESM_DEMO_ELEMENT_VERSIONS } : {};
}

/**
 * Deep-clone a section and apply element version overrides to every nested
 * item and passage config via `applyElementVersionOverridesPreserveTags`.
 *
 * Custom-element tag names are preserved intact (required by the PIE element
 * versioning contract); only the `config.elements[*]` package spec values are
 * bumped to the override version.
 *
 * When no overrides are set the original section reference is returned.
 */
export function applyOverridesToSection(
	section: AssessmentSection | null | undefined,
	overrides: ElementOverrides,
): AssessmentSection | null {
	if (!section) return null;
	if (!overrides || Object.keys(overrides).length === 0) {
		return section;
	}

	const walk = (current: AssessmentSection): AssessmentSection => {
		const next: AssessmentSection = { ...current };

		if (Array.isArray(current.assessmentItemRefs)) {
			next.assessmentItemRefs = current.assessmentItemRefs.map((ref) => {
				const itemConfig = (ref?.item as any)?.config;
				if (!itemConfig) return ref;
				const overriddenConfig = applyElementVersionOverridesPreserveTags(
					itemConfig,
					overrides,
				);
				if (overriddenConfig === itemConfig) return ref;
				return {
					...ref,
					item: {
						...(ref.item as any),
						config: overriddenConfig,
					},
				};
			});
		}

		if (Array.isArray(current.rubricBlocks)) {
			next.rubricBlocks = current.rubricBlocks.map((rb) => {
				const passage = (rb as any)?.passage;
				const passageConfig = passage?.config;
				if (!passage || !passageConfig) return rb;
				const overriddenConfig = applyElementVersionOverridesPreserveTags(
					passageConfig,
					overrides,
				);
				if (overriddenConfig === passageConfig) return rb;
				return {
					...rb,
					passage: {
						...passage,
						config: overriddenConfig,
					},
				};
			});
		}

		if (Array.isArray(current.sections)) {
			next.sections = current.sections.map(walk);
		}

		return next;
	};

	return walk(section);
}
