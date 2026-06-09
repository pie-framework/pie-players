/**
 * PIE Updates Module
 *
 * Functions for updating PIE elements with new models, sessions, and env.
 */

import { mergeObjectsIgnoringNullUndefined } from "../object/index.js";
import { wrapModelRichContent } from "../security/wrap-model-rich-content.js";
import type { ConfigEntity, Env, PieModel } from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { findPieController } from "./scoring.js";
import type { PieElement, UpdatePieElementOptions } from "./types.js";
import { defaultPieElementOptions } from "./types.js";
import { findOrAddSession } from "./utils.js";

// Create module-level logger (respects global debug flag - pass function for dynamic checking)
const logger = createPieLogger("pie-updates", () => isGlobalDebugEnabled());

type ControllerErrorDetail = {
	code: "PIE_CONTROLLER_CONTRACT_ERROR" | "PIE_CONTROLLER_RUNTIME_ERROR";
	message: string;
	elementName: string;
	elementId: string;
	controllerShape?: string;
	cause?: string;
};

const describeControllerShape = (controller: unknown): string => {
	if (!controller) return "missing";
	if (typeof controller === "function") return "function";
	if (typeof controller !== "object") return typeof controller;
	const keys = Object.keys(controller as Record<string, unknown>);
	const defaultValue = (controller as Record<string, unknown>).default;
	const defaultKeys =
		defaultValue && typeof defaultValue === "object"
			? Object.keys(defaultValue as Record<string, unknown>)
			: [];
	return defaultKeys.length > 0
		? `object(keys=[${keys.join(",")}],defaultKeys=[${defaultKeys.join(",")}])`
		: `object(keys=[${keys.join(",")}])`;
};

const resolveControllerModelFunction = (
	controller: unknown,
):
	| ((model: PieModel, session: any, env: Env, updateSession: any) => unknown)
	| null => {
	if (!controller) return null;
	if (typeof controller === "function") {
		return controller as (
			model: PieModel,
			session: any,
			env: Env,
			updateSession: any,
		) => unknown;
	}
	if (typeof controller !== "object") return null;
	const direct = (controller as Record<string, unknown>).model;
	if (typeof direct === "function") {
		return (model, sessionData, env, updateSession) =>
			(direct as Function).call(
				controller,
				model,
				sessionData,
				env,
				updateSession,
			);
	}
	const fromDefault = (controller as Record<string, unknown>).default;
	if (fromDefault && typeof fromDefault === "object") {
		const nested = (fromDefault as Record<string, unknown>).model;
		if (typeof nested === "function") {
			return (model, sessionData, env, updateSession) =>
				(nested as Function).call(
					fromDefault,
					model,
					sessionData,
					env,
					updateSession,
				);
		}
	}
	return null;
};

const emitControllerError = (
	pieElement: PieElement,
	detail: ControllerErrorDetail,
): void => {
	pieElement.dispatchEvent(
		new CustomEvent("pie-controller-error", {
			detail,
			bubbles: true,
			composed: true,
		}),
	);
};

/**
 * Helper function to apply controller to element
 * Extracted to eliminate duplication and ensure consistent controller invocation
 */
const applyControllerToElement = async (
	element: PieElement,
	model: PieModel,
	elementSession: any,
	controller: unknown,
	env: Env,
	logPrefix: string,
	onElementSessionUpdate?: (
		elementId: string,
		elementName: string,
		properties: Record<string, unknown>,
	) => void,
): Promise<void> => {
	logger.debug(`${logPrefix} Using controller, env:`, env);
	logger.debug(`${logPrefix} Model before filter:`, {
		id: model.id,
		element: model.element,
		hasCorrectResponse: "correctResponse" in model,
	});

	// Create updateSession callback for controller to save derived state (e.g.
	// shuffle order). Mutate the in-flight element session so this render uses it,
	// AND propagate the write to the authoritative session via the host callback
	// so subsequent renders reuse it instead of regenerating it. The write-back is
	// keyed by the canonical model id/element (the entry findOrAddSession resolved),
	// which also tolerates controllers that pass an undefined id/element.
	const updateSession = (id: string, _elementName: string, properties: any) => {
		logger.debug(
			`${logPrefix} updateSession called for ${id} with:`,
			properties,
		);
		Object.assign(elementSession, properties);
		onElementSessionUpdate?.(model.id, model.element, properties);
		return Promise.resolve();
	};

	try {
		const modelFunction = resolveControllerModelFunction(controller);
		if (!modelFunction) {
			throw new Error(
				`Controller contract mismatch: expected a model() function but received ${describeControllerShape(
					controller,
				)}`,
			);
		}
		const controllerResult = await modelFunction(
			model,
			elementSession,
			env,
			updateSession,
		);

		// Merge controller result with id and element (like server-side PieControllerExecutor does)
		const controllerResultObject =
			controllerResult && typeof controllerResult === "object"
				? (controllerResult as Record<string, unknown>)
				: {};
		const filteredModel = {
			id: model.id,
			element: model.element,
			...controllerResultObject,
		};
		const wrappedModel = wrapModelRichContent(filteredModel);

		logger.debug(`${logPrefix} ✅ Controller filtered model:`, {
			id: wrappedModel.id,
			element: wrappedModel.element,
			hasCorrectResponse: "correctResponse" in wrappedModel,
			mode: env.mode,
			role: env.role,
		});

		element.model = wrappedModel;
		element.session = elementSession;
	} catch (err) {
		logger.error(`${logPrefix} ❌ Controller error:`, err);
		throw err; // Re-throw - controller errors are fatal
	}
};

