/**
 * IIFE Element Loader
 *
 * Wraps IifePieLoader to provide element-level loading abstraction.
 * Aggregates elements from multiple items and loads them once using IIFE bundles.
 */

import { IifePieLoader } from "../pie/iife-loader";
import { BundleType } from "../pie/types";
import type { ItemEntity } from "../types";
import {
	aggregateElements,
	type ElementLoaderInterface,
	type ElementMap,
	type LoadOptions,
} from "./ElementLoader";

/**
 * Configuration for IIFE element loader
 */
export interface IifeElementLoaderConfig {
	/** Base URL for bundle service (e.g., "https://bundles.pie.org") */
	bundleHost: string;

	/** Optional function to check if debug mode is enabled */
	debugEnabled?: () => boolean;
}

/**
 * Element loader for IIFE (Immediately Invoked Function Expression) bundles
 *
 * This loader wraps IifePieLoader and provides element aggregation capabilities.
 * It eliminates duplicate bundle loads when multiple items use the same PIE elements.
 *
 * @example
 * ```typescript
 * const loader = new IifeElementLoader({
 *   bundleHost: 'https://bundles.pie.org'
 * });
 *
 * // Load elements from multiple items at once
 * await loader.loadFromItems(section.items);
 *
 * // Or load specific elements directly
 * await loader.loadElements({
 *   'pie-multiple-choice': '@pie-element/multiple-choice@11.0.1',
 *   'pie-hotspot': '@pie-element/hotspot@9.0.0'
 * });
 * ```
 */
export class IifeElementLoader implements ElementLoaderInterface {
	private loader: IifePieLoader;

	constructor(config: IifeElementLoaderConfig) {
		this.loader = new IifePieLoader({
			bundleHost: config.bundleHost,
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
		await this.loader.load(
			{ elements },
			document,
			options?.bundleType || BundleType.clientPlayer,
			options?.needsControllers ?? true,
		);
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
