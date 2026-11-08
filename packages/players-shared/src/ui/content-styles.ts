/**
 * Installs the shared PIE content stylesheet
 * (`@pie-players/pie-theme/components.css`) into the host document.
 *
 * Authored assessment content depends on classes that belong to no single
 * component: passage markup (`.numbered-paragraph`, `.p-number`,
 * `div.passage-title`), the legacy `kds-*` families, the `@media print`
 * `.noprint` rules, and the answer-eliminator classes. Players render that
 * content into light DOM under a `[data-pie-content]` root, so the rules have to
 * exist as a document-level stylesheet. The stylesheet confines every
 * generic-word selector to that root; only `kds-*`, `mjx-*`, `TEX-*` and
 * `.frac` match page-wide.
 *
 * A host that mounts a player inside its own shadow root gets the same
 * stylesheet through `adoptContentStylesInto`, because a document `<style>`
 * does not reach into a shadow tree.
 *
 * Players install that stylesheet themselves, which keeps the host contract at
 * "import the player"; a host-side import was unenforced and failed silently,
 * as an unstyled passage.
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
	// top-level rule with an empty `.style`, which a top-level-only scan reads
	// as "no copy here".
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
 * A cascade layer would invert that: unlayered author declarations beat *all*
 * layered ones regardless of specificity, so a host reset as broad as
 * `p { margin: 0 }` would outrank `.numbered-paragraph { margin-left: 36px }`.
 *
 * @param cssText Contents of `@pie-players/pie-theme/components.css`.
 * @param source Package installing the styles, for diagnostics.
 */
export function installContentStyles(
	cssText: string,
	source: string,
): ContentStylesResult {
	if (!isBrowser()) return "no-document";
	if (cssText) recordContentStylesText(cssText);
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

// A ShadowRoot a host mounts a player into is outside the document's style
// scope, so the `<style>` above never reaches content rendered there. These
// slots live on `globalThis` so every copy of this module on a page shares one
// constructed sheet, as the highlight stylesheet does.
const TEXT_SLOT = Symbol.for("@pie-players/pie-players-shared/content-styles-text");
const SHEET_SLOT = Symbol.for("@pie-players/pie-players-shared/content-styles-sheet");
const ADOPTED_MARKER = Symbol.for(
	"@pie-players/pie-players-shared/content-styles-adopted",
);

type StyleHolder = { text: string; sheet: CSSStyleSheet };
type AdoptingRoot = ShadowRoot & Record<symbol, unknown>;

const globalSlots = (): Record<symbol, unknown> =>
	globalThis as unknown as Record<symbol, unknown>;

const recordContentStylesText = (cssText: string): void => {
	globalSlots()[TEXT_SLOT] = cssText;
};

const sharedContentSheet = (): CSSStyleSheet | null => {
	const text = globalSlots()[TEXT_SLOT];
	if (typeof text !== "string" || text === "") return null;
	const held = globalSlots()[SHEET_SLOT] as StyleHolder | undefined;
	if (held?.text === text) return held.sheet;
	const Sheet = (globalThis as { CSSStyleSheet?: typeof CSSStyleSheet })
		.CSSStyleSheet;
	if (typeof Sheet !== "function") return null;
	try {
		const sheet = new Sheet();
		if (typeof sheet.replaceSync !== "function") return null;
		sheet.replaceSync(text);
		globalSlots()[SHEET_SLOT] = { text, sheet } satisfies StyleHolder;
		return sheet;
	} catch {
		return null;
	}
};

const asShadowRoot = (node: Node | null | undefined): AdoptingRoot | null => {
	const found = node?.getRootNode?.();
	if (!found || found.nodeType !== 11 || !("host" in found)) return null;
	return found as AdoptingRoot;
};

/** Whether a stylesheet the root's owner supplied declares the content sentinel. */
const rootHoldsHostContentStyles = (
	root: AdoptingRoot,
	ours: unknown,
): boolean => {
	const sheets: unknown[] = [
		...Array.from(root.adoptedStyleSheets ?? []).filter((sheet) => sheet !== ours),
		...Array.from(
			root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
				'style, link[rel~="stylesheet"]',
			),
		).map((node) => node.sheet),
	];
	for (const sheet of sheets) {
		let rules: CSSRuleList | undefined;
		try {
			rules = (sheet as CSSStyleSheet | null)?.cssRules;
		} catch {
			continue;
		}
		if (!rules) continue;
		for (const rule of Array.from(rules)) {
			if (declaresContentStylesSentinel(rule)) return true;
		}
	}
	return false;
};

export type ContentStylesAdoption =
	| "adopted"
	| "already-adopted"
	| "host-supplied"
	| "opted-out"
	| "not-in-shadow-root"
	| "unsupported";

/**
 * Adopts the content stylesheet into the ShadowRoot holding `node`, once per
 * root, for a player a host mounted inside its own shadow tree. A document
 * `<style>` does not apply there, so authored content would render unstyled.
 *
 * The sheet is the text `installContentStyles` recorded, so a package that has
 * not called it adopts nothing. A root whose owner already supplied a copy, and
 * a document that sets the opt-out attribute, are left alone: the host owns the
 * stylesheet in both. The sheet goes first among the root's adopted sheets;
 * adopted sheets follow the root's `<style>` and `<link>` elements in the
 * cascade, so at equal specificity the content rules win over a host's inline
 * rules inside that root.
 */
export function adoptContentStylesInto(
	node: Node | null | undefined,
): ContentStylesAdoption {
	const root = asShadowRoot(node);
	if (!root) return "not-in-shadow-root";
	if (contentStylesOptedOut()) return "opted-out";
	const sheets = root.adoptedStyleSheets;
	if (!sheets || typeof sheets !== "object") return "unsupported";
	const current = Array.from(sheets);
	const ours = root[ADOPTED_MARKER] as CSSStyleSheet | undefined;
	if (ours && current.includes(ours)) return "already-adopted";
	if (rootHoldsHostContentStyles(root, ours)) return "host-supplied";
	const sheet = sharedContentSheet();
	if (!sheet) return "unsupported";
	try {
		root.adoptedStyleSheets = [sheet, ...current];
		root[ADOPTED_MARKER] = sheet;
		return "adopted";
	} catch {
		return "unsupported";
	}
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
