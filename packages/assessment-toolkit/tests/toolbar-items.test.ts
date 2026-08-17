import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidToolbarItemShape } from "../src/services/toolbar-items.js";

const ITEM_TOOLBAR_PATH = resolve(
	__dirname,
	"../src/components/ItemToolBar.svelte",
);

describe("toolbar-items validation", () => {
	test("accepts valid button item shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "customAction",
				label: "Custom Action",
				onClick: () => {},
			}),
		).toBe(true);
	});

	test("accepts valid link item shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "docsLink",
				label: "Open docs",
				href: "https://example.com",
			}),
		).toBe(true);
	});

	test("rejects malformed host button shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "broken",
				label: "Broken",
				href: "https://example.com",
				onClick: () => {},
			}),
		).toBe(false);
		expect(
			isValidToolbarItemShape({
				id: "",
				label: "Missing id",
				onClick: () => {},
			}),
		).toBe(false);
	});

	test("keeps only valid items in mixed host button inputs", () => {
		const mixedInputs = [
			{
				id: "valid-button",
				label: "Valid Button",
				onClick: () => {},
			},
			null,
			{
				id: "broken-link",
				label: "Broken Link",
				href: 123,
			},
			{
				id: "valid-link",
				label: "Valid Link",
				href: "https://example.com",
			},
		];
		const valid = mixedInputs.filter((entry) => isValidToolbarItemShape(entry));
		expect(valid.map((entry) => entry.id)).toEqual([
			"valid-button",
			"valid-link",
		]);
	});

	test("keeps the standalone toolbar fallback empty", () => {
		const source = readFileSync(ITEM_TOOLBAR_PATH, "utf8");
		// Comments exempt, matching `scripts/check-capability-neutrality.mjs`: what
		// this guards is an import, and matching prose only bought a comment that
		// could not say which package it was warning about.
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, " ")
			.replace(/(^|[^:\w])\/\/[^\n]*/g, "$1");

		// This package holds no capability set to fall back to, so a toolbar given
		// no registry renders no buttons. That is the honest answer: with nothing
		// registered there is nothing whose visibility or render contract could be
		// consulted. It previously fell back to the packaged registry, which is what
		// kept eleven capability names inside the generic package.
		expect(source).toContain("No fallback registry");
		expect(source).toContain(
			"const fallbackToolRegistry = new ToolRegistry();",
		);
		expect(code).not.toContain("createPackagedToolRegistry");
		expect(code).not.toContain("@pie-players/pie-default-tool-loaders");
		expect(code).not.toContain("DEFAULT_TOOL_MODULE_LOADERS");
	});
});

describe("calculator nds-icon-button styling contract", () => {
	const source = readFileSync(ITEM_TOOLBAR_PATH, "utf8");
	const stripped = source.slice(source.indexOf("<style")).replace(/\s+/g, "");

	test("calculator button renders as the NDS tertiary variant", () => {
		expect(source).toContain('variant="tertiary"');
	});

	test("calculator glyph colour is the settable --pie-calculator-button-color", () => {
		expect(stripped).toContain(
			"--color-interactive-blue:var(--pie-calculator-button-color,var(--pie-button-color,var(--pie-text,#222)))",
		);
	});

	test("the calculator glyph default is themed, not a literal", () => {
		// The hook is package-private, so its fallback is what every host renders.
		// A literal there kept the glyph #146eb3 blue on a pink `valentine` toolbar.
		const declarations = source
			.slice(source.indexOf("<style"))
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\s+/g, "");
		expect(declarations).not.toContain(
			"var(--pie-calculator-button-color,#146eb3)",
		);
	});

	test("the vendored NDS palette is bridged to the PIE token families", () => {
		// Unbridged, the vendored button's own literals win: a #f3f5f7 pill and a
		// #2b87ff focus ring under every theme, which a themed (light) glyph then
		// disappears into.
		const declarations = source
			.slice(source.lastIndexOf("<style"))
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\s+/g, "");
		expect(declarations).toContain(
			"--color-new-gray:var(--pie-background-dark,#f3f5f7)",
		);
		expect(declarations).toContain(
			"--color-primary-white:var(--pie-white,#ffffff)",
		);
		expect(declarations).toContain(
			"--color-primary-black:var(--pie-text,#000000)",
		);
		expect(declarations).toContain(
			"--color-focus-blue:var(--pie-button-focus-outline,#2b87ff)",
		);
	});

	test("the floating shell bridges the palette for its own header controls", () => {
		// The shell's window controls are created imperatively, so the scoped
		// `.item-toolbar nds-icon-button` rule never matches them.
		const script = source.slice(0, source.lastIndexOf("<style"));
		expect(script).toContain(
			"shellEl.style.setProperty('--color-new-gray', 'var(--pie-background-dark, #f3f5f7)')",
		);
		expect(script).toContain("'--color-interactive-blue'");
		expect(script).toContain(
			"shellEl.style.setProperty('--color-primary-black', 'var(--pie-text, #000000)')",
		);
	});

	test("the tool shell header falls back to a themed surface, not a literal", () => {
		// Hosts rarely set --pie-section-player-card-header-background, so the
		// default is what ships: a literal there left the themed title text on a
		// light grey strip under every dark theme.
		const script = source.slice(0, source.lastIndexOf("<style"));
		expect(script).toContain(
			"'var(--pie-section-player-card-header-background, var(--pie-button-active-bg, #f3f4f6))'",
		);
	});

	test("calculator button size is settable per toolbar size", () => {
		expect(stripped).toContain(
			"--height-32:var(--pie-calculator-button-size,2rem)",
		);
		expect(stripped).toContain(
			"--height-32:var(--pie-calculator-button-size-sm,2.75rem)",
		);
		expect(stripped).toContain(
			"--height-32:var(--pie-calculator-button-size-lg,2.5rem)",
		);
	});
});
