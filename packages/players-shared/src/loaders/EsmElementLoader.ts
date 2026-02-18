/**
 * ESM Element Loader
 *
 * Wraps EsmPieLoader to provide element-level loading abstraction.
 * Aggregates elements from multiple items and loads them once using ESM modules.
 */

import { EsmPieLoader } from "../pie/esm-loader.js";
import type { ItemEntity } from "../types/index.js";
import {
	aggregateElements,
	type ElementLoaderInterface,
	type ElementMap,
	type LoadOptions,
} from "./ElementLoader.js";

/**
 * Configuration for ESM element loader
 */
export interface EsmElementLoaderConfig {
	/** Base URL for ESM CDN (e.g., "https://esm.sh") */
	esmCdnUrl: string;

	/** Optional function to check if debug mode is enabled */
	debugEnabled?: () => boolean;
}

/**
 * Element loader for ESM (ES Modules) bundles
 *
 * This loader wraps EsmPieLoader and provides element aggregation capabilities.
 * It eliminates duplicate bundle loads when multiple items use the same PIE elements.
 * ESM is the modern, preferred loading mechanism with better browser support and features.
 *
 * @example
 * ```typescript
 * const loader = new EsmElementLoader({
 *   esmCdnUrl: 'https://esm.sh'
 * });
 *
 * // Load elements from multiple items at once
 * await loader.loadFromItems(section.items, {
 *   view: 'delivery',
 *   needsControllers: true
 * });
 *
 * // Or load specific elements directly
 * await loader.loadElements({
 *   'pie-multiple-choice': '@pie-element/multiple-choice@11.0.1',
 *   'pie-hotspot': '@pie-element/hotspot@9.0.0'
 * }, {
 *   view: 'author' // Load author view for editing
 * });
 * ```
 */
export class EsmElementLoader implements ElementLoaderInterface {
	private loader: EsmPieLoader;

	constructor(config: EsmElementLoaderConfig) {
		this.loader = new EsmPieLoader({
			cdnBaseUrl: config.esmCdnUrl,
			debugEnabled: config.debugEnabled,
		});
	}

	/**
	 * Load elements directly from an element map
	 *
	 * @param elements - Map of element tag names to package versions
	 * @param options - Loading options
	 */
	async loadElements(
		elements: ElementMap,
		options?: LoadOptions,
	): Promise<void> {
		await this.loader.load({ elements }, document, {
			view: options?.view || "delivery",
			loadControllers: options?.needsControllers ?? true,
		});
	}

	/**
	 * Extract and load elements from items
	 *
	 * Automatically aggregates unique elements from all items and loads them once.
	 *
	 * @param items - Array of items to extract elements from
	 * @param options - Loading options
	 * @throws Error if element version conflicts are detected
	 */
	async loadFromItems(
		items: ItemEntity[],
		options?: LoadOptions,
	): Promise<void> {
		const elements = aggregateElements(items);
		await this.loadElements(elements, options);
	}
}
