import type { ConfigEntity, PieModel } from "@pie-players/pie-players-shared";
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isBackendModel(value: unknown): value is Record<string, unknown> & {
	id: string;
	element: string;
} {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.element === "string"
	);
}

function sameModelIdentity(
	currentModel: PieModel,
	incomingModel: Record<string, unknown> & { id: string; element: string },
): boolean {
	return (
		currentModel.id === incomingModel.id &&
		currentModel.element === incomingModel.element
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

export function normalizeDeliveryModelResult(
	result: BackendDeliveryModelResult,
): NormalizedDeliveryModelResult {
	if (Array.isArray(result)) {
		return {
			models: result,
			passageModels: undefined,
			metadata: undefined,
		};
	}
	return {
		models: Array.isArray(result.models) ? result.models : undefined,
		passageModels: Array.isArray(result.passageModels)
			? result.passageModels
			: undefined,
		metadata: isRecord(result.metadata) ? result.metadata : undefined,
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
