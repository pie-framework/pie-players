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

	test("subtle grid rules are mixed from the ink, not --pie-border-light", () => {
		// --pie-border-light is filled from DaisyUI base-200 — a surface — so a
		// border taken from it disappears into the page.
		expect(source).toContain(
			"color-mix(in srgb, var(--pie-text, #000) 15%, transparent)",
		);
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
		// those ids; the `lrn_` rules styled a product PIE does not render.
		// The removal is recorded in a comment, so assert against the rules only.
		expect(withoutComments).not.toContain("#stimulus");
		expect(withoutComments).not.toContain("#item {");
		expect(withoutComments).not.toContain(".lrn_");
		// Headings keep the browser's weight, so the level still reads visually.
		expect(collapsed).not.toContain("font-weight:500");
	});

	test("the eliminator toggle scales with the text around it", () => {
		// A px box under PNP font scaling stays put while the text grows.
		expect(collapsed).toContain("font-size:1.125em");
		expect(collapsed).not.toContain("font-size:18px");

		// The box is 1.75x the SURROUNDING text, so it divides by the glyph factor:
		// `em` in a length resolves against this element's own font-size, and a bare
		// 1.75em next to font-size:1.125em measures 31.5px at a 16px base, not the
		// 28px the box is specified at.
		expect(collapsed).toContain("width:calc(1.75em/1.125)");
		expect(collapsed).toContain("height:calc(1.75em/1.125)");
		expect(collapsed).not.toContain("width:1.75em");
		const base = 16;
		const box = (base * 1.125 * 1.75) / 1.125;
		expect(box).toBeCloseTo(28, 5);
		// SC 2.5.8's 24px minimum still clears at the smallest base PNP offers.
		expect((14 * 1.125 * 1.75) / 1.125).toBeGreaterThanOrEqual(24);
	});

	test("an eliminated choice is dimmed as well as struck, on both strike paths", () => {
		// Redundant coding: elimination must survive a strike colour the learner
		// cannot distinguish from the text. Dropped by accident in the theming pass.
		expect(collapsed).toContain(
			".pie-answer-eliminator-eliminated-fallback{text-decoration:line-through",
		);
		// The dim hangs off the attribute both strike paths set, not off the class
		// only the no-Highlight-API path adds — and a highlight pseudo cannot carry
		// `opacity`, so declaring it there dimmed nothing.
		expect(collapsed).toContain(
			'[data-pie-answer-eliminated="true"]{opacity:0.6',
		);
		// And no longer on the class, where only one of the two paths reached it.
		expect(collapsed).not.toContain("#ff9800));opacity:0.6");
	});

	test("centred content blocks drop their gutters at reflow width", () => {
		expect(collapsed).toContain("@media(max-width:30rem)");
	});
});
