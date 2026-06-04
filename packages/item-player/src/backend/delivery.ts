import {
	callPieApiDeliveryLoad,
	callPieApiDeliveryModel,
	callPieApiDeliverySave,
	callPieApiDeliveryScore,
} from "./pie-api-client.js";
import type {
	BackendAutosaveConfig,
	BackendConfig,
	BackendDeliveryConfig,
	BackendDeliveryLoadResult,
	BackendDeliverySessionContext,
	BackendLoadResult,
	BackendScoreOptions,
} from "./types.js";

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isConfigLike(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.markup === "string" &&
		isRecord(value.elements) &&
		Array.isArray(value.models)
	);
}

function resolveLoadedConfig(result: BackendDeliveryLoadResult): unknown {
	if (isConfigLike(result.config)) return result.config;
	if (isConfigLike(result.item)) return result.item;
	if (isRecord(result.item) && isConfigLike(result.item.config)) {
		return result.item.config;
	}
	if (isRecord(result.item) && isConfigLike(result.item.pie)) {
		return {
			pie: result.item.pie,
			passage: isConfigLike(result.item.passage)
				? result.item.passage
				: undefined,
		};
	}
	throw new Error("Backend delivery load did not return an item config.");
}

function resolveLoadedSession(result: BackendDeliveryLoadResult): unknown {
	if (result.session) return result.session;
	return { id: "", data: [] };
}

export function getDeliveryBackend(
	backend: BackendConfig | null | undefined,
): BackendDeliveryConfig | null {
	const delivery = backend?.delivery;
	if (!delivery || delivery.enabled === false) return null;
	return delivery;
}

export function isDeliveryBackendEnabled(
	backend: BackendConfig | null | undefined,
): boolean {
	return !!getDeliveryBackend(backend);
}

export function getDeliveryAutosaveOptions(
	autosave: BackendAutosaveConfig | undefined,
): { enabled: boolean; debounceMs: number } {
	if (autosave === true) {
		return { enabled: true, debounceMs: DEFAULT_AUTOSAVE_DEBOUNCE_MS };
	}
	if (!autosave) {
		return { enabled: false, debounceMs: DEFAULT_AUTOSAVE_DEBOUNCE_MS };
	}
	return {
		enabled: autosave.enabled !== false,
		debounceMs:
			typeof autosave.debounceMs === "number" && autosave.debounceMs >= 0
				? autosave.debounceMs
				: DEFAULT_AUTOSAVE_DEBOUNCE_MS,
	};
}

export function getDeliveryBackendLoadSignature(
	backend: BackendConfig | null | undefined,
): string {
	const delivery = getDeliveryBackend(backend);
	if (!delivery) return "";
	return JSON.stringify({
		provider: delivery.provider ?? (delivery.client ? "custom" : "pie-api"),
		baseUrl: delivery.baseUrl ?? "",
		itemId: delivery.itemId ?? "",
		sessionId: delivery.sessionId ?? "",
		assignmentId: delivery.assignmentId ?? "",
		hasClientLoad: typeof delivery.client?.load === "function",
		endpoint: delivery.endpoints?.load ?? null,
	});
}

export async function loadFromDeliveryBackend(
	backend: BackendConfig,
	env: unknown,
): Promise<BackendLoadResult> {
	const delivery = getDeliveryBackend(backend);
	if (!delivery) {
		throw new Error("Delivery backend is not configured.");
	}
	if (!delivery.itemId) {
		throw new Error(
			"backend.delivery.itemId is required to load from backend.",
		);
	}
	const context = {
		itemId: delivery.itemId,
		sessionId: delivery.sessionId,
		assignmentId: delivery.assignmentId,
		env,
	};
	const result =
		typeof delivery.client?.load === "function"
			? await delivery.client.load(context)
			: await callPieApiDeliveryLoad(delivery, backend.auth, context);
	return {
		config: resolveLoadedConfig(result),
		session: resolveLoadedSession(result),
		metadata: result.metadata,
	};
}

export async function modelFromDeliveryBackend(
	backend: BackendConfig,
	context: BackendDeliverySessionContext,
): Promise<unknown> {
	const delivery = getDeliveryBackend(backend);
	if (!delivery) {
		throw new Error("Delivery backend is not configured.");
	}
	if (typeof delivery.client?.model === "function") {
		return delivery.client.model(context);
	}
	return callPieApiDeliveryModel(delivery, backend.auth, context);
}

export async function saveToDeliveryBackend(
	backend: BackendConfig,
	context: BackendDeliverySessionContext,
): Promise<unknown> {
	const delivery = getDeliveryBackend(backend);
	if (!delivery) {
		throw new Error("Delivery backend is not configured.");
	}
	if (typeof delivery.client?.saveSession === "function") {
		return delivery.client.saveSession(context);
	}
	return callPieApiDeliverySave(delivery, backend.auth, context);
}

export async function scoreWithDeliveryBackend(
	backend: BackendConfig,
	context: BackendDeliverySessionContext,
	options?: BackendScoreOptions,
): Promise<unknown> {
	const delivery = getDeliveryBackend(backend);
	if (!delivery) {
		throw new Error("Delivery backend is not configured.");
	}
	const scoreContext = {
		...context,
		options,
	};
	if (typeof delivery.client?.score === "function") {
		return delivery.client.score(scoreContext);
	}
	return callPieApiDeliveryScore(delivery, backend.auth, scoreContext);
}
