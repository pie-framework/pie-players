/**
 * Default sanitizer for PIE item / passage markup.
 *
 * Used by `PieItemPlayer.svelte` to strip scripts, event-handler attributes,
 * and unknown tags before injecting authored markup via `{@html}`. Hosts can
 * opt out with the `trust-markup` attribute on the `<pie-*-player>` element,
 * or supply their own sanitizer function if they need a stricter / looser
 * allow-list.
 */

import DOMPurify from "dompurify";

import { wrapOverwideImages } from "./wrap-overwide-images.js";

export type ItemMarkupSanitizer = (markup: string) => string;

export interface SanitizeItemMarkupOptions {
	/**
	 * Extra custom-element tag names that should survive sanitization in
	 * addition to the default `pie-*` allow-list. Useful for authoring-mode
	 * tags that rewrite to `pie-*-config` or host-registered extensions.
	 */
	allowedCustomElements?: string[];
}

// Attributes every PIE element / wrapper is allowed to carry.
const BASE_ALLOWED_ATTRS = [
	"slot",
	"role",
	"tabindex",
	"id",
	"class",
	"style",
	"href",
	"src",
	"alt",
	"title",
	"hidden",
	"disabled",
	"lang",
	"dir",
];

const BASE_URI_SAFE_ATTRS = ["pie-id"];

const FORBIDDEN_TAGS = [
	"script",
	"iframe",
	"object",
	"embed",
	"base",
	"form",
	"meta",
	"link",
	// <foreignObject> inside an <svg> is a well-known escape hatch back
	// into HTML context; match the SVG-icon sanitizer and forbid it here
	// so both sanitizers agree on the surface.
	"foreignobject",
];

// DOMPurify already strips `on*` handlers via its default block-list;
// these entries guarantee they stay stripped even if a consumer tweaks
// defaults, and they cover the common SVG / math sinks.
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
	"onsubmit",
	"onchange",
	"onbeforeunload",
	"formaction",
	"xlink:href",
];

// Any tag that looks like a custom element (contains a hyphen) is permitted
// provided it starts with `pie-` or is explicitly named in
// `allowedCustomElements`. This intentionally keeps third-party unknown
// custom elements out unless the host opts in.
const PIE_CUSTOM_ELEMENT_REGEX = /^pie-[a-z0-9-]+$/i;

// Attribute names that custom elements are allowed to declare. We stay
// permissive for the PIE element contract (`model-*`, `session-*`, ...) and
// the standard `data-*` / `aria-*` families.
const CUSTOM_ELEMENT_ATTR_REGEX =
	/^(id|class|style|slot|role|tabindex|hidden|disabled|lang|dir|data-[\w-]+|aria-[\w-]+|pie-[\w-]+|model-[\w-]+|session-[\w-]+|config-[\w-]+|context-[\w-]+)$/i;

interface DOMPurifyInstance {
	sanitize: (
		source: string,
		config?: Record<string, unknown>,
	) => string | Node | DocumentFragment;
}

let purifierInstance: DOMPurifyInstance | null = null;

function resolvePurifier(): DOMPurifyInstance | null {
	if (purifierInstance) return purifierInstance;
	if (typeof window === "undefined" || !window.document) return null;
	// DOMPurify's default export is both the instance and the factory.
	// Calling it with a window binds the instance to that document.
	const factory = DOMPurify as unknown as (
		win: Window & typeof globalThis,
	) => DOMPurifyInstance;
	purifierInstance =
		typeof factory === "function"
			? factory(window as Window & typeof globalThis)
			: (DOMPurify as unknown as DOMPurifyInstance);
	return purifierInstance;
}

