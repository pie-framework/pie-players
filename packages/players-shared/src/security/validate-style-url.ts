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
 * - With no allow-list configured, only same-origin URLs pass. The reachable
 *   input here is authored — `itemConfig.resources.stylesheets[*].url` — so an
 *   open default let an item pull page-wide CSS from any origin it named, and
 *   the cross-origin branch in the player is the one that cannot be scoped
 *   (CSS the browser applies from a `<link>` rather than text the player
 *   fetched and rewrote). Naming an origin in `allowed-style-origins` is a
 *   host's opt-in to that.
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
	/**
	 * Document URL the stylesheet URL resolves against, and the origin a URL is
	 * compared to when no `allowedOrigins` are configured. Omitting it while
	 * supplying no allow-list leaves no origin to compare against, so
	 * cross-origin cannot be ruled out and the URL is rejected.
	 */
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
	if (allowed.length > 0) {
		if (!allowed.includes(resolvedUrl.origin)) {
			return {
				ok: false,
				reason: "disallowed-origin",
				message: `External stylesheet origin ${resolvedUrl.origin} is not in the configured allow-list.`,
			};
		}
		return { ok: true, resolvedUrl };
	}

	// No allow-list: same-origin only.
	let baseOrigin: string | null = null;
	if (options.baseUrl) {
		try {
			baseOrigin = new URL(options.baseUrl).origin;
		} catch {
			baseOrigin = null;
		}
	}
	if (baseOrigin === null) {
		return {
			ok: false,
			reason: "disallowed-origin",
			message:
				"External stylesheet origin cannot be checked: no allow-list is configured and no usable baseUrl was supplied. Pass allowedOrigins to permit a cross-origin stylesheet.",
		};
	}
	if (resolvedUrl.origin !== baseOrigin) {
		return {
			ok: false,
			reason: "disallowed-origin",
			message: `External stylesheet origin ${resolvedUrl.origin} is cross-origin and no allow-list is configured. Add it to \`allowed-style-origins\` to permit it.`,
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
