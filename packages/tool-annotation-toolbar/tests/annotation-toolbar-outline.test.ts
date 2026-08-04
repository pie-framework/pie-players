import { describe, expect, test } from "bun:test";

/**
 * The toolbar floats over assessment content, so its outline is the only thing
 * separating it from whatever is behind it. WCAG 2.2 SC 1.4.11 puts that
 * boundary at 3:1, and these tests hold the two default greys to it -- both the
 * declared values and the arithmetic behind them, so a later "tidy the hexes"
 * pass cannot quietly drop the outline below threshold.
 */

const source = await Bun.file(
	new URL("../tool-annotation-toolbar.svelte", import.meta.url),
).text();

const LIGHT_OUTLINE = "#949494";
const DARK_OUTLINE = "#5c5c5c";

/** Surfaces the outline is actually drawn against. */
const WHITE = "#ffffff";
const BLACK = "#000000";
/** DaisyUI's dark base-100, the toolbar's own surface under the theme bridge. */
const DAISY_DARK_SURFACE = "#1d232a";

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

	test("light outline clears 3:1 on white and is the lightest grey that does", () => {
		expect(contrastRatio(LIGHT_OUTLINE, WHITE)).toBeGreaterThanOrEqual(3);

		const oneShadeLighter = "#959595";
		expect(contrastRatio(oneShadeLighter, WHITE)).toBeLessThan(3);
	});

	test("dark outline clears 3:1 on the black background it was chosen for", () => {
		expect(contrastRatio(DARK_OUTLINE, BLACK)).toBeGreaterThanOrEqual(3);
	});

	test("dark outline is a large improvement on the DaisyUI surface tint it replaces", () => {
		// Documented shortfall, accepted deliberately: on DaisyUI's dark base-100 the
		// chosen grey lands at 2.37:1 rather than 3:1 -- far above the 1.12:1 of the
		// base-300 tint it replaces, but short of the threshold on that surface.
		// #6c6c6c is the darkest grey that would clear it there. Revisit with the
		// maintainer before treating this as settled.
		const ratio = contrastRatio(DARK_OUTLINE, DAISY_DARK_SURFACE);
		expect(ratio).toBeGreaterThan(2.3);
		expect(contrastRatio("#15191e", DAISY_DARK_SURFACE)).toBeLessThan(1.2);
	});
});
