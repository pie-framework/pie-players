/**
 * Sanitize an SVG string intended to be rendered as an icon.
 *
 * Used by toolbars and tool-button components when their icon prop is an
 * inline SVG supplied by a tool configuration. Runs DOMPurify with the
 * SVG profile, forbids `<script>` / `<foreignObject>` and strips
 * event-handler attributes.
 *
 * Returns an empty string when `window` / `document` are unavailable (SSR)
 * or the input is not a string.
 */

import DOMPurify from "dompurify";

interface DOMPurifyInstance {
	sanitize: (
		source: string,
		config?: Record<string, unknown>,
	) => string | Node | DocumentFragment;
}

let svgPurifierInstance: DOMPurifyInstance | null = null;

function resolveSvgPurifier(): DOMPurifyInstance | null {
	if (svgPurifierInstance) return svgPurifierInstance;
	if (typeof window === "undefined" || !window.document) return null;
	const factory = DOMPurify as unknown as (
		win: Window & typeof globalThis,
	) => DOMPurifyInstance;
	svgPurifierInstance =
		typeof factory === "function"
			? factory(window as Window & typeof globalThis)
			: (DOMPurify as unknown as DOMPurifyInstance);
	return svgPurifierInstance;
}

const FORBIDDEN_TAGS = [
	"script",
	"foreignobject",
	"iframe",
	"object",
	"embed",
	"base",
	"form",
];

const FORBIDDEN_ATTRS = [
	"onerror",
	"onload",
	"onclick",
	"onmouseover",
	"onmouseout",
	"onmouseenter",
	"onmouseleave",
	"onfocus",
	"onblur",
	"onkeydown",
	"onkeyup",
	"onkeypress",
	"formaction",
	"xlink:href",
];

const stringCache = new Map<string, string>();
const STRING_CACHE_MAX = 64;

export function sanitizeSvgIcon(icon: unknown): string {
	if (typeof icon !== "string" || icon.length === 0) return "";
	const trimmed = icon.trimStart();
	if (!trimmed.toLowerCase().startsWith("<svg")) return "";
	const cached = stringCache.get(icon);
	if (cached !== undefined) return cached;

	const purifier = resolveSvgPurifier();
	if (!purifier) return "";
	const result = purifier.sanitize(icon, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: FORBIDDEN_TAGS,
		FORBID_ATTR: FORBIDDEN_ATTRS,
		ALLOW_UNKNOWN_PROTOCOLS: false,
		RETURN_TRUSTED_TYPE: false,
	});
	const str = typeof result === "string" ? result : String(result ?? "");
	if (stringCache.size >= STRING_CACHE_MAX) {
		// Naive LRU: clear oldest half when the cache fills up. Tool icons are
		// a small fixed set per assessment so this is rarely hit.
		const keys = [...stringCache.keys()];
		for (let i = 0; i < keys.length / 2; i += 1) {
			stringCache.delete(keys[i]);
		}
	}
	stringCache.set(icon, str);
	return str;
}

/** Reset sanitizer state. Intended for tests. */
export function resetSvgSanitizerForTesting() {
	svgPurifierInstance = null;
	stringCache.clear();
}
