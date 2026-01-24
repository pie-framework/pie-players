/**
 * PIE Registry Module
 *
 * Manages the global PIE registry that tracks loaded elements.
 */

import type { PieRegistry } from "./types";
import { isPieRegistryAvailable } from "./types";

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
