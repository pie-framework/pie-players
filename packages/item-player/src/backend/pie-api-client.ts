/**
 * The built-in `pie-api` HTTP transport: the fallback for a delivery or
 * authoring backend that names no `client` of its own.
 *
 * Loaded on demand. `delivery.ts` and `authoring.ts` reach it through
 * `await import("./pie-api-client.js")` from inside their async entry points, so
 * a host that supplies its own client never pays for the endpoint table, the
 * token resolution or the fetch wrapper. Keep every export awaited from an async
 * caller; a static import anywhere pulls the whole module back into the entry.
 */

import type {
	BackendAuthConfig,
	BackendAuthoringConfig,
	BackendAuthoringIdentity,
	BackendAuthoringLoadResult,
	BackendAuthoringReleaseContext,
	BackendAuthoringSaveContext,
	BackendDeliveryConfig,
	BackendDeliveryLoadContext,
	BackendDeliveryLoadResult,
	BackendDeliveryModelResult,
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
	authoringLoad: { method: "POST", path: "/api/authoring/load" },
	authoringSaveContent: { method: "POST", path: "/api/authoring/save" },
	authoringReleaseContent: { method: "POST", path: "/api/authoring/release" },
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

/**
 * `<pie-api-player>` split the same URL differently: its `host` carried the
 * `/api` segment (`https://api.pie-api.com/api`) and its paths did not
 * (`/player/load`), where `baseUrl` here is the origin and the paths carry
 * `/api`. A host moving over pastes its old `host` into `baseUrl` and would
 * otherwise request `/api/api/player/load`, so one `/api` wins.
 *
 * A backend that really serves `/api/api` keeps `baseUrl` at the origin and puts
 * the whole path in `endpoints`, which nothing here rewrites.
 */
function resolveUrl(baseUrl: string | undefined, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const base = normalizeBaseUrl(baseUrl);
	const absolutePath = path.startsWith("/") ? path : `/${path}`;
	if (base.endsWith("/api") && absolutePath.startsWith("/api/")) {
		return `${base}${absolutePath.slice("/api".length)}`;
	}
	return `${base}${absolutePath}`;
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

/**
 * The Fetch standard caps the total body of a page's in-flight keepalive
 * requests at 64 KiB. Past it `fetch` rejects, which on the unload path means
 * the save is lost with nothing to retry it - so a body over the cap goes as an
 * ordinary request. That one may be cut short by the document going away, which
 * is a worse chance than a small body gets and a better one than none.
 */
const KEEPALIVE_BODY_LIMIT_BYTES = 64 * 1024;

function exceedsKeepaliveLimit(payload: string): boolean {
	const bytes =
		typeof TextEncoder !== "undefined"
			? new TextEncoder().encode(payload).length
			: payload.length;
	return bytes > KEEPALIVE_BODY_LIMIT_BYTES;
}

async function callJson<T>(
	url: string,
	method: BackendMethod,
	body: unknown,
	request: BackendRequestConfig | undefined,
	token: string | null,
	fetchOptions?: { keepalive?: boolean },
): Promise<T> {
	const payload = JSON.stringify(body ?? {});
	const keepalive =
		fetchOptions?.keepalive === true && !exceedsKeepaliveLimit(payload);
	const controller =
		typeof AbortController !== "undefined" ? new AbortController() : null;
	// A keepalive request is meant to outlive the document, so a timeout abort
	// would defeat the only reason it was issued.
	const timeoutMs =
		!keepalive &&
		typeof request?.timeoutMs === "number" &&
		request.timeoutMs > 0
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
			body: payload,
			signal: timeoutId ? controller?.signal : undefined,
			keepalive,
		});
		const responseBody = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				(responseBody &&
				typeof responseBody === "object" &&
				"error" in responseBody
					? String((responseBody as { error?: unknown }).error)
					: "") || `Backend request failed with status ${response.status}`;
			throw new Error(message);
		}
		return responseBody as T;
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
	options?: { keepalive?: boolean },
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
			models: context.models,
			passageModels: context.passageModels,
			overrides: context.requestOptions?.overrides,
		},
		config.request,
		token,
		{ keepalive: options?.keepalive === true },
	);
}

export async function callPieApiDeliveryModel(
	config: BackendDeliveryConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendDeliverySessionContext,
): Promise<BackendDeliveryModelResult> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.model,
		DEFAULT_ENDPOINTS.model,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	const sessionId = context.session.id || context.sessionId;
	return callJson<BackendDeliveryModelResult>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			sessionId,
			data: context.session.data,
			env: context.env,
			itemId: context.itemId,
			assignmentId: context.assignmentId,
			models: context.models,
			passageModels: context.passageModels,
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
			...context.options,
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

export async function callPieApiAuthoringLoad(
	config: BackendAuthoringConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendAuthoringIdentity & { env: unknown },
): Promise<BackendAuthoringLoadResult> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.load,
		DEFAULT_ENDPOINTS.authoringLoad,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	return callJson<BackendAuthoringLoadResult>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			contentId: context.contentId,
			collectionId: context.collectionId,
			env: context.env,
		},
		config.request,
		token,
	);
}

export async function callPieApiAuthoringSaveContent(
	config: BackendAuthoringConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendAuthoringSaveContext,
): Promise<{ contentId: string }> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.saveContent,
		DEFAULT_ENDPOINTS.authoringSaveContent,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	return callJson<{ contentId: string }>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			contentId: context.contentId,
			collectionId: context.collectionId,
			config: context.config,
			env: context.env,
			options: context.options,
		},
		config.request,
		token,
	);
}

export async function callPieApiAuthoringReleaseContent(
	config: BackendAuthoringConfig,
	sharedAuth: BackendAuthConfig | undefined,
	context: BackendAuthoringReleaseContext,
): Promise<{ contentId: string }> {
	const endpoint = normalizeEndpoint(
		config.endpoints?.releaseContent,
		DEFAULT_ENDPOINTS.authoringReleaseContent,
	);
	const token = await resolveToken(config.auth, sharedAuth);
	return callJson<{ contentId: string }>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			contentId: context.contentId,
			collectionId: context.collectionId,
			env: context.env,
			options: context.options,
		},
		config.request,
		token,
	);
}
