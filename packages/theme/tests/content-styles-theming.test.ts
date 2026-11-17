import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

import { type Srgb, contrastRatio } from "../src/contrast.js";

const rgb = (hex: string): Srgb => ({
	r: Number.parseInt(hex.slice(1, 3), 16),
	g: Number.parseInt(hex.slice(3, 5), 16),
	b: Number.parseInt(hex.slice(5, 7), 16),
	a: 1,
});

const COMPONENTS_CSS_PATH = resolve(import.meta.dir, "../src/components.css");

const source = readFileSync(COMPONENTS_CSS_PATH, "utf8");
const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
const collapsed = withoutComments.replace(/\s+/g, "");
const declarations = source
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.split("\n")
	.map((line) => line.trim())
	.filter((line) => line.includes(":") && !line.startsWith("--"));

/**
 * Paint declarations whose value starts with a literal colour. Content authored
 * against a white page put `black` borders and `lightgray` table headers here,
 * and a host that swaps the theme cannot reach a literal: the borders vanish
 * and the header text stops being legible on a dark surface. Every literal in
 * this stylesheet has to sit behind a --pie-* token or a mix of one.
 */
const PAINT_PROPERTY =
	/^(color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline|outline-color|fill|stroke)\s*:\s*(.+);?$/;

const LITERAL_COLOUR =
	/(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|silver|gray|grey|red|blue|green|yellow|orange|lightgray|lightgrey)\b)/;

