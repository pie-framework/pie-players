/**
 * The live theme as a component outside the token cascade needs it: a signal
 * when the page's theme may have moved, and the tokens as they compute on an
 * element, resolved to `#rrggbb` for a vendor API that takes colours as
 * strings.
 *
 * Side-effect-free, so a lazily loaded consumer imports it without registering
 * `<pie-theme>` or loading the resolver behind the package root.
 */

import { type ColorMeasure, createCanvasColorMeasure } from "./contrast.js";
import { resolvePaletteColorScheme } from "./theme-definitions.js";
import type { Unsubscribe } from "./theme-types.js";

const THEME_HOST_ATTRIBUTES = [
	"theme",
	"scheme",
	"provider",
	"variables",
	"style",
	"data-theme",
	"data-color-scheme",
];

const DOCUMENT_THEME_ATTRIBUTES = [
	"style",
	"data-theme",
	"data-color-scheme",
	"class",
];

/**
 * Calls `listener` whenever the page's theme may have moved: an attribute
 * change on the document element or on a `<pie-theme>` host, or a
 * `<pie-theme>` mounting, which themes its target as it connects. The
 * listener learns that something changed and re-reads what it depends on.
 *
 * Inert where there is no document or no `MutationObserver`.
 */
export function observePieThemeChanges(listener: () => void): Unsubscribe {
	if (typeof document === "undefined") return () => {};
	if (typeof MutationObserver === "undefined") return () => {};

	const themeHosts = document.getElementsByTagName("pie-theme");
	const observedHosts = new WeakSet<Element>();
	const observeNewHosts = (): boolean => {
		let found = false;
		for (const host of themeHosts) {
			if (observedHosts.has(host)) continue;
			observedHosts.add(host);
			observer.observe(host, {
				attributes: true,
				attributeFilter: THEME_HOST_ATTRIBUTES,
			});
			found = true;
		}
		return found;
	};
	const observer = new MutationObserver((records) => {
		const mounted = observeNewHosts();
		if (mounted || records.some((record) => record.type === "attributes")) {
			listener();
		}
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: DOCUMENT_THEME_ATTRIBUTES,
	});
	// Insertions, so a `<pie-theme>` mounted later is found. An insertion costs
	// a walk of the live host list, which holds a handful at most.
	observer.observe(document, { childList: true, subtree: true });
	observeNewHosts();

	return () => observer.disconnect();
}

/** The theme as it computes on one element. */
export interface PieElementTheme<Token extends string> {
	/**
	 * The polarity `--pie-background` implies, by the rule `<pie-theme>` uses
	 * for `color-scheme`; `null` when the background is unset or translucent.
	 */
	colorScheme: "light" | "dark" | null;
	/** Each requested token that computes to an opaque colour, as `#rrggbb`. */
	colors: Partial<Record<Token, string>>;
}

/** Kept once a canvas was found; retried while none is. */
let sharedMeasure: ColorMeasure | undefined;

function hexByte(channel: number): string {
	return Math.round(channel).toString(16).padStart(2, "0");
}

/**
 * Reads `--pie-background` and `tokens` as they compute on `element`. Returns
 * `null` where nothing can be measured: no `getComputedStyle`, or no canvas
 * to resolve a colour with.
 */
export function readPieElementTheme<Token extends string>(
	element: Element,
	tokens: readonly Token[] = [],
): PieElementTheme<Token> | null {
	if (typeof getComputedStyle !== "function") return null;
	sharedMeasure ??= createCanvasColorMeasure() ?? undefined;
	const measure = sharedMeasure;
	if (!measure) return null;

	let style: CSSStyleDeclaration;
	try {
		style = getComputedStyle(element);
	} catch {
		return null;
	}
	const hexOf = (token: string): string | undefined => {
		const value = style.getPropertyValue(token).trim();
		const color = value ? measure(value) : null;
		if (!color || color.a < 1) return undefined;
		return `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
	};

	const background = hexOf("--pie-background");
	const colors: Partial<Record<Token, string>> = {};
	for (const token of tokens) {
		const hex = hexOf(token);
		if (hex) colors[token] = hex;
	}
	return {
		colorScheme: background
			? resolvePaletteColorScheme({ "--pie-background": background })
			: null,
		colors,
	};
}
