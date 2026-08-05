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
/**
 * The component default is light-dark(#5c5c5c, #949494) -- dark grey on light
 * surfaces, light grey on dark ones. The dark theme pins the light grey, since a
 * boundary on a dark background has to be lighter than it.
 */
const DARK_OUTLINE = "#949494";
const DEFAULT_LIGHT_OUTLINE = "#5c5c5c";
/**
 * The underline's component default is keyed on [data-theme], which reports what
 * the page declares rather than which scheme is active, so a light-declaring host
 * running a dark scheme would pin the light default over a dark background. Each
 * palette hands both states its own accent instead.
 */
const UNDERLINE_TOKENS = [
	"--pie-annotation-underline",
	"--pie-annotation-underline-dark",
] as const;

/**
 * The component's own defaults, kept by the palettes wherever one of them clears
 * 3:1 on that palette's background — which is nine of the ten.
 */
const COMPONENT_UNDERLINE_PAIR = ["#4221d5", "#9c89ec"];

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
	"grey-on-light-grey",
	"purple-on-light-green",
	"black-on-violet",
	"yellow-on-navy",
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

	test("every accessibility scheme keeps its own annotation colours", () => {
		const schemeRuleIndex = colorSchemesCss.indexOf(
			`[data-color-scheme="black-on-white"],`,
		);
		const schemeRule = colorSchemesCss.slice(schemeRuleIndex);

		for (const id of ACCESSIBILITY_SCHEME_IDS) {
			expect(schemeRule).toContain(`[data-color-scheme="${id}"]`);
		}
		const body = schemeRule.slice(0, schemeRule.indexOf("}"));
		expect(body).toContain(`${OUTLINE_TOKEN}: var(--pie-border)`);

		// Equal specificity, so the scheme rule only wins by coming later -- a
		// scheme can be active on a dark page.
		expect(schemeRuleIndex).toBeGreaterThan(
			colorSchemesCss.indexOf('[data-theme="dark"]'),
		);
	});

	test("the runtime scheme definitions carry all three overrides too", () => {
		// pie-theme applies scheme variables as inline styles, and inline styles beat
		// the stylesheet. This is the route the demo apps and every known client use,
		// so a token missing here is a token no consumer receives unless it also
		// imports color-schemes.css and sets data-color-scheme by hand.
		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			if (scheme.id === "default") continue;
			expect(scheme.variables[OUTLINE_TOKEN], `${scheme.id} outline`).toBe(
				"var(--pie-border)",
			);
			for (const token of UNDERLINE_TOKENS) {
				expect(scheme.variables[token], `${scheme.id} ${token}`).toBeDefined();
			}
		}
	});

	test("each scheme keeps the component's own violet pair where it can", () => {
		// The component pair clears 3:1 on nine of the ten backgrounds between them,
		// so the palettes keep it and only the arm differs. Deferring to the palette
		// accent instead would have replaced a deliberate mark colour for no reason.
		const usingComponentPair = BUILTIN_PIE_COLOR_SCHEMES.filter(
			(scheme) =>
				scheme.id !== "default" &&
				COMPONENT_UNDERLINE_PAIR.includes(
					scheme.variables["--pie-annotation-underline"] as string,
				),
		).map((scheme) => scheme.id);

		expect(usingComponentPair).toHaveLength(9);
		expect(usingComponentPair).not.toContain("yellow-on-navy");
	});

	test("both underline states get one value per scheme", () => {
		// Within a scheme the background is fixed by the scheme, so the value is
		// correct whether or not data-theme reports dark -- which is the bug this
		// hand-off exists to fix.
		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			if (scheme.id === "default") continue;
			expect(
				scheme.variables["--pie-annotation-underline-dark"],
				`${scheme.id} states agree`,
			).toBe(scheme.variables["--pie-annotation-underline"]);
		}
	});

	test("every scheme's underline clears 3:1 against its own background", () => {
		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			if (scheme.id === "default") continue;
			const declared = scheme.variables[
				"--pie-annotation-underline"
			] as string;
			// yellow-on-navy is the sole scheme where neither arm reaches 3:1, so it
			// defers to its own accent; resolve that the way the cascade would.
			const resolved =
				declared === "var(--pie-primary)"
					? (scheme.variables["--pie-primary"] as string)
					: declared;
			const background = scheme.variables["--pie-background"] as string;
			expect(
				contrastRatio(resolved, background),
				`${scheme.id}: ${resolved} on ${background}`,
			).toBeGreaterThanOrEqual(3);
		}
	});

	test("the component pair genuinely could not cover yellow-on-navy", () => {
		// Pins why that one scheme is an exception rather than an oversight.
		const navy = BUILTIN_PIE_COLOR_SCHEMES.find(
			(scheme) => scheme.id === "yellow-on-navy",
		);
		const background = navy?.variables["--pie-background"] as string;
		for (const value of COMPONENT_UNDERLINE_PAIR) {
			expect(contrastRatio(value, background)).toBeLessThan(3);
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

	test("neither component grey covers these palettes, which is why they override", () => {
		// This is why the override above exists rather than letting every palette
		// take the component default. Several of these backgrounds are mid-tone, so
		// each arm fails on a different subset and no single grey clears all of them
		// -- only the palette's own --pie-border does.
		const failingFor = (grey: string) =>
			BUILTIN_PIE_COLOR_SCHEMES.filter((scheme) => {
				const background = scheme.variables["--pie-background"];
				return background && contrastRatio(grey, background) < 3;
			}).map((scheme) => scheme.id);

		expect(failingFor(DEFAULT_LIGHT_OUTLINE)).toEqual([
			"yellow-on-blue",
			"light-gray-on-dark-gray",
			"yellow-on-navy",
		]);
		expect(failingFor(DARK_OUTLINE)).toEqual([
			"rose-on-green",
			"black-on-rose",
			"grey-on-light-grey",
			"purple-on-light-green",
			"black-on-violet",
			"yellow-on-navy",
		]);

		// yellow-on-navy defeats both, so no choice of a single grey would do.
		const backgrounds = BUILTIN_PIE_COLOR_SCHEMES.map(
			(scheme) => scheme.variables["--pie-background"],
		).filter((background): background is string => Boolean(background));
		let universal: string | undefined;
		for (let v = 0; v < 256; v += 1) {
			const grey = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
			if (backgrounds.every((bg) => contrastRatio(grey, bg) >= 3)) {
				universal = grey;
				break;
			}
		}
		expect(universal).toBeUndefined();
	});
});
