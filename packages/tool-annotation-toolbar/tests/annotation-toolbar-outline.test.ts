import { describe, expect, test } from "bun:test";

/**
 * The toolbar floats over assessment content, so its outline is the only thing
 * separating it from whatever is behind it. WCAG 2.2 SC 1.4.11 puts that
 * boundary at 3:1, and these tests hold the two default greys to it -- both the
 * declared values and the arithmetic behind them, so a later "tidy the hexes"
 * pass cannot quietly drop the outline below threshold.
 *
 * The surfaces below are real theme bases, not pure white and pure black. An
 * earlier version of this file checked only the extremes, and that is exactly
 * how a pair calibrated at the edge of passing against them shipped while
 * failing on almost every actual theme.
 */

const source = await Bun.file(
	new URL("../tool-annotation-toolbar.svelte", import.meta.url),
).text();

/**
 * light-dark() takes the light-scheme value first. A boundary on a light surface
 * has to be darker than it, so the light arm is the dark grey.
 */
const LIGHT_OUTLINE = "#5c5c5c";
const DARK_OUTLINE = "#949494";

/** The pair these replaced: each was the marginal grey against one extreme. */
const PREVIOUS_LIGHT_OUTLINE = "#949494";
const PREVIOUS_DARK_OUTLINE = "#5c5c5c";

/**
 * Light surfaces the outline is drawn on: the PIE light palette plus the
 * DaisyUI light bases that bind the range. `retro` is the darkest of them and
 * therefore the binding constraint.
 */
const LIGHT_SURFACES: Record<string, string> = {
	"pie-theme light": "#ffffff",
	"daisy retro": "#ece3ca",
	"daisy garden": "#e9e7e7",
	"daisy cyberpunk": "#fff248",
	"daisy cupcake": "#faf7f5",
};

/**
 * Dark surfaces likewise. `aqua` is the lightest dark base and so the binding
 * constraint; `dark` is the one the theme bridge exposes as base-100.
 */
const DARK_SURFACES: Record<string, string> = {
	"pie-theme dark": "#000000",
	"daisy aqua": "#1a368b",
	"daisy dim": "#2a303c",
	"daisy dracula": "#282a36",
	"daisy dark": "#1d232a",
};

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

/** The outline declaration, whitespace-collapsed so line wrapping is irrelevant. */
function outlineDeclaration(): string {
	const styles = source.slice(source.indexOf("<style>")).replace(
		// Comments first: the rule is documented at length, and that prose sits in
		// the middle of the declarations.
		/\/\*[\s\S]*?\*\//g,
		"",
	);
	const block = styles.slice(
		styles.indexOf(".pie-tool-annotation-toolbar {"),
		styles.indexOf("}", styles.indexOf(".pie-tool-annotation-toolbar {")),
	);
	const declaration = block
		.split(";")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.find((line) => line.startsWith("border:"));
	return declaration ?? "";
}

describe("annotation toolbar outline", () => {
	test("draws its outline from its own token, defaulting to the measured pair", () => {
		expect(outlineDeclaration()).toBe(
			`border: 1px solid var(--pie-tool-annotation-toolbar-border, light-dark(${LIGHT_OUTLINE}, ${DARK_OUTLINE}))`,
		);
	});

	test("does not take the outline from --pie-border", () => {
		// The DaisyUI bridge maps --pie-border to --color-base-300, a surface tint:
		// #eeeeee on the light base and #15191e on the dark one, which drew the
		// outline at 1.16:1 and 1.12:1. A var() fallback cannot rescue that, because
		// the bridge does set the token -- so the outline must not consult it at all.
		expect(outlineDeclaration()).not.toContain("--pie-border");
	});

	test("keys the dark value off the declared color-scheme, not the OS preference", () => {
		// prefers-color-scheme reports what the machine prefers rather than what the
		// page is showing. light-dark() follows the color-scheme the theme declares,
		// which also means every dark DaisyUI theme is covered, not only the one
		// whose id is literally "dark".
		expect(outlineDeclaration()).toContain("light-dark(");
		expect(source).not.toContain("prefers-color-scheme");
	});

	test("the light arm clears 3:1 on every light surface", () => {
		for (const [name, surface] of Object.entries(LIGHT_SURFACES)) {
			expect(
				contrastRatio(LIGHT_OUTLINE, surface),
				`${LIGHT_OUTLINE} on ${name} (${surface})`,
			).toBeGreaterThanOrEqual(3);
		}
	});

	test("the dark arm clears 3:1 on every dark surface", () => {
		for (const [name, surface] of Object.entries(DARK_SURFACES)) {
			expect(
				contrastRatio(DARK_OUTLINE, surface),
				`${DARK_OUTLINE} on ${name} (${surface})`,
			).toBeGreaterThanOrEqual(3);
		}
	});

	test("the arms are not interchangeable, so neither can be swapped back", () => {
		// Pins the defect this pair replaced. Each previous value was the marginal
		// grey against one pure extreme, and each fails on the real bases of the
		// scheme it was meant to serve.
		expect(
			contrastRatio(PREVIOUS_LIGHT_OUTLINE, LIGHT_SURFACES["daisy retro"]),
		).toBeLessThan(3);
		expect(
			contrastRatio(PREVIOUS_DARK_OUTLINE, DARK_SURFACES["daisy dark"]),
		).toBeLessThan(3);
	});

	test("no single grey could serve both, which is why light-dark() is used", () => {
		// The two ranges are disjoint: light surfaces need a grey no lighter than
		// #828282, dark surfaces none darker than #878787. If that ever stops being
		// true the pair could collapse to one value, so this records why it has not.
		const worstOn = (grey: string, surfaces: Record<string, string>) =>
			Math.min(...Object.values(surfaces).map((s) => contrastRatio(grey, s)));

		let universal: string | undefined;
		for (let v = 0; v < 256; v += 1) {
			const grey = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
			if (
				worstOn(grey, LIGHT_SURFACES) >= 3 &&
				worstOn(grey, DARK_SURFACES) >= 3
			) {
				universal = grey;
				break;
			}
		}
		expect(universal).toBeUndefined();
	});
});
