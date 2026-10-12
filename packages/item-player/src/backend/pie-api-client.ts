/**
 * The built-in `pie-api` HTTP transport: the fallback for a delivery backend
 * that names no `client` of its own. It speaks pie-api-aws's player routes; an
 * authoring backend always supplies its own client.
 *
 * Loaded on demand. `delivery.ts` reaches it through
 * `await import("./pie-api-client.js")` from inside their async entry points, so
 * a host that supplies its own client never pays for the endpoint table, the
 * token resolution or the fetch wrapper. Keep every export awaited from an async
 * caller; a static import anywhere pulls the whole module back into the entry.
 */

import type {
	BackendAuthConfig,
	BackendDeliveryConfig,
	BackendDeliveryLoadContext,
	BackendDeliveryLoadResult,
	BackendDeliveryModelResult,
	BackendDeliveryScoreContext,
	BackendDeliverySessionContext,
	BackendEndpoint,
	BackendMethod,
	BackendRequestConfig,
	BackendRequestOptions,
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
	const base = normalizeBaseUrl(baseUrl);
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
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
 * pie-api-aws answers 401 to any `overrides` value, an empty map included, from
 * a token without the `overrides` scope, so an empty map is left off.
 */
function requestOverrides(
	options: BackendRequestOptions | undefined,
): Record<string, string> | undefined {
	const overrides = options?.overrides;
	return overrides && Object.keys(overrides).length > 0 ? overrides : undefined;
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

/**
 * pie-api-aws puts the cause in `error` beside a generic `message`; a rejection
 * from the API gateway carries only `message`.
 */
function errorDetail(body: unknown): string {
	if (!body || typeof body !== "object") return "";
	const { error, message } = body as { error?: unknown; message?: unknown };
	if (typeof error === "string" && error) return error;
	if (typeof message === "string" && message) return message;
	return "";
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
		// pie-api-aws stamps a request's session events from `x-date`, so events
		// keep the order the client issued them in when requests overtake each other.
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"x-date": String(Date.now()),
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
			throw new Error(
				errorDetail(responseBody) ||
					`Backend request failed with status ${response.status}`,
			);
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
			overrides: requestOverrides(context.requestOptions),
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
			overrides: requestOverrides(context.requestOptions),
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
	// Given an itemId, pie-api-aws renders the item fresh and ignores `data`.
	const identity = sessionId
		? { sessionId }
		: { itemId: context.itemId, assignmentId: context.assignmentId };
	return callJson<BackendDeliveryModelResult>(
		resolveUrl(config.baseUrl, endpoint.path),
		endpoint.method,
		{
			...identity,
			data: context.session.data,
			env: context.env,
			models: context.models,
			passageModels: context.passageModels,
			overrides: requestOverrides(context.requestOptions),
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
			overrides: requestOverrides(context.requestOptions),
		},
		config.request,
		token,
	);
}
