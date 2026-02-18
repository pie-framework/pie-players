/**
 * Element Loader - Core types and utilities for loading PIE elements
 *
 * This module provides element aggregation and loading abstractions for PIE players.
 * It enables loading multiple PIE elements in a single operation, eliminating duplicate
 * bundle requests when multiple items use the same elements.
 */

import type { BundleType } from "../pie/types.js";
import type { ItemEntity } from "../types/index.js";

/**
 * Map of element tag names to their package versions
 * Example: { "pie-multiple-choice": "@pie-element/multiple-choice@11.0.1" }
 */
export type ElementMap = { [tagName: string]: string };

/**
 * Options for loading PIE elements
 */
export interface LoadOptions {
	/** Bundle type to load (player or clientPlayer) */
	bundleType?: BundleType;

	/** Whether to load controllers (for client-side processing) */
	needsControllers?: boolean;

	/** View mode (ESM only) - delivery, author, or print */
	view?: "delivery" | "author" | "print";
}

/**
 * Common interface for element loaders (IIFE and ESM)
 */
export interface ElementLoaderInterface {
	/**
	 * Load elements directly from an element map
	 * @param elements - Map of element tag names to package versions
	 * @param options - Loading options
	 */
	loadElements(elements: ElementMap, options?: LoadOptions): Promise<void>;

	/**
	 * Extract and load elements from items
	 * Automatically aggregates unique elements from all items
	 * @param items - Array of items to extract elements from
	 * @param options - Loading options
	 */
	loadFromItems(items: ItemEntity[], options?: LoadOptions): Promise<void>;
}

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

	items.forEach((item) => {
		const itemElements = item.config?.elements || {};

		Object.entries(itemElements).forEach(([tag, pkg]) => {
			if (!elementMap[tag]) {
				// First time seeing this element
				elementMap[tag] = pkg as string;
			} else if (elementMap[tag] !== pkg) {
				// Version conflict detected
				throw new Error(
					`Element version conflict: ${tag} requires both ${elementMap[tag]} and ${pkg}. ` +
						`All items in a section must use the same version of each element.`,
				);
			}
			// else: Same version, no-op
		});
	});

	return elementMap;
}
