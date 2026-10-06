import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const css = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Each style rule as its comma-separated selectors and its declarations. */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
	([, prelude, body]) => ({
		selectors: prelude
			.split(/,(?![^(]*\))/)
			.map((selector) => selector.replace(/\s+/g, " ").trim()),
		body: body.replace(/\s+/g, " ").trim(),
	}),
);

const LAYOUT_EXCLUSION =
	':where(:not(.table-no-border, [role="presentation"]))';

/** Selectors keyed on a Bootstrap table class (not `.table-no-border`). */
const tableClassSelectors = rules
	.flatMap((rule) => rule.selectors)
	.filter((selector) =>
		/\.table(?:-bordered|-striped)?(?![\w-])/.test(selector),
	);

describe("Bootstrap table classes", () => {
	test("finds the table rules", () => {
		expect(tableClassSelectors.length).toBeGreaterThanOrEqual(10);
	});

	// A layout table is marked by the class alone in one exported markup, which
	// spells the role into the class list and carries no role attribute.
	test("leave layout tables unstyled", () => {
		const unguarded = tableClassSelectors.filter(
			(selector) => !selector.includes(LAYOUT_EXCLUSION),
		);
		expect(unguarded).toEqual([]);
	});

	test("guard the table itself, so descendant rules follow it", () => {
		for (const selector of tableClassSelectors) {
			expect(selector).toMatch(
				/\.table(?:-bordered|-striped)?(?:\.lrn_width_auto)?:where\(:not\(\.table-no-border, \[role="presentation"\]\)\)/,
			);
		}
	});
});
