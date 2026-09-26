/**
 * PIE Registry Module
 *
 * Manages the global PIE registry that tracks loaded elements.
 */

import type { Entry, PieRegistry } from "./types.js";
import { isPieRegistryAvailable, Status } from "./types.js";

/**
 * Get or create the global PIE registry
 */
export const pieRegistry = (): PieRegistry => {
	let registry: PieRegistry;
	if (isPieRegistryAvailable(window)) {
		registry = window.PIE_REGISTRY;
	} else {
		registry = {};
		(window as any).PIE_REGISTRY = registry;
	}
	return registry;
};

/**
 * Record a tag in `window.PIE_REGISTRY`. Every registration path writes through
 * here: the IIFE and ESM loaders, bundle initialization, and
 * `registerPreloadedElements`.
 *
 * The first loaded entry for a tag `customElements` holds describes that
 * definition, which no later load replaces, so it keeps its package and
 * element. A later write fills only what it left empty: a controller, with the
 * bundle type that supplied it, and a config. Any other entry is replaced.
 * Returns the entry the registry holds afterwards.
 */
export function writeRegistryEntry(entry: Entry): Entry {
	const registry = pieRegistry();
	const existing = registry[entry.tagName];
	if (
		!existing ||
		existing.status !== Status.loaded ||
		!isDefinedTag(entry.tagName)
	) {
		registry[entry.tagName] = entry;
		return entry;
	}

	const fillsController = !existing.controller && !!entry.controller;
	const fillsConfig = existing.config == null && entry.config != null;
	if (!fillsController && !fillsConfig) return existing;

	const filled: Entry = { ...existing };
	if (fillsController) {
		filled.controller = entry.controller;
		filled.bundleType = entry.bundleType;
	}
	if (fillsConfig) filled.config = entry.config;
	registry[entry.tagName] = filled;
	return filled;
}

function isDefinedTag(tagName: string): boolean {
	return (
		typeof customElements !== "undefined" &&
		customElements.get(tagName) !== undefined
	);
}
