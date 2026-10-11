import type { ConfigEntity, PieModel } from "@pie-players/pie-players-shared";
import { isPlainRecord } from "@pie-players/pie-players-shared/object";
import { parseVersionedTagName } from "@pie-players/pie-players-shared/pie/tag-names";
import type { BackendDeliveryModelResult } from "./types.js";

export type NormalizedDeliveryModelResult = {
	models?: Array<Record<string, unknown>>;
	passageModels?: Array<Record<string, unknown>>;
	metadata?: Record<string, unknown>;
};

export type DeliveryModelRefreshConfigResult = {
	itemConfig: ConfigEntity | null;
	passageConfig: ConfigEntity | null;
	metadata?: Record<string, unknown>;
	itemChanged: boolean;
	passageChanged: boolean;
	changed: boolean;
};

function isBackendModel(value: unknown): value is Record<string, unknown> & {
	id: string;
	element: string;
} {
	return (
		isPlainRecord(value) &&
		typeof value.id === "string" &&
		typeof value.element === "string"
	);
}

/**
 * A versioned incoming tag must equal the current one. An unversioned tag is
 * the authored name pie-api-aws answers with, so it matches the current model
 * whose runtime tag carries that name plus a version suffix.
 */
function sameModelIdentity(
	currentModel: PieModel,
	incomingModel: Record<string, unknown> & { id: string; element: string },
): boolean {
	if (currentModel.id !== incomingModel.id) return false;
	if (currentModel.element === incomingModel.element) return true;
	if (
		parseVersionedTagName(incomingModel.element).existingEncodedVersion !==
		undefined
	) {
		return false;
	}
	return (
		parseVersionedTagName(currentModel.element).baseName ===
		incomingModel.element
	);
}

function mergeModelsForConfig(
	config: ConfigEntity | null,
	incomingModels: Array<Record<string, unknown>> | undefined,
): { config: ConfigEntity | null; changed: boolean } {
	if (!config || !incomingModels?.length) {
		return { config, changed: false };
	}
	let changed = false;
	const nextModels = config.models.map((currentModel) => {
		const incomingModel = incomingModels.find(
			(
				model,
			): model is Record<string, unknown> & { id: string; element: string } =>
				isBackendModel(model) && sameModelIdentity(currentModel, model),
		);
		if (!incomingModel) return currentModel;
		const nextModel = {
			...incomingModel,
			id: currentModel.id,
			element: currentModel.element,
		};
		if (JSON.stringify(nextModel) !== JSON.stringify(currentModel)) {
			changed = true;
		}
		return nextModel;
	});
	return {
		config: changed ? { ...config, models: nextModels } : config,
		changed,
	};
}

/**
 * An array result is pie-api-aws's flat list: item models, then passage
 * models. Each config takes the entries whose identity it holds.
 */
export function normalizeDeliveryModelResult(
	result: BackendDeliveryModelResult,
): NormalizedDeliveryModelResult {
	if (Array.isArray(result)) {
		return {
			models: result,
			passageModels: result,
			metadata: undefined,
		};
	}
	return {
		models: Array.isArray(result.models) ? result.models : undefined,
		passageModels: Array.isArray(result.passageModels)
			? result.passageModels
			: undefined,
		metadata: isPlainRecord(result.metadata) ? result.metadata : undefined,
	};
}

export function applyDeliveryModelResultToConfigs(args: {
	itemConfig: ConfigEntity | null;
	passageConfig: ConfigEntity | null;
	result: BackendDeliveryModelResult;
}): DeliveryModelRefreshConfigResult {
	const normalized = normalizeDeliveryModelResult(args.result);
	const itemResult = mergeModelsForConfig(args.itemConfig, normalized.models);
	const passageResult = mergeModelsForConfig(
		args.passageConfig,
		normalized.passageModels,
	);
	return {
		itemConfig: itemResult.config,
		passageConfig: passageResult.config,
		metadata: normalized.metadata,
		itemChanged: itemResult.changed,
		passageChanged: passageResult.changed,
		changed: itemResult.changed || passageResult.changed,
	};
}
