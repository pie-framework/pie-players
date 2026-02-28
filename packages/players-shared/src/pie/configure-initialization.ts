/**
 * Configure Element Initialization
 *
 * Handles initialization of PIE configure elements (authoring mode).
 * Parallel to initialization.ts but for configure elements with -config suffix.
 */

import type { ConfigEntity } from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pieRegistry } from "./registry.js";
import type { AuthoringEnv, ConfigureElement } from "./types.js";
import { parsePackageName } from "./utils.js";

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
	options: { env: AuthoringEnv },
): void {
	const { env } = options;

	logger.debug(
		"[initializeConfiguresFromLoadedBundle] Starting initialization",
	);
	logger.debug("[initializeConfiguresFromLoadedBundle] Config:", config);
	logger.debug(
		"[initializeConfiguresFromLoadedBundle] Configuration:",
		configuration,
	);
	logger.debug("[initializeConfiguresFromLoadedBundle] Env:", env);

	if (!config?.elements || !config?.models) {
		logger.warn(
			"[initializeConfiguresFromLoadedBundle] Invalid config - missing elements or models",
		);
		return;
	}

	// Ensure the PIE registry is initialized (side effects register global helpers).
	void pieRegistry();

	// Find all configure elements in the DOM
	for (const [elementTag, packageName] of Object.entries(config.elements)) {
		const configureTag = `${elementTag}-config`;
		const elements = document.querySelectorAll(configureTag);

		logger.debug(
			`[initializeConfiguresFromLoadedBundle] Found ${elements.length} ${configureTag} elements`,
		);

		elements.forEach((element) => {
			const configureElement = element as unknown as ConfigureElement;

			// Find the model for this element
			const model = config.models.find((m) => m.element === elementTag);

			if (model) {
				logger.debug(
					`[initializeConfiguresFromLoadedBundle] Setting model on ${configureTag}:`,
					model,
				);

				// Set model property
				configureElement.model = model;

				// Set configuration property
				const pkgBaseName = (() => {
					try {
						return parsePackageName(String(packageName)).name;
					} catch {
						return String(packageName);
					}
				})();
				// Legacy parity: allow configuration keyed by package name WITHOUT version.
				const elementConfig =
					configuration[packageName] ||
					configuration[pkgBaseName] ||
					configuration[elementTag] ||
					{};
				configureElement.configuration = elementConfig;

				logger.debug(
					`[initializeConfiguresFromLoadedBundle] Configuration set for ${configureTag}:`,
					elementConfig,
				);
			} else {
				logger.warn(
					`[initializeConfiguresFromLoadedBundle] No model found for element ${elementTag}`,
				);
			}
		});
	}

	logger.debug(
		"[initializeConfiguresFromLoadedBundle] ✅ Initialization complete",
	);
}