/**
 * Sanitize raw item/passage markup before it is injected into the DOM.
 *
 * - Strips `<script>`, event-handler attributes, unknown protocols and
 *   a standard set of dangerous tags (`iframe`, `object`, `embed`, `base`,
 *   `form`, `meta`, `link`).
 * - Preserves PIE custom elements (`pie-*`) and any extra tags listed in
 *   `allowedCustomElements`.
 * - During SSR (no `window`) returns an empty string so untrusted markup
 *   never reaches the prerender output; the live renderer will re-run the
 *   sanitizer on hydrate.
 */
export function sanitizeItemMarkup(
	markup: string,
	options: SanitizeItemMarkupOptions = {},
): string {
	if (!markup) return "";
	const purifier = resolvePurifier();
	if (!purifier) return "";

	const allowedCustomElements = (options.allowedCustomElements ?? []).map(
		(name) => name.toLowerCase(),
	);
	const explicitCustomElementSet = new Set(allowedCustomElements);

	const result = purifier.sanitize(markup, {
		ADD_TAGS: allowedCustomElements,
		ADD_ATTR: BASE_ALLOWED_ATTRS,
		ADD_URI_SAFE_ATTR: BASE_URI_SAFE_ATTRS,
		FORBID_TAGS: FORBIDDEN_TAGS,
		FORBID_ATTR: FORBIDDEN_ATTRS,
		ALLOW_UNKNOWN_PROTOCOLS: false,
		SANITIZE_DOM: true,
		// pie-item contract compatibility: PIE models are matched to DOM
		// elements via strict `id` equality (see `updateSinglePieElement`
		// in players-shared/src/pie/updates.ts). `SANITIZE_NAMED_PROPS`
		// would prefix every `id`/`name` with `user-content-`, which silently
		// breaks model lookup for every item. `SANITIZE_DOM: true` above
		// still provides the core DOM-clobbering defenses we rely on.
		SANITIZE_NAMED_PROPS: false,
		WHOLE_DOCUMENT: false,
		ALLOW_DATA_ATTR: true,
		ALLOW_ARIA_ATTR: true,
		CUSTOM_ELEMENT_HANDLING: {
			tagNameCheck: (tagName: string) => {
				const lower = tagName.toLowerCase();
				return (
					PIE_CUSTOM_ELEMENT_REGEX.test(lower) ||
					explicitCustomElementSet.has(lower)
				);
			},
			attributeNameCheck: (attrName: string) =>
				CUSTOM_ELEMENT_ATTR_REGEX.test(attrName),
			allowCustomizedBuiltInElements: false,
		},
		RETURN_TRUSTED_TYPE: false,
	});

	const sanitized =
		typeof result === "string" ? result : String(result ?? "");
	// PIE-94: wrap overwide authored images in a horizontal-scroll container
	// so they don't get clipped by ancestor `overflow-x: hidden` regions in
	// the section player (and match WCAG 1.4.10 Reflow at 400% zoom).
	return wrapOverwideImages(sanitized);
}

/**
 * Build the default `ItemMarkupSanitizer` used by the players. The returned
 * function is stable for a given set of allowed custom elements so callers
 * can safely use reference equality when deciding whether to re-sanitize.
 */
export function createDefaultItemMarkupSanitizer(
	options: SanitizeItemMarkupOptions = {},
): ItemMarkupSanitizer {
	const { allowedCustomElements } = options;
	return (markup: string) =>
		sanitizeItemMarkup(markup, { allowedCustomElements });
}

/**
 * Derive the authoring-mode allow-list (`pie-*-config`) from a set of PIE
 * element tag names. Used by `transformMarkupForAuthoring` so the sanitizer
 * keeps the rewritten `-config` tags instead of stripping them.
 */
export function buildAuthoringAllowList(
	elementTagNames: Iterable<string>,
): string[] {
	const out = new Set<string>();
	for (const tag of elementTagNames) {
		if (!tag) continue;
		const lower = tag.toLowerCase();
		out.add(lower);
		out.add(`${lower}-config`);
	}
	return [...out];
}

/** Reset the memoised DOMPurify instance. Only intended for tests. */
export function resetPurifierForTesting() {
	purifierInstance = null;
}
