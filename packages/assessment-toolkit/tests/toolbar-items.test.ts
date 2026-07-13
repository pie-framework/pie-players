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

	test("keeps the standalone toolbar fallback metadata-only", () => {
		const source = readFileSync(ITEM_TOOLBAR_PATH, "utf8");

		expect(source).toContain("Metadata-only fallback");
		expect(source).toContain(
			"const fallbackToolRegistry = createPackagedToolRegistry();",
		);
		expect(source).not.toContain("@pie-players/pie-default-tool-loaders");
		expect(source).not.toContain("DEFAULT_TOOL_MODULE_LOADERS");
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
			"--color-interactive-blue:var(--pie-calculator-button-color,#146eb3)",
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
