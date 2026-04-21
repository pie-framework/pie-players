import {
	applyElementVersionOverridesPreserveTags,
	type ElementOverrides,
} from "@pie-players/pie-players-shared/pie";
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import type { DemoPageEntry } from "./demo-load";

/**
 * Walk an `AssessmentSection` tree and return a map of tagKey -> packageSpec
 * aggregated across items and passages (including nested sections).
 *
 * The returned map is the shape `ElementVersionPanel` expects as `elements`.
 * Duplicate tag keys from different items collapse to the last spec seen; the
 * toolbar only uses the values, so we preserve every unique package spec by
 * prefixing the tagKey with an index when collisions occur.
 */
export function collectSectionElementsMap(
	section: AssessmentSection | null | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	let collisionCounter = 0;

	const addElements = (
		elements: unknown,
		scope: string,
	): void => {
		if (!elements || typeof elements !== "object") return;
		for (const [tagKey, spec] of Object.entries(elements as Record<string, unknown>)) {
			if (typeof spec !== "string" || spec.length === 0) continue;
			if (out[tagKey] === undefined) {
				out[tagKey] = spec;
				continue;
			}
			if (out[tagKey] === spec) continue;
			out[`${tagKey}__${scope}__${collisionCounter++}`] = spec;
		}
	};

	const walk = (current: AssessmentSection | null | undefined): void => {
		if (!current) return;

		for (const ref of current.assessmentItemRefs || []) {
			const config = (ref?.item as any)?.config;
			addElements(config?.elements, `item-${ref?.identifier || "unknown"}`);
		}

		for (const rb of current.rubricBlocks || []) {
			const config = (rb as any)?.passage?.config;
			addElements(config?.elements, `passage-${(rb as any)?.identifier || "unknown"}`);
		}

		for (const nested of current.sections || []) {
			walk(nested);
		}
	};

	walk(section);
	return out;
}

/**
 * Aggregate unique PIE element package specs across every page of a section
 * demo. Used to populate the version toolbar so the selector list is stable
 * when navigating between demo pages.
 */
export function aggregateElementsAcrossPages(
	demoPages: DemoPageEntry[],
	fallbackSection: AssessmentSection | null | undefined,
): Record<string, string> {
	if (demoPages && demoPages.length > 0) {
		const merged: Record<string, string> = {};
		let collisionCounter = 0;
		for (const page of demoPages) {
			const pageMap = collectSectionElementsMap(page?.section);
			for (const [tagKey, spec] of Object.entries(pageMap)) {
				if (merged[tagKey] === undefined) {
					merged[tagKey] = spec;
					continue;
				}
				if (merged[tagKey] === spec) continue;
				merged[`${tagKey}__page-${page.id || "unknown"}__${collisionCounter++}`] = spec;
			}
		}
		return merged;
	}
	return collectSectionElementsMap(fallbackSection);
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
