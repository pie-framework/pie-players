/**
 * Binding a single PIE element to its model and session.
 *
 * Split out of `initialization.ts` so the late-arrival observer in
 * `element-observer.ts` can reuse it without importing the bundle loaders.
 */

import { wrapModelRichContent } from "../security/wrap-model-rich-content.js";
import type { ConfigEntity, Env, PieModel } from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pieRegistry } from "./registry.js";
import { findPieController } from "./scoring.js";
import type { EventListeners, PieElement } from "./types.js";
import { BundleType } from "./types.js";
import { findOrAddSession } from "./utils.js";

const logger = createPieLogger("pie-initialize-element", () =>
	isGlobalDebugEnabled(),
);

/**
 * Bind `element` to the model in `options.config` whose `id` matches it.
 *
 * Returns whether the element is bound: `true` once a model has been applied
 * (including on a repeat call for an element that is already bound), `false`
 * when the config carries no model for this `id`. A caller holding several
 * configs — an item player registers its item config and its passage config
 * separately — uses that to stop at the config the element belongs to.
 */
export const initializePieElement = (
	element: PieElement,
	options: {
		config: ConfigEntity;
		session: any[];
		env?: Env;
		eventListeners?: EventListeners;
	},
): boolean => {
	const { config, session, env, eventListeners } = options;
	if ((element as any).__pieInitialized) {
		return true;
	}
	const tagName = element.tagName.toLowerCase();

	logger.debug(`[initializePieElement] Initializing ${tagName}#${element.id}`);

	// Find model for this element
	const model = config?.models?.find((m) => m.id === element.id) as PieModel;
	if (!model) {
		// Only warn if this element is from a client-player.js bundle (where models are expected)
		// player.js bundles use server-processed models, so missing models are expected there
		const registry = pieRegistry();
		const registryEntry = registry[tagName];

		if (registryEntry && registryEntry.bundleType === BundleType.clientPlayer) {
			logger.warn(
				`[initializePieElement] Model not found for PIE element ${tagName}#${element.id} (client-player.js bundle)`,
			);
		}
		return false;
	}

	// Set session (with element property for updateSession callback)
	const elementSession = findOrAddSession(session, model.id, model.element);
	element.session = elementSession;
	(element as any).__pieInitialized = true;
	logger.debug(
		`[initializePieElement] Session set for ${tagName}#${element.id}:`,
		elementSession,
	);

	// Set model - use controller if available (client-player.js), or use server-processed model (player.js)
	const controller = findPieController(tagName);

	if (!env) {
		logger.error(
			`[initializePieElement] ❌ FATAL: No env provided for ${tagName}`,
		);
		throw new Error(
			`No env provided for ${tagName}. PIE elements require an env object with mode and role.`,
		);
	}

	if (!controller) {
		// No controller available - using server-processed model (player.js bundle)
		logger.debug(
			`[initializePieElement] ℹ️ No controller for ${tagName}, using server-processed model`,
		);
		logger.debug(`[initializePieElement] Model already processed by server:`, {
			id: model.id,
			element: model.element,
			hasCorrectResponse: "correctResponse" in model,
			mode: env.mode,
			role: env.role,
		});

		// Set model directly - server already processed it
		element.model = wrapModelRichContent(model);
	} else {
		// Controller available - run client-side processing (client-player.js bundle)
		// Note: updatePieElementWithRef handles controller invocation
		logger.debug(
			`[initializePieElement] Controller found for ${tagName}, will invoke model() function`,
		);
	}

	// Add event listeners
	if (eventListeners) {
		Object.entries(eventListeners).forEach(([evt, fn]) => {
			element.addEventListener(evt as any, fn);
		});
	}

	return true;
};
