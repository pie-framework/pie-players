import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * `font-sizes.css` scales the content hosts — `pie-item-shell`,
 * `pie-passage-shell`, `pie-item-player` — and text inside them that inherits
 * its size follows. These three components style text that does *not* inherit
 * it: the cards wrap the shells rather than sitting inside them, so nothing
 * above their rules carries the scaled size, and a tab label declares its own.
 * Each therefore has to read `--pie-font-scale` itself or it stays fixed while
 * the item body grows to 175%.
 *
 * Root-relative, never `em`: the scaled hosts nest inside these cards, so an
 * `em` factor would compound and turn a requested 1.25 into 1.56.
 *
 * Tool and debug chrome is deliberately not in this list. A font accommodation
 * applies to what the learner reads, and a calculator keypad growing with the
 * passage is a layout problem rather than an accommodation.
 */
const CONTENT_COMPONENTS = [
	"../src/components/shared/SectionItemCard.svelte",
	"../src/components/shared/SectionPassageCard.svelte",
	"../src/components/shared/SectionPlayerTabbedContent.svelte",
];

const declarationsOf = (source: string): string[] =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("font-size:"));

describe("learner-facing text outside the scaled hosts", () => {
	for (const relPath of CONTENT_COMPONENTS) {
		const source = readFileSync(resolve(import.meta.dir, relPath), "utf8");
		const name = relPath.split("/").pop();
		const declarations = declarationsOf(source);

		test(`${name} declares at least one font size to hold to this rule`, () => {
			// Guards the guard: a rename that empties this list would otherwise make
			// every assertion below vacuously pass.
			expect(declarations.length).toBeGreaterThan(0);
		});

		test(`${name} scales every font size it declares`, () => {
			for (const declaration of declarations) {
				expect(declaration).toContain("var(--pie-font-scale, 1)");
			}
		});

		test(`${name} sizes text in rem, never px`, () => {
			// A pixel size ignores the accommodation and the reader's own browser
			// font size together. `SectionPlayerTabbedContent` carried the last one
			// in this path as a hard 12px.
			for (const declaration of declarations) {
				expect(declaration).not.toMatch(/\d\s*px/);
			}
		});

		test(`${name} scales from the root, so it cannot compound`, () => {
			for (const declaration of declarations) {
				expect(declaration).toContain("rem");
				// `(?<!r)em` so `rem` is not read as a bare `em` factor.
				expect(declaration).not.toMatch(/(?<!r)em\b/);
			}
		});
	}
});
