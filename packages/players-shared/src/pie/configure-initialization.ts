/**
 * Configure Element Initialization
 *
 * Handles initialization of PIE configure elements (authoring mode).
 * Parallel to initialization.ts but for configure elements with -config suffix.
 */

import type { ConfigEntity } from "../types/index.js";
import {
	initializeAuthoringConfigures,
	type InitializedConfigureModel,
} from "./authoring.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pieRegistry } from "./registry.js";
import type { AuthoringEnv } from "./types.js";

const logger = createPieLogger("configure-init", () => isGlobalDebugEnabled());

/**
 * Initialize configure elements from loaded bundle
 *
 * This function:
 * 1. Finds all configure elements in the DOM (elements with -config suffix)
 * 2. Sets their model and configuration properties
 * 3. Attaches event listeners for model-updated events
 */
export function initializeConfiguresFromLoadedBundle(
	config: ConfigEntity,
	configuration: Record<string, any>,
	options: { env: AuthoringEnv; container?: Pick<ParentNode, "querySelectorAll"> },
): InitializedConfigureModel[] {
	logger.debug(
		"[initializeConfiguresFromLoadedBundle] Starting initialization",
	);

	if (!config?.elements || !config?.models) {
		logger.warn(
			"[initializeConfiguresFromLoadedBundle] Invalid config - missing elements or models",
		);
		return [];
	}

	// Ensure the PIE registry is initialized (side effects register global helpers).
	void pieRegistry();

	const initializedModels = initializeAuthoringConfigures(config, configuration, options);
	logger.debug("[initializeConfiguresFromLoadedBundle] Initialization complete");
	return initializedModels;
}

