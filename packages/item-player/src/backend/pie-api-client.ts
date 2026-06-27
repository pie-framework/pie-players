import type {
	BackendAuthConfig,
	BackendDeliveryConfig,
	BackendDeliveryLoadContext,
	BackendDeliveryLoadResult,
	BackendDeliveryScoreContext,
	BackendDeliverySessionContext,
	BackendEndpoint,
	BackendMethod,
	BackendRequestConfig,
} from "./types.js";

const DEFAULT_ENDPOINTS = {
	load: { method: "POST", path: "/api/player/load" },
	saveSession: { method: "POST", path: "/api/player/save" },
	model: { method: "POST", path: "/api/player/model" },
	score: { method: "POST", path: "/api/player/score" },
} as const satisfies Record<string, { method: BackendMethod; path: string }>;

function normalizeBaseUrl(baseUrl?: string): string {
	if (!baseUrl) return "";
	return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizeEndpoint(
	endpoint: BackendEndpoint | undefined,
	fallback: { method: BackendMethod; path: string },
): { method: BackendMethod; path: string } {
	if (!endpoint) return fallback;
	if (typeof endpoint === "string") {
		return { method: fallback.method, path: endpoint };
	}
	return {
		method: endpoint.method ?? fallback.method,
		path: endpoint.path,
	};
}

function resolveUrl(baseUrl: string | undefined, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

async function resolveToken(
	localAuth: BackendAuthConfig | undefined,
	sharedAuth: BackendAuthConfig | undefined,
): Promise<string | null> {
	const auth = localAuth ?? sharedAuth;
	if (!auth) return null;
	if (typeof auth.getToken === "function") {
		const token = await auth.getToken();
		return token ? String(token) : null;
	}
	return auth.token ? String(auth.token) : null;
}

async function callJson<T>(
	url: string,
	method: BackendMethod,
	body: unknown,
	request: BackendRequestConfig | undefined,
	token: string | null,
): Promise<T> {
	const controller =
		typeof AbortController !== "undefined" ? new AbortController() : null;
	const timeoutMs =
		typeof request?.timeoutMs === "number" && request.timeoutMs > 0
			? request.timeoutMs
			: 0;
	const timeoutId =
		controller && timeoutMs > 0
			? setTimeout(() => controller.abort(), timeoutMs)
			: null;

	try {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			...(request?.headers || {}),
		};
		if (token) {
			headers.authorization = `Bearer ${token}`;
		}
		const response = await fetch(url, {
			method,
			headers,
			body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
			signal: controller?.signal,
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				(payload && typeof payload === "object" && "error" in payload
					? String((payload as { error?: unknown }).error)
					: "") || `Backend request failed with status ${response.status}`;
			throw new Error(message);
		}
		return payload as T;
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

export async function callPieApiDeliveryLoad(
	config: BackendDeliveryConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendDeliveryLoadContext,
): Promise<BackendDeliveryLoadResult> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.load,
		DEFAULT_ENDPOINTS.load,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	return callJson<BackendDeliveryLoadResult>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			itemId: context.itemId,
			sessionId: context.sessionId,
			assignmentId: context.assignmentId,
			env: context.env,
			overrides: context.requestOptions?.overrides,
		},
		config.request,
		token,
	);
}

export async function callPieApiDeliverySave(
	config: BackendDeliveryConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendDeliverySessionContext,
): Promise<unknown> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.saveSession,
		DEFAULT_ENDPOINTS.saveSession,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	const sessionId = context.session.id || context.sessionId;
	return callJson(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			sessionId,
			data: context.session.data,
			env: context.env,
			itemId: context.itemId,
			assignmentId: context.assignmentId,
			overrides: context.requestOptions?.overrides,
		},
		config.request,
		token,
	);
}

export async function callPieApiDeliveryModel(
	config: BackendDeliveryConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendDeliverySessionContext,
): Promise<unknown> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.model,
		DEFAULT_ENDPOINTS.model,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	const sessionId = context.session.id || context.sessionId;
	return callJson(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			sessionId,
			data: context.session.data,
			env: context.env,
			itemId: context.itemId,
			assignmentId: context.assignmentId,
			overrides: context.requestOptions?.overrides,
		},
		config.request,
		token,
	);
}

export async function callPieApiDeliveryScore(
	config: BackendDeliveryConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendDeliveryScoreContext,
): Promise<unknown> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.score,
		DEFAULT_ENDPOINTS.score,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	const sessionId = context.session.id || context.sessionId;
	return callJson(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			sessionId,
			data: context.session.data,
			env: context.env,
			itemId: context.itemId,
			assignmentId: context.assignmentId,
			...context.options,
			overrides: context.requestOptions?.overrides,
		},
		config.request,
		token,
	);
}
