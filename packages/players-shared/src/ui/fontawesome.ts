/**
 * FontAwesome for `<pie-nds-icon-button>`, which renders its glyph as
 * `<i class="fa-light fa-${name}">` and ships no font of its own.
 *
 * FontAwesome comes from the host page when it links any FA stylesheet.
 * Otherwise `ensureFontAwesome` adds FA Free from the ESM CDN the item player's
 * `loaderOptions` name, jsDelivr by default. Pro is never fetched from here:
 * ui.renaissance.com serves its font files to Renaissance origins only, so a
 * host that licenses it links it itself, as section-demos does through its dev
 * proxy.
 *
 * `fa-light` is a weight only Pro carries. Free has no `.fa-light` rule and its
 * Regular font lacks most toolbar glyphs, so without Pro `applyNdsGlyphVariant`
 * renders every glyph in Solid, the one Free weight that has them all.
 *
 * Roboto comes from the vendored button: its connectedCallback links
 * ui.renaissance.com's Roboto unless the page links a stylesheet whose URL
 * contains `Roboto`.
 */

import { resolveEsmPackageFileUrl } from "../loaders/esm-adapter.js";

/** The one FA Free build the players add; `<package>@<version>/<path>`. */
const FONTAWESOME_FREE_FILE =
	"@fortawesome/fontawesome-free@6.5.2/css/all.min.css";

// Matches any FA stylesheet the host page links: `fontawesome.min.css`,
// `font-awesome.css`, a `/_fa-pro/` proxy, `fontawesome-free@…`.
const FA_HREF_PATTERN = /font.?awesome|fa-?pro/i;
const FA_FREE_HREF_PATTERN = /fontawesome-free/i;

export type NdsGlyphVariant = "fa-light" | "fa-regular" | "fa-solid";

const documentStylesheetLinks = () =>
	Array.from(
		document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
	);

const documentFontAwesomeLinks = () =>
	documentStylesheetLinks().filter((link) => FA_HREF_PATTERN.test(link.href));

/** Whether the page links a FontAwesome build other than Free. */
const pageLinksFontAwesomePro = (): boolean =>
	documentFontAwesomeLinks().some(
		(link) => !FA_FREE_HREF_PATTERN.test(link.href),
	);

/**
 * Adds FA Free to `<head>` unless the page already links a FontAwesome
 * stylesheet. Appending Free after a host's Pro would override Pro's
 * `.fa-regular` / `.fa-solid` font-family rules page-wide.
 *
 * A stylesheet that fails to load stays in `<head>` marked
 * `data-pie-load-failed`: no later call requests it again, and no shadow root
 * copies it.
 */
export function ensureFontAwesome(
	loaderOptions:
		| { esmCdnUrl?: unknown; esmCdnProvider?: unknown }
		| null
		| undefined,
): void {
	if (typeof document === "undefined") return;
	if (documentFontAwesomeLinks().length > 0) return;
	const href = resolveEsmPackageFileUrl(loaderOptions, FONTAWESOME_FREE_FILE);
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = href;
	link.addEventListener(
		"error",
		() => {
			link.dataset.pieLoadFailed = "";
		},
		{ once: true },
	);
	document.head.appendChild(link);
}

const mirroredShadowRoots = new WeakSet<ShadowRoot>();

/**
 * Copies the page's FontAwesome `<link>`s into the shadow root `node` renders
 * in, since `<head>` stylesheets do not cross a shadow boundary. Does nothing
 * when `node` is in the document tree, and runs once per shadow root.
 *
 * A stylesheet still loading is copied once it loads, so the copy comes from
 * the cache; one that fails is not copied, since every copy would request it
 * again. Chromium gives a link a `sheet` even when its load fails, so a failed
 * one is known by its mark.
 */
export function installFontAwesomeInShadow(node: Node): void {
	const shadow = node.getRootNode();
	if (!(shadow instanceof ShadowRoot) || mirroredShadowRoots.has(shadow)) {
		return;
	}
	mirroredShadowRoots.add(shadow);
	const appendLink = (href: string) => {
		const present = Array.from(
			shadow.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
		).some((link) => link.href === href);
		if (!href || present) return;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		shadow.appendChild(link);
	};
	for (const link of documentFontAwesomeLinks()) {
		if ("pieLoadFailed" in link.dataset) continue;
		if (link.sheet) {
			appendLink(link.href);
			continue;
		}
		const settle = (event: Event) => {
			link.removeEventListener("load", settle);
			link.removeEventListener("error", settle);
			if (event.type === "load") appendLink(link.href);
		};
		link.addEventListener("load", settle);
		link.addEventListener("error", settle);
	}
}

/**
 * Renders the `fa-light` glyphs inside `button` in `preferred` when the page
 * links Pro, and in Solid otherwise. Re-applies whenever Lit renders or
 * rewrites the icon's class; the class edit removes `fa-light`, so the
 * callback it triggers is a no-op. Returns the observer's disconnect.
 */
export function applyNdsGlyphVariant(
	button: HTMLElement,
	preferred: NdsGlyphVariant,
): () => void {
	const variant = pageLinksFontAwesomePro() ? preferred : "fa-solid";
	if (variant === "fa-light") return () => {};
	const apply = () => {
		for (const icon of button.querySelectorAll<HTMLElement>("i.fa-light")) {
			icon.classList.remove("fa-light");
			icon.classList.add(variant);
		}
	};
	apply();
	const observer = new MutationObserver(apply);
	observer.observe(button, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["class"],
	});
	return () => observer.disconnect();
}
