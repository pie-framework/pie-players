import { describe, expect, test } from "bun:test";

import { BUILTIN_PIE_COLOR_SCHEMES } from "../src/color-schemes";

/**
 * The annotation toolbar's outline defaults to a contrast-checked grey pair of
 * its own rather than --pie-border, because under the DaisyUI bridge that token
 * carries a surface tint. Palettes that DO choose a boundary colour on purpose
 * have to keep the last word, or this theme's own high-contrast work is thrown
 * away for that one component -- so those overrides are pinned here.
 */

const OUTLINE_TOKEN = "--pie-tool-annotation-toolbar-border";
const DARK_OUTLINE = "#5c5c5c";
const DEFAULT_LIGHT_OUTLINE = "#949494";

const colorSchemesCss = await Bun.file(
	new URL("../src/color-schemes.css", import.meta.url),
).text();

/** Schemes are keyed by the data attribute the theme element stamps. */
const ACCESSIBILITY_SCHEME_IDS = [
	"black-on-white",
	"white-on-black",
	"rose-on-green",
	"yellow-on-blue",
	"black-on-rose",
	"light-gray-on-dark-gray",
];

function channelLuminance(channel: number): number {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
	const value = Number.parseInt(hex.slice(1), 16);
	return (
		0.2126 * channelLuminance((value >> 16) & 255) +
		0.7152 * channelLuminance((value >> 8) & 255) +
		0.0722 * channelLuminance(value & 255)
	);
}

function contrastRatio(a: string, b: string): number {
	const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x,
	);
	return (lighter + 0.05) / (darker + 0.05);
}

describe("annotation toolbar outline overrides", () => {
	test("the dark theme pins the dark outline value", () => {
		// The component default is light-dark(), which follows the declared
		// color-scheme. pie-theme does not declare one, so without this pin a
		// pie-theme dark page would take the light value.
		const darkRule = colorSchemesCss.slice(
			colorSchemesCss.indexOf('[data-theme="dark"]'),
		);
		expect(darkRule).toContain('pie-theme[theme="dark"]');
		expect(darkRule.slice(0, darkRule.indexOf("}"))).toContain(
			`${OUTLINE_TOKEN}: ${DARK_OUTLINE}`,
		);
	});

	test("every accessibility scheme keeps its own boundary colour", () => {
		const schemeRuleIndex = colorSchemesCss.indexOf(
			`[data-color-scheme="black-on-white"],`,
		);
		const schemeRule = colorSchemesCss.slice(schemeRuleIndex);

		for (const id of ACCESSIBILITY_SCHEME_IDS) {
			expect(schemeRule).toContain(`[data-color-scheme="${id}"]`);
		}
		expect(schemeRule.slice(0, schemeRule.indexOf("}"))).toContain(
			`${OUTLINE_TOKEN}: var(--pie-border)`,
		);

		// Equal specificity, so the scheme rule only wins by coming later -- a
		// scheme can be active on a dark page.
		expect(schemeRuleIndex).toBeGreaterThan(
			colorSchemesCss.indexOf('[data-theme="dark"]'),
		);
	});

	test("the runtime scheme definitions carry the override too", () => {
		// pie-theme applies scheme variables as inline styles, and inline styles beat
		// the stylesheet; a consumer that never loads color-schemes.css still gets
		// the scheme's outline this way.
		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			if (scheme.id === "default") continue;
			expect(scheme.variables[OUTLINE_TOKEN], `${scheme.id} outline`).toBe(
				"var(--pie-border)",
			);
		}
	});

	test("each scheme's own border clears 3:1 against its background", () => {
		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			if (scheme.id === "default") continue;
			const border = scheme.variables["--pie-border"];
			const background = scheme.variables["--pie-background"];
			expect(
				contrastRatio(border, background),
				`${scheme.id}: ${border} on ${background}`,
			).toBeGreaterThanOrEqual(3);
		}
	});

	test("the default grey would fail on the tinted light schemes", () => {
		// This is why the override above exists rather than letting every palette
		// take the component default: on these two backgrounds the default grey is
		// below the SC 1.4.11 threshold.
		const failing = BUILTIN_PIE_COLOR_SCHEMES.filter((scheme) => {
			const background = scheme.variables["--pie-background"];
			return background && contrastRatio(DEFAULT_LIGHT_OUTLINE, background) < 3;
		}).map((scheme) => scheme.id);

		expect(failing).toEqual(["rose-on-green", "black-on-rose"]);
	});
});
