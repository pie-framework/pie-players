/**
 * Element Loader — element aggregation utilities.
 *
 * The deep `ElementLoader` primitive lives in `./element-loader.ts`. This
 * module owns the shared `ElementMap` type and the `aggregateElements`
 * helper that reduces many items' element declarations into a single
 * deduplicated, version-aware map (used by the section-player to
 * pre-warm in one shot).
 */

import { parsePackageName } from "../pie/utils.js";
import type { ItemEntity } from "../types/index.js";

/**
 * Map of element tag names to their package versions
 * Example: { "pie-multiple-choice": "@pie-element/multiple-choice@11.0.1" }
 */
export type ElementMap = { [tagName: string]: string };

/**
 * Aggregate unique elements from multiple items
 *
 * Extracts elements from all item configs and deduplicates them.
 * Throws an error if items require different versions of the same element.
 *
 * @param items - Array of items to aggregate elements from
 * @returns Map of unique element tag names to package versions
 * @throws Error if element version conflicts are detected
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
 * //   "pie-mc": "@pie-element/mc@11.0.1",
 * //   "pie-hotspot": "@pie-element/hotspot@9.0.0"
 * // }
 * ```
 */
export function aggregateElements(items: ItemEntity[]): ElementMap {
	const elementMap: Record<string, string> = {};
	const seenOriginalTags: Record<string, string> = {};

	const VERSION_DELIMITER = "--version-";
	const parseTagName = (
		tagName: string,
	): { baseName: string; existingVersion?: string } => {
		const versionMatch = tagName.match(`${VERSION_DELIMITER}(\\d+-\\d+-\\d+)$`);
		return versionMatch
			? {
					baseName: tagName.replace(`${VERSION_DELIMITER}${versionMatch[1]}`, ""),
					existingVersion: versionMatch[1].replace(/-/g, "."),
				}
			: { baseName: tagName };
	};
	const normalizeElementTag = (tagName: string, packageSpec: string): string => {
		const { baseName, existingVersion } = parseTagName(tagName);
		const { version } = parsePackageName(packageSpec);
		if (!version || existingVersion === version) return tagName;
		return `${baseName}${VERSION_DELIMITER}${version.replace(/\./g, "-")}`;
	};

	items.forEach((item) => {
		const itemElements = item.config?.elements || {};

		Object.entries(itemElements).forEach(([tag, pkg]) => {
			const packageSpec = String(pkg);
			if (!seenOriginalTags[tag]) {
				seenOriginalTags[tag] = packageSpec;
			} else if (seenOriginalTags[tag] !== packageSpec) {
				// Preserve existing conflict behavior for repeated original tags.
				throw new Error(
					`Element version conflict: ${tag} requires both ${seenOriginalTags[tag]} and ${packageSpec}. ` +
						`All items in a section must use the same version of each element.`,
				);
			}

			const normalizedTag = normalizeElementTag(tag, packageSpec);
			if (!elementMap[normalizedTag]) {
				elementMap[normalizedTag] = packageSpec;
			} else if (elementMap[normalizedTag] !== packageSpec) {
				throw new Error(
					`Element version conflict: ${normalizedTag} requires both ${elementMap[normalizedTag]} and ${packageSpec}. ` +
						`All items in a section must use the same version of each element.`,
				);
			}
		});
	});

	return elementMap;
}