const literalPaints = declarations.flatMap((line) => {
	const match = line.match(PAINT_PROPERTY);
	if (!match) return [];
	const value = match[2];
	// `transparent` spelled as rgba(0, 0, 0, 0) carries no theme meaning.
	const withoutTransparent = value.replace(/rgba\(0,\s*0,\s*0,\s*0\)/g, "");
	if (!LITERAL_COLOUR.test(withoutTransparent)) return [];
	// A literal is fine as the tail of a var() chain or a mix with a token.
	if (/var\(--pie-|color-mix\(in srgb, var\(--pie-/.test(value)) {
		return [];
	}
	return [line];
});

describe("content stylesheet theming", () => {
	test("no content class paints a colour a theme cannot reach", () => {
		expect(literalPaints).toEqual([]);
	});

	test("ink-coloured borders follow --pie-text", () => {
		// `border: 1px solid black` on a dark surface is an invisible table grid.
		expect(source).toContain("border: 1px solid var(--pie-text, black)");
		expect(source).toContain("border: var(--pie-text, #000000) 1px solid");
		expect(source).not.toContain("border: 1px solid black");
	});

	test("the borderless-on-page trick follows --pie-white", () => {
		// `.kds-verdana2t` uses a page-coloured border to reserve space without
		// showing an edge, so it has to track the page, not stay white.
		expect(source).toContain("border: 1px solid var(--pie-white, white)");
	});

	test("table header fills step one surface off the page", () => {
		expect(source).toContain(
			"background-color: var(--pie-background-dark, #d3d3d3)",
		);
		expect(source).not.toContain("background-color: #d3d3d3");
	});

	test("table grid rules paint the ink, like every other authored grid", () => {
		// A 15% ink mix measured 1.41:1 on white against SC 1.4.11's 3:1, and the
		// share that would clear it depends on the palette, so no share is safe.
		const tableRules = [
			...withoutComments.matchAll(/(\.table[^{]*)\{([^}]*)\}/g),
		].map(([, selector, body]) => ({ selector: selector.trim(), body }));
		const gridPaints = tableRules.flatMap(({ selector, body }) =>
			body
				.split(";")
				.map((declaration) => declaration.trim().replace(/\s+/g, " "))
				.filter((declaration) => /^border(-top|-bottom)?:/.test(declaration))
				.map((declaration) => `${selector} { ${declaration} }`),
		);
		expect(gridPaints.length).toBe(4);
		for (const paint of gridPaints) {
			expect(paint).toContain("solid var(--pie-text, black)");
		}
		expect(source).not.toContain("#dee2e6;");
	});

	test("authored red emphasis takes the contrast-corrected content token", () => {
		// A red-toward-ink mix was measured first and rejected: it falls under
		// 4.5:1 on seven of the 35 shipped themes, 2.91:1 on `aqua`.
		expect(source).toContain("color: var(--pie-content-emphasis, #b00000)");
		expect(source).not.toContain("color-mix(in srgb, red");
		// The no-theme default and the literal it replaces, on the light page.
		expect(
			contrastRatio(rgb("#b00000"), rgb("#ffffff")),
		).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(rgb("#ff0000"), rgb("#ffffff"))).toBeLessThan(4.5);
	});

	test("the loading scrim and its ring follow the theme", () => {
		expect(source).toContain("background-color: var(--pie-white, #fff)");
		expect(collapsed).toContain(
			"--pie-loading-accent:color-mix(insrgb,var(--pie-primary,#3f51b5)90%,transparent)",
		);
	});

	test("the shipped rules that could not be made accessible are gone", () => {
		// Global-id 50% floats cannot reflow and applied to any host element with
		// those ids; the legacy players never applied the `.lrn_feature` override.
		// The removal is recorded in a comment, so assert against the rules only.
		expect(withoutComments).not.toContain("#stimulus");
		expect(withoutComments).not.toContain("#item {");
		expect(withoutComments).not.toContain(".lrn_feature");
		// Headings keep the browser's weight, so the level still reads visually.
		expect(collapsed).not.toContain("font-weight:500");
	});

	test("the eliminator toggle scales with the text around it", () => {
		// A px box under PNP font scaling stays put while the text grows.
		// `font: inherit` makes 1em the surrounding text, so the box needs no
		// divisor for a glyph font-size of its own.
		expect(collapsed).toContain(
			".pie-answer-eliminator-toggle--plain{box-sizing:border-box;",
		);
		expect(collapsed).toContain("width:1.75em;height:1.75em;");
		expect(collapsed).toContain("font:inherit;");
		expect(collapsed).not.toContain("font-size:18px");
		expect(collapsed).not.toContain("calc(1.75em/1.125)");
		expect(16 * 1.75).toBe(28);
		// SC 2.5.8's 24px minimum still clears at the smallest base PNP offers.
		expect(14 * 1.75).toBeGreaterThanOrEqual(24);
		// The NDS button's px heights rescale to the same text.
		expect(collapsed).toContain("--height-32:2em;");
	});

	test("the eliminator toggle paints from the shared trigger tokens", () => {
		expect(collapsed).toContain("var(--pie-button-background-color,");
		expect(collapsed).toContain("var(--pie-button-hover-background-color,");
		expect(collapsed).toContain(
			"outline:2pxsolidvar(--pie-button-focus-outline,#0066cc)",
		);
		expect(collapsed).toContain("var(--pie-tool-trigger-active-background,");
		expect(collapsed).toContain("var(--pie-tool-trigger-active-border-color,");
		expect(collapsed).toContain("var(--pie-tool-trigger-active-color,");
		// The eliminator-only colour and the stacking it needed while it was
		// positioned over the choice are gone.
		expect(collapsed).not.toContain("--pie-answer-eliminator-toggle-color");
		expect(collapsed).not.toContain("z-index:10");
		expect(collapsed).not.toContain("transition:all");
	});

	test("an eliminated choice is dimmed as well as struck, on every strike path", () => {
		// Redundant coding: elimination must survive a strike colour the learner
		// cannot distinguish from the text.
		expect(collapsed).toContain(
			".pie-answer-eliminator-eliminated-fallback{text-decoration:line-through",
		);
		// The dim is on the content, so the toggle and its focus ring keep their
		// contrast; a highlight pseudo cannot carry `opacity` at all.
		expect(collapsed).toContain(
			'[data-pie-answer-eliminated="true"][data-pie-answer-eliminator-label="true"]{opacity:0.6;}',
		);
		expect(collapsed).not.toContain(
			'[data-pie-answer-eliminated="true"]{opacity',
		);
		// A scheme certifies a contrast that a 0.6 dim breaks.
		expect(collapsed).toContain(
			'[data-pie-answer-eliminated="true"][data-pie-answer-eliminator-label="true"]:where([data-color-scheme]*){opacity:0.85;}',
		);
	});

	test("the mask replaces the dim on an eliminated choice", () => {
		const mask =
			'[data-pie-answer-eliminated="true"].pie-answer-eliminator-masked{opacity:0.2;filter:blur(2px);}';
		// Equal specificity to both dims, so it has to come after them.
		expect(collapsed).toContain(mask);
		expect(collapsed.indexOf(mask)).toBeGreaterThan(
			collapsed.lastIndexOf('[data-pie-answer-eliminator-label="true"]:where'),
		);
		expect(collapsed).not.toContain(
			":where([data-pie-content]).pie-answer-eliminator-masked{",
		);
	});

	test("hover rings the plain toggle in the hover colour", () => {
		const hover = collapsed.slice(
			collapsed.indexOf(".pie-answer-eliminator-toggle--plain:hover"),
		);
		const rule = hover.slice(0, hover.indexOf("}"));
		expect(rule).toContain("box-shadow:0001pxvar(--pie-button-hover-color,");
		expect(rule).toContain("border-color:var(--pie-button-hover-color,");
		expect(rule).toContain("color:var(--pie-button-hover-color,");
	});

	test("a host strike colour collapses to the scheme's incorrect colour", () => {
		expect(collapsed).toContain(
			"--pie-answer-eliminator-strike-paint:color-mix(insrgb,var(--pie-incorrect,#ff9800)var(--pie-fixed-hue-collapse,0%),var(--pie-answer-eliminator-strike-color,var(--pie-incorrect,#ff9800)))",
		);
		// The maths cross is an SVG now: forced colours drop gradients.
		expect(collapsed).not.toContain("linear-gradient(tobottomright");
	});

	test("eliminator motion runs only when the learner allows it", () => {
		const block = collapsed.slice(
			collapsed.indexOf(":where([data-pie-content]).pie-answer-eliminator-toggle{"),
			collapsed.indexOf("@keyframespie-answer-eliminator-wipe{"),
		);
		const [unguarded, guarded] = block.split(
			"@media(prefers-reduced-motion:no-preference)",
		);
		expect(unguarded).not.toMatch(/transition|animation/);
		expect(guarded.match(/transition:|animation:/g)).toHaveLength(3);
	});

	test("eliminator states are restated in forced colours", () => {
		expect(collapsed).toContain(
			'@media(forced-colors:active){:where([data-pie-content]).pie-answer-eliminator-toggle--plain.pie-answer-eliminator-toggle--active,',
		);
		expect(collapsed).toContain("background-color:Highlight;color:HighlightText;");
		expect(collapsed).toContain(
			"--pie-answer-eliminator-strike-paint:CanvasText;",
		);
		// The NDS glyph is icon-font text, which forced colours would backplate.
		expect(collapsed).toContain(
			".pie-answer-eliminator-toggle--nds.pie-answer-eliminator-toggle--active.nds-icon-button__icon{forced-color-adjust:none;color:HighlightText;}",
		);
	});

	test("centred content blocks drop their gutters at reflow width", () => {
		expect(collapsed).toContain("@media(max-width:30rem)");
	});
});
