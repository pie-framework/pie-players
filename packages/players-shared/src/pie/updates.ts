/**
 * PIE Updates Module
 *
 * Functions for updating PIE elements with new models, sessions, and env.
 */

import { mergeObjectsIgnoringNullUndefined } from "../object/index.js";
import type { ConfigEntity, Env, PieController, PieModel } from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { findPieController } from "./scoring.js";
import type { PieElement, UpdatePieElementOptions } from "./types.js";
import { defaultPieElementOptions } from "./types.js";
import { findOrAddSession } from "./utils.js";

// Create module-level logger (respects global debug flag - pass function for dynamic checking)
const logger = createPieLogger("pie-updates", () => isGlobalDebugEnabled());

/**
 * Helper function to apply controller to element
 * Extracted to eliminate duplication and ensure consistent controller invocation
 */
const applyControllerToElement = async (
	element: PieElement,
	model: PieModel,
	elementSession: any,
	controller: PieController,
	env: Env,
	logPrefix: string,
): Promise<void> => {
	logger.debug(`${logPrefix} Using controller, env:`, env);
	logger.debug(`${logPrefix} Model before filter:`, {
		id: model.id,
		element: model.element,
		hasCorrectResponse: "correctResponse" in model,
	});

	// Create updateSession callback for controller to save shuffle order
	const updateSession = (id: string, _elementName: string, properties: any) => {
		logger.debug(
			`${logPrefix} updateSession called for ${id} with:`,
			properties,
		);
		Object.assign(elementSession, properties);
		return Promise.resolve();
	};

	try {
		const controllerResult = await (controller as any).model(
			model,
			elementSession,
			env,
			updateSession,
		);

		// Merge controller result with id and element (like server-side PieControllerExecutor does)
		const filteredModel = {
			id: model.id,
			element: model.element,
			...controllerResult,
		};

		logger.debug(`${logPrefix} ✅ Controller filtered model:`, {
			id: filteredModel.id,
			element: filteredModel.element,
			hasCorrectResponse: "correctResponse" in filteredModel,
			mode: env.mode,
			role: env.role,
		});

		element.model = filteredModel;
	} catch (err) {
		logger.error(`${logPrefix} ❌ Controller error:`, err);
		throw err; // Re-throw - controller errors are fatal
	}
};

/**
 * Update a PIE element by ref (direct Element reference)
 */
export const updatePieElementWithRef = (
	el: Element,
	opts: UpdatePieElementOptions,
): void => {
	const { config, session, env, eventListeners, invokeControllerForModel } =
		mergeObjectsIgnoringNullUndefined(defaultPieElementOptions, opts);
	if (!env) {
		throw new Error("env is required");
	}
	if (!session) {
		throw new Error("session is required");
	}
	if (!config) {
		throw new Error("config is required");
	}
	const pieElement = el as PieElement;
	const elName = pieElement.tagName.toLowerCase();
	let model = opts?.config?.models?.find(
		(m) => m.id === pieElement.id,
	) as PieModel;
	if (!model) {
		logger.error("model not found in", opts);
		throw new Error(`model not found for ${elName}`);
	}
	const elementSession = findOrAddSession(session, model.id, model.element);
	pieElement.session = elementSession;

	// Always attach event listeners (don't skip them for no-controller case)
	if (eventListeners) {
		Object.entries(eventListeners).forEach(([evt, fn]) => {
			pieElement.addEventListener(evt as any, fn);
			logger.debug("added event listener %s", evt);
		});
	}

	if (env && invokeControllerForModel) {
		const controller = findPieController(elName);
		if (!controller) {
			logger.debug(
				`[updatePieElementWithRef] ℹ️ No controller for ${elName}, using server-processed model`,
			);
			pieElement.model = model;
		} else {
			// Add .catch() to handle promise rejection
			applyControllerToElement(
				pieElement,
				model,
				elementSession,
				controller,
				env,
				`[updatePieElementWithRef(${elName}#${pieElement.id})]`,
			).catch((err) => {
				logger.error(
					`[updatePieElementWithRef] Controller failed for ${elName}:`,
					err,
				);
				// Fall back to raw model on controller error
				pieElement.model = model;
			});
		}
	} else {
		pieElement.model = model;
	}
};

/**
 * Update a PIE element by name (finds all matching elements in DOM)
 */
export const updatePieElement = (
	elName: string,
	opts: UpdatePieElementOptions,
): void => {
	const {
		config,
		session,
		env,
		eventListeners,
		invokeControllerForModel,
		container,
	} = mergeObjectsIgnoringNullUndefined(defaultPieElementOptions, opts);
	if (!env) {
		throw new Error("env is required");
	}
	if (!session) {
		throw new Error("session is required");
	}
	if (!config) {
		throw new Error("config is required");
	}
	// Use container for scoped query or fallback to document for global query
	const searchRoot = container || document;
	const pieElements = searchRoot.querySelectorAll(elName);
	if (!pieElements || pieElements.length === 0) {
		logger.debug(`no elements found for ${elName}`);
		return;
	}
	pieElements.forEach((el) => {
		const pieElement = el as PieElement;
		// find by id should typically work if the markup is set properly
		let model = opts?.config?.models?.find((m) => m.id === el.id) as PieModel;
		if (!model) {
			logger.error("[updatePieElement] Model not found for", elName, opts);
			throw new Error(`model not found for ${elName}`);
		}

		logger.debug(`[updatePieElement] Updating ${elName}#${el.id}, env:`, env);
		const elementSession = findOrAddSession(session, model.id, model.element);
		pieElement.session = elementSession;

		// Always attach event listeners (don't skip them for no-controller case)
		if (eventListeners) {
			Object.entries(eventListeners).forEach(([evt, fn]) => {
				pieElement.addEventListener(evt as any, fn);
			});
		}

		if (env && invokeControllerForModel) {
			const controller = findPieController(elName);

			// No controller - use server-processed model directly (player.js bundle)
			if (!controller) {
				logger.debug(
					`[updatePieElement] ℹ️ No controller for ${elName}, using server-processed model`,
				);
				pieElement.model = model;
			} else {
				// Controller available - run client-side processing (client-player.js bundle)
				logger.debug(
					`[updatePieElement] Invoking controller for ${elName}#${el.id}`,
					{
						mode: env.mode,
						role: env.role,
						hasCorrectResponse: "correctResponse" in model,
					},
				);

				applyControllerToElement(
					pieElement,
					model,
					elementSession,
					controller,
					env,
					`[updatePieElement(${elName}#${el.id})]`,
				).catch((err) => {
					logger.error(
						`[updatePieElement] Controller failed for ${elName}#${el.id}:`,
						err,
					);
					// Fall back to raw model on controller error
					pieElement.model = model;
				});
			}
		} else {
			logger.debug(
				`[updatePieElement] Direct model assignment for ${elName}#${el.id} (no controller invocation requested)`,
			);
			pieElement.model = model;
		}
	});
};

/**
 * Update all PIE elements in a config
 */
export const updatePieElements = (
	config: ConfigEntity,
	session: any[],
	env: Env,
	container?: Element | Document,
): void => {
	logger.debug("[updatePieElements] Updating all elements with env:", env);
	Object.entries(config.elements).forEach(([elName, _pkg]) => {
		updatePieElement(elName, { config, session, env, container });
	});
};
