/**
 * A Trusted Types default policy for pages that enforce
 * `require-trusted-types-for 'script'`.
 *
 * With enforcement on, the browser passes every plain string bound for an
 * HTML, script or script-URL sink through the default policy. Legacy PIE
 * elements set `innerHTML` from model HTML that nothing sanitizes, so this
 * policy runs DOMPurify over it. Svelte templates, and DOMPurify's own parsing
 * where the page admits the `dompurify` policy, arrive already trusted and
 * never reach it.
 */

import DOMPurify from "dompurify";

import { SANITIZER_FORBIDDEN_ATTRS } from "./sanitize-forbidden-lists.js";
import {
	BASE_ALLOWED_ATTRS,
	BASE_URI_SAFE_ATTRS,
	MATHML_ATTRS,
	MATHML_TAGS,
	PREFIXED_TAG,
} from "./sanitize-item-markup.js";

export interface TrustedTypesDefaultPolicyOptions {
	/**
	 * URLs a script element or worker may load. Each entry matches the URL it
	 * names and every URL that continues it after a `/`, `?` or `#`; relative
	 * entries resolve against the document. The page lists every script origin
	 * it uses, as its CSP's `script-src` does.
	 */
	scriptUrlPrefixes: readonly string[];
}

type PolicyRules = {
	createHTML: (input: string) => string;
	createScript: (input: string) => string | null;
	createScriptURL: (input: string) => string | null;
};

type TrustedTypesFactory = {
	defaultPolicy?: unknown;
	createPolicy: (name: string, rules: PolicyRules) => unknown;
};

interface PurifierInstance {
	sanitize: (source: string, config: Record<string, unknown>) => unknown;
}

const EVENT_HANDLER = /^on/i;

/**
 * Install the page's default policy. `false` when the browser has no Trusted
 * Types or the page already has a default policy, which this never replaces.
 * Call it before any PIE player or element loads.
 */
export function installTrustedTypesDefaultPolicy(
	options: TrustedTypesDefaultPolicyOptions,
): boolean {
	const win = (globalThis as { window?: Window }).window;
	const factory = (win as { trustedTypes?: TrustedTypesFactory } | undefined)
		?.trustedTypes;
	if (!win || !factory || typeof factory.createPolicy !== "function") {
		return false;
	}
	if (factory.defaultPolicy) return false;

	const purifier = (
		DOMPurify as unknown as (win: Window) => PurifierInstance
	)(win);
	const prefixes = (options?.scriptUrlPrefixes ?? []).map(
		(prefix) => new URL(prefix, win.document.baseURI).href,
	);
	let sanitizing = false;

	try {
		factory.createPolicy("default", {
			createHTML(input) {
				// DOMPurify parses `input` into an inert document through an HTML
				// sink, which calls back into this policy.
				if (sanitizing) return input;
				sanitizing = true;
				try {
					return String(purifier.sanitize(input, PAGE_SANITIZE_CONFIG));
				} finally {
					sanitizing = false;
				}
			},
			// The ESM loader writes import maps as script text. JSON runs no code,
			// so it is the only script text admitted.
			createScript(input) {
				try {
					const parsed: unknown = JSON.parse(input);
					return parsed !== null && typeof parsed === "object" ? input : null;
				} catch {
					return null;
				}
			},
			createScriptURL(input) {
				let href: string;
				try {
					href = new URL(input, win.document.baseURI).href;
				} catch {
					return null;
				}
				return prefixes.some((prefix) => continuesPrefix(href, prefix))
					? input
					: null;
			},
		});
	} catch {
		// The page's CSP leaves `default` out of `trusted-types`.
		return false;
	}
	return true;
}

function continuesPrefix(href: string, prefix: string): boolean {
	if (href === prefix) return true;
	if (!href.startsWith(prefix)) return false;
	return prefix.endsWith("/") || "/?#".includes(href.charAt(prefix.length));
}

// Every HTML string on the page passes through this, the host's and its
// libraries' as well as PIE's, so it keeps what DOMPurify's defaults keep and
// adds what PIE content needs: any custom element with any attribute but an
// event handler (legacy elements re-render MathJax's `mjx-*` output), and the
// MathML and prefixed tags item markup carries. `style` and `form` stay, unlike
// item markup, where they could restyle or submit from host chrome.
const PAGE_SANITIZE_CONFIG: Record<string, unknown> = Object.freeze({
	ADD_TAGS: (tagName: string) =>
		MATHML_TAGS.has(tagName) || PREFIXED_TAG.test(tagName),
	ADD_ATTR: [...BASE_ALLOWED_ATTRS, ...MATHML_ATTRS],
	ADD_URI_SAFE_ATTR: BASE_URI_SAFE_ATTRS,
	FORBID_ATTR: SANITIZER_FORBIDDEN_ATTRS,
	ALLOW_UNKNOWN_PROTOCOLS: false,
	SANITIZE_DOM: true,
	// PIE matches models to elements by `id`.
	SANITIZE_NAMED_PROPS: false,
	CUSTOM_ELEMENT_HANDLING: {
		tagNameCheck: () => true,
		attributeNameCheck: (name: string) => !EVENT_HANDLER.test(name),
		allowCustomizedBuiltInElements: false,
	},
	// This instance parses through the reentrancy guard above, so the page's
	// CSP need not admit a `dompurify` policy for it.
	TRUSTED_TYPES_POLICY: null,
	RETURN_TRUSTED_TYPE: false,
});
