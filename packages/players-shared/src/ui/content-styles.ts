/**
 * Installs the shared PIE content stylesheet
 * (`@pie-players/pie-theme/components.css`) into the host document.
 *
 * Authored assessment content depends on classes that belong to no single
 * component: passage markup (`.numbered-paragraph`, `.p-number`,
 * `div.passage-title`), the legacy `kds-*` families, the `@media print`
 * `.noprint` rules, and the answer-eliminator classes. Players render into
 * light DOM, so those rules have to exist as a document-level stylesheet —
 * there is no shadow root to scope them to.
 *
 * Hosts used to be required to import that stylesheet themselves. Nothing
 * enforced it and nothing failed loudly when they didn't: the item rendered,
 * the passage was simply unstyled, and it surfaced as a visual bug reported by
 * hand days later. Players install the stylesheet themselves instead, which
 * keeps the host contract at "import the player".
 *
 * The CSS text is passed in rather than imported here: this package builds with
 * plain `tsc`, so it cannot inline a stylesheet. Bundler-built player packages
 * import it with Vite's `?inline` and hand the text over.
 */

/** Marks a `<style>` element this module owns, and keeps installs idempotent. */
const MARKER_ATTRIBUTE = "data-pie-content-styles";

/**
 * Declared by `components.css` itself, so it is observable no matter how the
 * stylesheet arrived — our injection or a host import. Used only to tell a host
 * that opted out but then shipped nothing.
 */
const SENTINEL_PROPERTY = "--pie-content-styles";

/** `<html data-pie-content-styles="host">` opts a host out of installation. */
const OPT_OUT_ATTRIBUTE = "data-pie-content-styles";
const OPT_OUT_VALUE = "host";

export type ContentStylesResult =
	| "installed"
	| "already-installed"
	| "opted-out"
	| "no-document";

const isBrowser = (): boolean =>
	typeof document !== "undefined" && !!document.head;

/**
 * True when the host declared `<html data-pie-content-styles="host">`, i.e. it
 * takes ownership of loading the stylesheet.
 */
export function contentStylesOptedOut(): boolean {
	if (!isBrowser()) return false;
	return (
		document.documentElement.getAttribute(OPT_OUT_ATTRIBUTE) === OPT_OUT_VALUE
	);
}

/**
 * True when `components.css` is applied to the document, by any route. Reads the
 * sentinel custom property the stylesheet declares on `:root`.
 *
 * Only meaningful once the document's stylesheets have been applied — a host
 * that loads CSS via an async `<link>` reads as missing until it lands.
 */
export function contentStylesPresent(): boolean {
	if (!isBrowser()) return false;
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(SENTINEL_PROPERTY)
		.trim();
	return value !== "";
}

/**
 * Installs `cssText` as a document-level stylesheet, once per document.
 *
 * The stylesheet is **prepended** to `<head>` and deliberately left out of a
 * cascade layer. Prepending reproduces the placement hosts were told to use by
 * hand — first in the entry, before app CSS — so an app rule and a content rule
 * of equal specificity resolve in the host's favour, exactly as before.
 *
 * A cascade layer looks tempting here and is the wrong tool: unlayered author
 * declarations beat *all* layered ones regardless of specificity, so a host
 * reset as broad as `p { margin: 0 }` would silently outrank
 * `.numbered-paragraph { margin-left: 36px }`. That trades a visible missing
 * stylesheet for a subtler override bug, so ordinary specificity wins instead.
 *
 * @param cssText Contents of `@pie-players/pie-theme/components.css`.
 * @param source Package installing the styles, for diagnostics.
 */
export function installContentStyles(
	cssText: string,
	source: string,
): ContentStylesResult {
	if (!isBrowser()) return "no-document";
	if (contentStylesOptedOut()) return "opted-out";
	if (document.querySelector(`style[${MARKER_ATTRIBUTE}]`)) {
		// Another player package, or a second copy of this one, already installed
		// the same stylesheet. Duplicating it would be harmless but pointless.
		return "already-installed";
	}
	if (!cssText) return "no-document";

	const style = document.createElement("style");
	style.setAttribute(MARKER_ATTRIBUTE, source);
	style.textContent = cssText;
	document.head.prepend(style);
	return "installed";
}

/**
 * Counts content stylesheets in the document that this module did not install —
 * i.e. copies the host loaded itself. Detected by the sentinel property rather
 * than by URL, so a copy arriving as a `<link>`, a bundler-injected `<style>`, or
 * anything else all count the same.
 *
 * Cross-origin sheets throw on `cssRules` access and are skipped; a host copy
 * served from another origin therefore reads as absent. That only costs a
 * diagnostic, never correctness.
 */
