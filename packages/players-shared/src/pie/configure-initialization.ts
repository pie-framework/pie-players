/**
 * Configure Element Initialization
 *
 * Handles initialization of PIE configure elements (authoring mode).
 * Parallel to initialization.ts but for configure elements with -config suffix.
 */

import type { ConfigEntity } from "../types";
import { createPieLogger, isGlobalDebugEnabled } from "./logger";
import { pieRegistry } from "./registry";
import type { AuthoringEnv, ConfigureElement } from "./types";
import { parsePackageName } from "./utils";

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

/**
 * Update configure elements with new configuration
 *
 * This function updates existing configure elements when configuration changes.
 * Useful for reactive updates in the authoring UI.
 */
export function updateConfigureElements(
	config: ConfigEntity,
	configuration: Record<string, any>,
	env: AuthoringEnv,
): void {
	logger.debug("[updateConfigureElements] Starting update");
	logger.debug("[updateConfigureElements] Config:", config);
	logger.debug("[updateConfigureElements] Configuration:", configuration);
	logger.debug("[updateConfigureElements] Env:", env);

	if (!config?.elements || !config?.models) {
		logger.warn(
			"[updateConfigureElements] Invalid config - missing elements or models",
		);
		return;
	}

	// Find all configure elements in the DOM
	for (const [elementTag, packageName] of Object.entries(config.elements)) {
		const configureTag = `${elementTag}-config`;
		const elements = document.querySelectorAll(configureTag);

		logger.debug(
			`[updateConfigureElements] Updating ${elements.length} ${configureTag} elements`,
		);

		elements.forEach((element) => {
			const configureElement = element as unknown as ConfigureElement;

			// Find the model for this element
			const model = config.models.find((m) => m.element === elementTag);

			if (model) {
				logger.debug(
					`[updateConfigureElements] Updating model on ${configureTag}:`,
					model,
				);

				// Update model property
				configureElement.model = model;

				// Update configuration property
				const pkgBaseName = (() => {
					try {
						return parsePackageName(String(packageName)).name;
					} catch {
						return String(packageName);
					}
				})();
				const elementConfig =
					configuration[packageName] ||
					configuration[pkgBaseName] ||
					configuration[elementTag] ||
					{};
				configureElement.configuration = elementConfig;

				logger.debug(
					`[updateConfigureElements] Configuration updated for ${configureTag}:`,
					elementConfig,
				);
			}
		});
	}

	logger.debug("[updateConfigureElements] ✅ Update complete");
}

/**
 * Find configure element in DOM by tag name
 */
export function findConfigureElement(
	elementTag: string,
): ConfigureElement | null {
	const configureTag = `${elementTag}-config`;
	const element = document.querySelector(configureTag);
	return element as unknown as ConfigureElement | null;
}

/**
 * Get all configure elements from config
 */
export function getAllConfigureElements(
	config: ConfigEntity,
): ConfigureElement[] {
	if (!config?.elements) {
		return [];
	}

	const configureElements: ConfigureElement[] = [];

	for (const elementTag of Object.keys(config.elements)) {
		const configureTag = `${elementTag}-config`;
		const elements = document.querySelectorAll(configureTag);

		elements.forEach((el) => {
			configureElements.push(el as unknown as ConfigureElement);
		});
	}

	return configureElements;
}
