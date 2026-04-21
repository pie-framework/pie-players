/**
 * Validate that an external stylesheet URL supplied via
 * `<pie-item-player external-style-urls="...">` (or the
 * `itemConfig.resources.stylesheets[*].url` path) is safe to load.
 *
 * - Only `http:` / `https:` are allowed; `javascript:`, `data:`, `file:`
 *   and custom schemes are rejected.
 * - When `allowedOrigins` is non-empty, the URL's origin must match one
 *   of the listed origins. This lets hosts restrict style loading to a
 *   known CDN allow-list.
 */

export type StyleUrlValidationOk = {
	ok: true;
	resolvedUrl: URL;
};

export type StyleUrlValidationError = {
	ok: false;
	reason: "invalid-url" | "disallowed-protocol" | "disallowed-origin";
	message: string;
};

export type StyleUrlValidationResult =
	| StyleUrlValidationOk
	| StyleUrlValidationError;

export interface StyleUrlValidationOptions {
	baseUrl?: string;
	allowedOrigins?: string[];
}

export function validateExternalStyleUrl(
	url: unknown,
	options: StyleUrlValidationOptions = {},
): StyleUrlValidationResult {
	if (typeof url !== "string" || url.length === 0) {
		return {
			ok: false,
			reason: "invalid-url",
			message: "External stylesheet URL must be a non-empty string.",
		};
	}
	let resolvedUrl: URL;
	try {
		resolvedUrl = options.baseUrl
			? new URL(url, options.baseUrl)
			: new URL(url);
	} catch (err) {
		return {
			ok: false,
			reason: "invalid-url",
			message: `External stylesheet URL could not be parsed: ${String(err)}`,
		};
	}
	if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
		return {
			ok: false,
			reason: "disallowed-protocol",
			message: `External stylesheet protocol ${resolvedUrl.protocol} is not allowed (only http/https).`,
		};
	}
	const allowed = options.allowedOrigins ?? [];
	if (allowed.length > 0 && !allowed.includes(resolvedUrl.origin)) {
		return {
			ok: false,
			reason: "disallowed-origin",
			message: `External stylesheet origin ${resolvedUrl.origin} is not in the configured allow-list.`,
		};
	}
	return { ok: true, resolvedUrl };
}

export function parseAllowedStyleOrigins(raw: unknown): string[] {
	if (typeof raw !== "string" || raw.length === 0) return [];
	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}