const countHostContentStyleSheets = (): number => {
	// Walks the owning elements rather than document.styleSheets: the marker
	// attribute lives on the element, and CSSStyleSheet.ownerNode is not
	// universally implemented (happy-dom omits it), which would make our own
	// installed copy look like a host copy.
	const nodes = document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
		`style:not([${MARKER_ATTRIBUTE}]), link[rel~="stylesheet"]:not([${MARKER_ATTRIBUTE}])`,
	);
	let count = 0;
	for (const node of Array.from(nodes)) {
		let rules: CSSRuleList | undefined;
		try {
			rules = node.sheet?.cssRules;
		} catch {
			continue;
		}
		if (!rules) continue;
		for (const rule of Array.from(rules)) {
			if ((rule as CSSStyleRule).style?.getPropertyValue(SENTINEL_PROPERTY)) {
				count += 1;
				break;
			}
		}
	}
	return count;
};

let auditWarningIssued = false;
const pendingChecks: ReturnType<typeof setTimeout>[] = [];

/**
 * Reports, once per page, the two ways content styling can go wrong. Neither is
 * detectable synchronously — a host copy may still be in flight as an async
 * `<link>` — so the check is deferred.
 *
 * - **Missing**: the host opted out and then loaded nothing, so authored content
 *   renders unstyled. This is the failure the old host-import contract produced
 *   silently.
 * - **Duplicated**: the host still imports `components.css` itself *and* the
 *   player installed a copy. Rendering is correct while the two agree, but the
 *   host's copy loads later and therefore wins ties at equal specificity — so a
 *   host copy pinned to an older `@pie-players/pie-theme` silently overrides the
 *   player's newer rules. Harmless today, a confusing override tomorrow.
 */
export function auditContentStyles(source: string): void {
	if (!isBrowser() || auditWarningIssued) return;

	const check = () => {
		if (auditWarningIssued) return;

		if (contentStylesOptedOut()) {
			if (contentStylesPresent()) return;
			auditWarningIssued = true;
			console.warn(
				`[${source}] No PIE content stylesheet found. This document sets ` +
					`${OPT_OUT_ATTRIBUTE}="${OPT_OUT_VALUE}", so ${source} did not install ` +
					`one. Authored content that relies on shared classes ` +
					`(.numbered-paragraph, .p-number, div.passage-title, the kds-* ` +
					`families, answer-eliminator styles) will render unstyled. Either ` +
					`import "@pie-players/pie-theme/components.css" in the host app, or ` +
					`drop the ${OPT_OUT_ATTRIBUTE} attribute to let the player install it.`,
			);
			return;
		}

		if (countHostContentStyleSheets() > 0) {
			auditWarningIssued = true;
			console.warn(
				`[${source}] The PIE content stylesheet is loaded twice: ${source} ` +
					`installs it, and this host also imports ` +
					`"@pie-players/pie-theme/components.css". Rendering is unaffected ` +
					`while both copies match, but the host copy loads later and wins ` +
					`ties at equal specificity, so a copy pinned to an older ` +
					`@pie-players/pie-theme will silently override newer player styles. ` +
					`Remove the host import, or set ` +
					`${OPT_OUT_ATTRIBUTE}="${OPT_OUT_VALUE}" on <html> to own the ` +
					`stylesheet deliberately.`,
			);
		}
	};

	// A host stylesheet can land well after the module graph evaluates, and a
	// bundler-injected <link> is not necessarily parsed by the time `load` fires.
	// This is advisory output, so it is checked at a few widening points rather
	// than raced: whichever one first sees a settled document wins, and the latch
	// keeps the rest quiet. Missing the window costs a diagnostic, not
	// correctness.
	if (typeof requestAnimationFrame !== "function") {
		check();
		return;
	}
	requestAnimationFrame(() => requestAnimationFrame(check));
	if (typeof window !== "undefined" && document.readyState !== "complete") {
		window.addEventListener("load", () => check(), { once: true });
	}
	if (typeof setTimeout === "function") {
		pendingChecks.push(setTimeout(check, 1000));
	}
}

/**
 * Test-only: clears the once-per-page warning latch and cancels any pending
 * deferred check, so a timer scheduled by one test cannot warn during the next.
 */
export function resetContentStylesWarningForTesting(): void {
	auditWarningIssued = false;
	for (const handle of pendingChecks) clearTimeout(handle);
	pendingChecks.length = 0;
}
