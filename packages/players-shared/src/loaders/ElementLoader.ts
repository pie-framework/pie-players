/**
 * Element Loader — element aggregation utilities.
 *
 * The deep `ElementLoader` primitive lives in `./element-loader.ts`. This
 * module owns the shared `ElementMap` type and the `aggregateElements`
 * helper that reduces many items' element declarations into a single
 * deduplicated, version-aware map (used by the section-player to
 * pre-warm in one shot).
 */

import { toPackageVersionedTag } from "../pie/versioned-tag.js";
import type { ItemEntity } from "../types/index.js";

/**
 * Map of element tag names to their package versions
 * Example: { "pie-multiple-choice": "@pie-element/multiple-choice@11.0.1" }
 */
export type ElementMap = { [tagName: string]: string };

/**
 * Aggregate unique elements from multiple items
 *
 * Extracts elements from all item configs, versions their full tag names, and
 * deduplicates identical tag/package pairs. Multiple package versions of the
 * same original tag remain distinct through their versioned tag names.
 *
 * @param items - Array of items to aggregate elements from
 * @returns Map of unique element tag names to package versions
 * @throws Error if two package specs resolve to the same versioned tag
 *
 * @example
 * ```typescript
 * const items = [
 *   { config: { elements: { "pie-mc": "@pie-element/mc@11.0.1" } } },
 *   { config: { elements: { "pie-mc": "@pie-element/mc@11.0.1" } } },
 *   { config: { elements: { "pie-hotspot": "@pie-element/hotspot@9.0.0" } } }
 * ];
 *
 * const elements = aggregateElements(items);
 * // Result: {
 * //   "pie-mc--version-11-0-1": "@pie-element/mc@11.0.1",
 * //   "pie-hotspot--version-9-0-0": "@pie-element/hotspot@9.0.0"
 * // }
 * ```
 */
export function aggregateElements(items: ItemEntity[]): ElementMap {
	const elementMap: Record<string, string> = {};

	items.forEach((item) => {
		const itemElements = item.config?.elements || {};

		Object.entries(itemElements).forEach(([tag, pkg]) => {
			const packageSpec = String(pkg);
			const normalizedTag = toPackageVersionedTag(tag, packageSpec, {
				preserveUnversionedTag: true,
			});
			if (!elementMap[normalizedTag]) {
				elementMap[normalizedTag] = packageSpec;
			} else if (elementMap[normalizedTag] !== packageSpec) {
				throw new Error(
					`Element version conflict: ${normalizedTag} requires both ${elementMap[normalizedTag]} and ${packageSpec}. ` +
						`Each full versioned tag must map to exactly one package spec.`,
				);
			}
		});
	});

	return elementMap;
}
