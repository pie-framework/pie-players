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
	if (/var\(--pie-|color-mix\(in srgb, (red|var\(--pie-)/.test(value)) {
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

	test("authored red emphasis clears SC 1.4.3 on the light page", () => {
		// color-mix(in srgb, red 65%, black) === #a60000.
		expect(source).toContain(
			"color: color-mix(in srgb, red 65%, var(--pie-text, black))",
		);
		expect(
			contrastRatio(rgb("#a60000"), rgb("#ffffff")),
		).toBeGreaterThanOrEqual(4.5);
		// The literal it replaces does not.
		expect(contrastRatio(rgb("#ff0000"), rgb("#ffffff"))).toBeLessThan(4.5);
	});

	test("the loading scrim and its ring follow the theme", () => {
		expect(source).toContain("background-color: var(--pie-white, #fff)");
		expect(source).toContain(
			"--pie-loading-accent: color-mix(in srgb, var(--pie-primary, #3f51b5) 90%, transparent)",
		);
	});
});
