import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * The three scrolling panes style their scrollbar chrome from
 * --pie-scrollbar-thumb / -track / -thumb-hover. Those are package-private
 * hooks: no theme and no colour scheme sets them, so their fallback is what
 * every host renders, and a literal there pinned a light grey scrollbar on
 * every dark theme and colour scheme. Each has to default through a canonical
 * token — the thumb and its hover through the boundary families, which the
 * DaisyUI mapping corrects to 3:1 against the surface, and the track through
 * the surface one step off the page.
 */
const PANES = [
	"../src/components/PieSectionPlayerSplitPaneElement.svelte",
	"../src/components/shared/SectionPlayerTabbedContent.svelte",
	"../src/components/shared/SectionPlayerVerticalContent.svelte",
];

const EXPECTED_CHAINS = [
	"var(--pie-scrollbar-thumb, var(--pie-border, #6b7280))",
	"var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db))",
	"var(--pie-scrollbar-thumb-hover, var(--pie-border-dark, #4b5563))",
];

describe("scrollbar chrome follows the theme", () => {
	for (const relPath of PANES) {
		const source = readFileSync(resolve(import.meta.dir, relPath), "utf8");
		const name = relPath.split("/").pop();

		test(`${name} defaults every scrollbar hook through a canonical token`, () => {
			for (const chain of EXPECTED_CHAINS) {
				expect(source).toContain(chain);
			}
		});

		test(`${name} keeps no bare literal behind a scrollbar hook`, () => {
			const declarations = source
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\s+/g, "");
			expect(declarations).not.toContain("var(--pie-scrollbar-thumb,#");
			expect(declarations).not.toContain("var(--pie-scrollbar-track,#");
			expect(declarations).not.toContain("var(--pie-scrollbar-thumb-hover,#");
		});
	}
});
