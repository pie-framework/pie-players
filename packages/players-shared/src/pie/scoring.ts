/**
 * PIE Scoring Module
 *
 * Scoring and outcome calculation for PIE elements.
 */

import type { ConfigEntity, OutcomeResponse, PieController } from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pieRegistry } from "./registry.js";
import type { PieElement } from "./types.js";
import { BundleType } from "./types.js";
import { findOrAddSession } from "./utils.js";

// Create module-level logger (respects global debug flag - pass function for dynamic checking)
const logger = createPieLogger("pie-scoring", () => isGlobalDebugEnabled());

/**
 * Find the controller for a PIE element
 */
export const findPieController = (
	elementName: string,
): PieController | undefined => {
	const registry = pieRegistry();

	logger.debug(
		`[findPieController] Looking for controller for: ${elementName}`,
	);
	logger.debug(
		`[findPieController] Registry has entries for:`,
		Object.keys(registry),
	);

	const entry = registry[elementName];
	if (!entry) {
		logger.error(
			`[findPieController] ❌ No registry entry found for element: ${elementName}`,
		);
		logger.error(
			`[findPieController] Available element names:`,
			Object.keys(registry),
		);
		logger.error(`[findPieController] Full registry:`, registry);
		return undefined;
	}

	logger.debug(`[findPieController] Found registry entry for ${elementName}:`, {
		package: entry.package,
		tagName: entry.tagName,
		hasController: !!entry.controller,
		controllerKeys: entry.controller ? Object.keys(entry.controller) : [],
		bundleType: entry.bundleType,
	});

	const controller = entry.controller;
	if (!controller) {
		// Check if missing controller is expected based on bundle type
		if (entry.bundleType === BundleType.clientPlayer) {
			// client-player.js MUST have controllers
			logger.error(
				`[findPieController] ❌ CRITICAL: Registry entry exists for ${elementName} but controller is missing!`,
			);
			logger.error(
				`[findPieController] Bundle type: ${entry.bundleType} (controllers required)`,
			);
			logger.error(`[findPieController] Entry:`, entry);
			throw new Error(
				`No controller found for ${elementName}. client-player.js bundles MUST include controllers. Check bundle loading and registration.`,
			);
		} else {
			// player.js doesn't have controllers - this is expected
			logger.debug(
				`[findPieController] ℹ️ No controller for ${elementName} - using server-processed models (player.js bundle)`,
			);
		}
	} else {
		logger.debug(
			`[findPieController] ✅ Controller found for ${elementName} with functions:`,
			Object.keys(controller),
		);
	}

	return controller;
};

/**
 * Score a PIE item by calling outcome on all PIE elements
 */
export const scorePieItem = async (
	config: ConfigEntity,
	sessionData: any[],
): Promise<{ results: OutcomeResponse[] }> => {
	const r = await Promise.all(
		(config.models || []).map(async (model) => {
			const pieEl = (document.querySelector(`[id='${model.id}']`) ||
				document.querySelector(`[pie-id='${model.id}']`)) as PieElement | null;
			logger.debug("found pieEl %O for model id %s", pieEl, model.id);
			const session = findOrAddSession(sessionData, model.id);
			if (pieEl) {
				const controller = findPieController(pieEl.localName);
				if (controller?.outcome) {
					return {
						...session,
						...(await controller.outcome(session, {
							mode: "evaluate",
						})),
					};
				} else {
					logger.debug("ignore %s (no controller)", pieEl.localName);
				}
			} else {
				logger.debug("ignore %s (no element found for %s)", model.id);
			}
			return undefined;
		}),
	);

	logger.debug("scorePieItem result", r);
	return { results: r.filter(Boolean) as OutcomeResponse[] };
};
