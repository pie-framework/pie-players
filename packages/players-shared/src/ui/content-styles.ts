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
 * import it with Vite's `?raw` and hand the text over.
 */

/** Marks a `<style>` element this module owns, and keeps installs idempotent. */
const MARKER_ATTRIBUTE = "data-pie-content-styles";

/**
 * Declared by `components.css` itself, so it is observable no matter how the
 * stylesheet arrived — our injection or a host import. A host copy carrying it
 * makes the player stand down, and an opted-out host with no copy is warned.
 */
const SENTINEL_PROPERTY = "--pie-content-styles";

// Svelte's dev-mode custom-element reset expands `all: unset` into individual
// declarations, including custom properties it has observed elsewhere in the
// bundle. That can produce `--pie-content-styles: unset` on a scoped selector;
// it is a reset, not evidence that a host loaded components.css.
const CSS_WIDE_RESET_VALUES = new Set([
	"inherit",
	"initial",
	"revert",
	"revert-layer",
	"unset",
]);

const declaresContentStylesSentinel = (rule: CSSRule): boolean => {
	const value = (rule as CSSStyleRule).style
		?.getPropertyValue(SENTINEL_PROPERTY)
		.trim()
		.toLowerCase();
	if (value) return !CSS_WIDE_RESET_VALUES.has(value);

	// Grouping rules hold no declarations of their own, so the sentinel sits one
	// or more levels down. A host that confines its copy — `@scope
	// (.item-content) { … }`, `@layer pie-content { … }` — presents exactly one
	// top-level rule with an empty `.style`, and a top-level-only scan reads that
	// as "no copy here". That made both detection paths blind to the one host
	// configuration this module most needs to recognise.
	const nested = (rule as CSSGroupingRule).cssRules;
	if (!nested) return false;
	for (const child of Array.from(nested)) {
		if (declaresContentStylesSentinel(child)) return true;
	}
	return false;
};

/** `<html data-pie-content-styles="host">` opts a host out of installation. */
const OPT_OUT_ATTRIBUTE = "data-pie-content-styles";
const OPT_OUT_VALUE = "host";

export type ContentStylesResult =
	| "installed"
	| "already-installed"
	| "host-supplied"
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
 * True when `components.css` is applied to the document, by any route.
 *
 * Two probes, because neither alone covers both deliveries. The computed
 * sentinel on `<html>` is authoritative for a stylesheet applying to the whole
 * document. A host that confines its copy to its player subtree — `@scope
 * (.item-content) { … }`, the documented remedy for these rules reaching host
 * chrome — puts the stylesheet's `:root` rule somewhere it can never match,
 * since `<html>` is not a descendant of the scoping root; the property then
 * reads empty while the stylesheet is present and working. So an empty read
 * falls back to scanning the document's sheets for the sentinel.
 *
 * Only meaningful once the document's stylesheets have been applied — a host
 * that loads CSS via an async `<link>` reads as missing until it lands.
 */
export function contentStylesPresent(): boolean {
	if (!isBrowser()) return false;
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(SENTINEL_PROPERTY)
		.trim();
	if (value !== "") return true;
	return countContentStyleSheets({ excludeInstalled: false }) > 0;
}