type ResolvedUpdateOptions = Pick<
	UpdatePieElementOptions,
	| "config"
	| "session"
	| "env"
	| "eventListeners"
	| "invokeControllerForModel"
	| "onElementSessionUpdate"
>;

const resolveAndValidateUpdateOptions = (
	opts: UpdatePieElementOptions,
): ResolvedUpdateOptions => {
	const {
		config,
		session,
		env,
		eventListeners,
		invokeControllerForModel,
		onElementSessionUpdate,
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
	return {
		config,
		session,
		env,
		eventListeners,
		invokeControllerForModel,
		onElementSessionUpdate,
	};
};

const updateSinglePieElement = async (
	pieElement: PieElement,
	controllerLookupTag: string,
	options: ResolvedUpdateOptions,
	logContext: string,
): Promise<void> => {
	const {
		config,
		session,
		env,
		eventListeners,
		invokeControllerForModel,
		onElementSessionUpdate,
	} = options;
	const model = config.models?.find((m) => m.id === pieElement.id) as
		| PieModel
		| undefined;
	if (!model) {
		logger.error(`${logContext} Model not found for`, controllerLookupTag);
		throw new Error(`model not found for ${controllerLookupTag}`);
	}

	const elementSession = findOrAddSession(session, model.id, model.element);

	// Always attach event listeners (don't skip them for no-controller case)
	if (eventListeners) {
		Object.entries(eventListeners).forEach(([evt, fn]) => {
			pieElement.addEventListener(evt as any, fn);
		});
	}

	if (env && invokeControllerForModel) {
		const controller = findPieController(controllerLookupTag);
		if (!controller) {
			logger.debug(
				`${logContext} ℹ️ No controller for ${controllerLookupTag}, using server-processed model`,
			);
			pieElement.model = wrapModelRichContent(model);
			pieElement.session = elementSession;
			return;
		}

		logger.debug(
			`${logContext} Invoking controller for ${controllerLookupTag}#${pieElement.id}`,
			{
				mode: env.mode,
				role: env.role,
				hasCorrectResponse: "correctResponse" in model,
			},
		);

		// Await the controller so any updateSession write-back completes before the
		// caller computes/emits the session signature; otherwise a late, async
		// shuffle write lands after the cycle that read the session and the order
		// never round-trips (PIE-631).
		try {
			await applyControllerToElement(
				pieElement,
				model,
				elementSession,
				controller,
				env,
				`${logContext}(${controllerLookupTag}#${pieElement.id})`,
				onElementSessionUpdate,
			);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			const isContractError = errorMessage.includes(
				"Controller contract mismatch",
			);
			logger.error(
				`${logContext} Controller failed for ${controllerLookupTag}#${pieElement.id}:`,
				err,
			);
			emitControllerError(pieElement, {
				code: isContractError
					? "PIE_CONTROLLER_CONTRACT_ERROR"
					: "PIE_CONTROLLER_RUNTIME_ERROR",
				message: `${controllerLookupTag} controller failed while applying model for ${pieElement.id}. ${errorMessage}`,
				elementName: controllerLookupTag,
				elementId: pieElement.id,
				controllerShape: describeControllerShape(controller),
				cause: errorMessage,
			});
			// Fall back to raw model on controller error
			pieElement.model = wrapModelRichContent(model);
			pieElement.session = elementSession;
		}
	} else {
		logger.debug(
			`${logContext} Direct model assignment for ${controllerLookupTag}#${pieElement.id} (no controller invocation requested)`,
		);
		pieElement.model = wrapModelRichContent(model);
		pieElement.session = elementSession;
	}
};

/**
 * Update a PIE element by ref (direct Element reference)
 */
export const updatePieElementWithRef = (
	el: Element,
	opts: UpdatePieElementOptions,
): Promise<void> => {
	const options = resolveAndValidateUpdateOptions(opts);
	const pieElement = el as PieElement;
	const elName = pieElement.tagName.toLowerCase();
	return updateSinglePieElement(
		pieElement,
		elName,
		options,
		"[updatePieElementWithRef]",
	);
};

/**
 * Update a PIE element by name (finds all matching elements in DOM)
 */
export const updatePieElement = (
	elName: string,
	opts: UpdatePieElementOptions,
): Promise<void> => {
	const options = resolveAndValidateUpdateOptions(opts);
	const { container } = mergeObjectsIgnoringNullUndefined(
		defaultPieElementOptions,
		opts,
	);
	// Use container for scoped query or fallback to document for global query
	const searchRoot = container || document;
	const pieElements = searchRoot.querySelectorAll(elName);
	if (!pieElements || pieElements.length === 0) {
		logger.debug(`no elements found for ${elName}`);
		return Promise.resolve();
	}
	return Promise.all(
		Array.from(pieElements, (el) =>
			updateSinglePieElement(
				el as PieElement,
				elName,
				options,
				"[updatePieElement]",
			),
		),
	).then(() => undefined);
};

/**
 * Update all PIE elements in a config
 */
export const updatePieElements = (
	config: ConfigEntity,
	session: any[],
	env: Env,
	container?: Element | Document,
	onElementSessionUpdate?: UpdatePieElementOptions["onElementSessionUpdate"],
): Promise<void> => {
	logger.debug("[updatePieElements] Updating all elements with env:", env);
	return Promise.all(
		Object.entries(config.elements).map(([elName, _pkg]) =>
			updatePieElement(elName, {
				config,
				session,
				env,
				container,
				onElementSessionUpdate,
			}),
		),
	).then(() => undefined);
};
