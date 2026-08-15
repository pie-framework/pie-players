import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * Card headings render at `base-heading-level`, so their tag is composition
 * context rather than a fixed choice. Both cards styled the title as
 * `.pie-section-player-content-card-header h2` — the level the default happens
 * to produce — so a host that published any other level got a title with no card
 * styling at all, and nothing failed to say so.
 */
const CARDS = [
	"../src/components/shared/SectionItemCard.svelte",
	"../src/components/shared/SectionPassageCard.svelte",
];

const HEADER = ".pie-section-player-content-card-header";

describe("card title styling survives a published heading level", () => {
	for (const relPath of CARDS) {
		const source = readFileSync(resolve(import.meta.dir, relPath), "utf8");
		const name = relPath.split("/").pop();
		const declarations = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\s+/g, "");

		test(`${name} styles the title at every heading level`, () => {
			expect(declarations).toContain(
				`${HEADER}:is(h1,h2,h3,h4,h5,h6){`.replace(/\s+/g, ""),
			);
		});

		test(`${name} keeps no rule keyed to one level`, () => {
			expect(declarations).not.toContain(`${HEADER}h2{`);
		});

		test(`${name} renders the heading from the resolved level`, () => {
			// The selector only holds because the tag is derived, not literal.
			expect(source).toMatch(/this=\{`h\$\{resolvedHeadingLevel\}`\}/);
		});
	}
});