/**
 * Installs `cssText` as a document-level stylesheet, once per document, unless
 * the host already supplies one.
 *
 * A host copy is recognised by the sentinel wherever it sits, including one
 * confined to the host's player subtree with `@scope`. Such a host scoped its
 * copy because the stylesheet's bare element selectors would otherwise reach
 * its own UI, so a global copy from the player would reintroduce exactly that.
 * A host copy can also land after this runs — a lazily injected `<style>`, a
 * `<link>` still loading — so the installed copy keeps watching and removes
 * itself when one appears, as it does when the host sets the opt-out late.
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
	if (countHostContentStyleSheets() > 0) return "host-supplied";
	if (!cssText) return "no-document";

	const style = document.createElement("style");
	style.setAttribute(MARKER_ATTRIBUTE, source);
	style.textContent = cssText;
	document.head.prepend(style);
	watchForHostOwnership(style);
	return "installed";
}

let stopWatchingHostOwnership: (() => void) | null = null;

const watchForHostOwnership = (installed: HTMLStyleElement): void => {
	stopWatchingHostOwnership?.();
	if (typeof MutationObserver === "undefined") return;

	const stop = () => {
		observer.disconnect();
		document.removeEventListener("load", onLoad, true);
		if (stopWatchingHostOwnership === stop) stopWatchingHostOwnership = null;
	};
	const reconcile = () => {
		if (!installed.isConnected) {
			stop();
			return;
		}
		if (contentStylesOptedOut() || countHostContentStyleSheets() > 0) {
			installed.remove();
			stop();
		}
	};
	const observer = new MutationObserver((records) => {
		const relevant = records.some(
			(record) =>
				record.type === "attributes" ||
				Array.from(record.addedNodes).some(
					(node) => node.nodeName === "STYLE" || node.nodeName === "LINK",
				),
		);
		if (relevant) reconcile();
	});
	// `load` does not bubble, so a capturing listener is what sees a host
	// `<link>` finish, including one already in flight when this runs.
	const onLoad = (event: Event) => {
		if ((event.target as Node | null)?.nodeName === "LINK") reconcile();
	};
	observer.observe(document.head, { childList: true });
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: [OPT_OUT_ATTRIBUTE],
	});
	document.addEventListener("load", onLoad, true);
	stopWatchingHostOwnership = stop;
};

/**
 * Counts content stylesheets in the document, detected by the sentinel property
 * rather than by URL, so a copy arriving as a `<link>`, a bundler-injected
 * `<style>`, or anything else all count the same. `excludeInstalled` narrows the
 * count to copies the host loaded itself.
 *
 * Cross-origin sheets throw on `cssRules` access and are skipped; a host copy
 * served from another origin therefore reads as absent, and the player installs
 * its own copy alongside it. Such a host sets the opt-out attribute instead.
 */
const countContentStyleSheets = ({
	excludeInstalled,
}: { excludeInstalled: boolean }): number => {
	// Walks the owning elements rather than document.styleSheets: the marker
	// attribute lives on the element, and CSSStyleSheet.ownerNode is not
	// universally implemented (happy-dom omits it), which would make our own
	// installed copy look like a host copy.
	const exclusion = excludeInstalled ? `:not([${MARKER_ATTRIBUTE}])` : "";
	const nodes = document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
		`style${exclusion}, link[rel~="stylesheet"]${exclusion}`,
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
			if (declaresContentStylesSentinel(rule)) {
				count += 1;
				break;
			}
		}
	}
	return count;
};

/** Copies the host loaded itself, i.e. not the one this module installed. */
const countHostContentStyleSheets = (): number =>
	countContentStyleSheets({ excludeInstalled: true });

let auditWarningIssued = false;
const pendingChecks: ReturnType<typeof setTimeout>[] = [];

/**
 * Reports, once per page, a host that opted out and then loaded no content
 * stylesheet, so authored content renders unstyled — the failure the old
 * host-import contract produced silently. Not detectable synchronously — a host
 * copy may still be in flight as an async `<link>` — so the check is deferred.
 */
export function auditContentStyles(source: string): void {
	if (!isBrowser() || auditWarningIssued) return;

	const check = () => {
		if (auditWarningIssued) return;

		if (contentStylesOptedOut() && !contentStylesPresent()) {
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
 * Test-only: clears the once-per-page warning latch, cancels any pending
 * deferred check and stops watching for a host copy, so state from one test
 * cannot act during the next.
 */
export function resetContentStylesWarningForTesting(): void {
	stopWatchingHostOwnership?.();
	auditWarningIssued = false;
	for (const handle of pendingChecks) clearTimeout(handle);
	pendingChecks.length = 0;
}
