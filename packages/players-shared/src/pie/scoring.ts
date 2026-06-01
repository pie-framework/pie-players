/**
 * PIE Scoring Module
 *
 * Scoring and outcome calculation for PIE elements.
 */

import type {
	ConfigEntity,
	Env,
	OutcomeResponse,
	PieController,
	PieModel,
} from "../types/index.js";
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

export type ScorePieItemOptions = {
	/** Scope element lookup to a specific player/root. Defaults to document for existing callers. */
	container?: Pick<ParentNode, "querySelector">;
	env?: Partial<Env>;
	models?: PieModel[];
	/**
	 * Existing callers keep the historical scorePieItem controller call shape.
	 * provideScore() opts into the item-player score result shape explicitly.
	 */
	outcomeArguments?: "session-env" | "model-session-env";
	/**
	 * Preserve one result slot per model, including undefined for missing element/controller.
	 * Existing scorePieItem callers keep the filtered result shape by default.
	 */
	includeMissingResults?: boolean;
};

const escapeAttributeSelectorValue = (value: string): string =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\a ")
		.replace(/\r/g, "\\d ");

const findRenderedPieElement = (
	root: Pick<ParentNode, "querySelector">,
	modelId: string,
): PieElement | null => {
	const escapedId = escapeAttributeSelectorValue(modelId);
	return (root.querySelector(`[id="${escapedId}"]`) ||
		root.querySelector(`[pie-id="${escapedId}"]`)) as PieElement | null;
};

const invokeOutcome = async (
	controller: PieController,
	model: PieModel,
	session: any,
	env: Partial<Env>,
	argumentShape: "session-env" | "model-session-env",
): Promise<OutcomeResponse> => {
	if (argumentShape === "model-session-env") {
		const outcome = controller.outcome as unknown as (
			model: PieModel,
			session: any,
			env: Partial<Env>,
		) => Promise<OutcomeResponse>;
		return outcome.call(controller, model, session, env);
	}
	const outcome = controller.outcome as unknown as (
		session: any,
		env: Partial<Env>,
	) => Promise<OutcomeResponse>;
	return outcome.call(controller, session, env);
};

export function scorePieItem(
	config: ConfigEntity,
	sessionData: any[],
	options: ScorePieItemOptions & { includeMissingResults: true },
): Promise<{ results: Array<OutcomeResponse | undefined> }>;
export function scorePieItem(
	config: ConfigEntity,
	sessionData: any[],
	options?: ScorePieItemOptions,
): Promise<{ results: OutcomeResponse[] }>;
/**
 * Score a PIE item by calling outcome on all PIE elements
 */
export async function scorePieItem(
	config: ConfigEntity,
	sessionData: any[],
	options: ScorePieItemOptions = {},
): Promise<{ results: Array<OutcomeResponse | undefined> }> {
	const root = options.container ?? document;
	const models = options.models ?? config.models ?? [];
	const outcomeArguments = options.outcomeArguments ?? "session-env";
	const scoringEnv: Partial<Env> = {
		...options.env,
		mode: "evaluate",
		partialScoring: options.env?.partialScoring,
	};
	const r = await Promise.all(
		models.map(async (model) => {
			const pieEl = findRenderedPieElement(root, model.id);
			logger.debug("found pieEl %O for model id %s", pieEl, model.id);
			const session = findOrAddSession(sessionData, model.id, model.element);
			if (pieEl) {
				const controller = findPieController(pieEl.localName);
				if (controller?.outcome) {
					return {
						...session,
						...(await invokeOutcome(
							controller,
							model,
							session,
							scoringEnv,
							outcomeArguments,
						)),
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
	return {
		results: options.includeMissingResults
			? r
			: (r.filter(Boolean) as OutcomeResponse[]),
	};
}
