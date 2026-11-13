import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
);

const CONTENT_ROOT = ":where([data-pie-content]) ";

/**
 * The one unprefixed legacy content class that stays document-wide. A stacked
 * fraction is rendered in menus portaled to `<body>`, outside every content
 * root. The other legacy classes (`.abs`, `.variable`, `.whole`, `.noprint` and
 * the rest) are common words a host page can carry too, so they are confined.
 */
const PAGE_WIDE_CONTENT_CLASSES = new Set(["frac"]);

/** KDS classes and MathJax output, which only authored content carries. */
const AUTHORED_PREFIXES = ["kds-", "Kds", "mjx-", "TEX-"];

/** The markers a sanitizer puts on an element with an authored colour. */
const AUTHORED_ATTRIBUTE = /\[data-pie-authored-[\w-]+/;

/** Rules that declare custom properties only, on the element that carries the theme. */
const THEME_ROOTS = new Set([":root", "[data-color-scheme]"]);

const withoutPseudoArguments = (selector: string): string => {
	let current = selector;
	let previous: string;
	do {
		previous = current;
		current = current.replace(/\([^()]*\)/g, "");
	} while (current !== previous);
	return current;
};

/** Whether matching the selector requires a name only authored content carries. */
const requiresAuthoredName = (selector: string): boolean => {
	const bare = withoutPseudoArguments(selector);
	if (AUTHORED_ATTRIBUTE.test(bare)) return true;
	const names = [
		...(bare.match(/(?<=\.)-?[_a-zA-Z][\w-]*/g) ?? []),
		...(bare.match(/(?<=^|[\s>+~])mjx-[\w-]+/g) ?? []),
	];
	return names.some(
		(name) =>
			PAGE_WIDE_CONTENT_CLASSES.has(name) ||
			AUTHORED_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);
};

/** Every style-rule selector, one per entry, with at-rule preludes and keyframe stops left out. */
const selectors = (() => {
	const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
	const found: string[] = [];
	let depth = 0;
	let keyframesDepth = -1;
	let prelude = "";
	for (const char of css) {
		if (char === "{") {
			const text = prelude.trim();
			if (text.startsWith("@keyframes")) keyframesDepth = depth;
			else if (!text.startsWith("@") && keyframesDepth < 0) {
				// A comma inside `:not(a, b)` separates arguments, not selectors.
				found.push(
					...text
						.split(/,(?![^(]*\))/)
						.map((part) => part.replace(/\s+/g, " ").trim()),
				);
			}
			depth += 1;
			prelude = "";
		} else if (char === "}") {
			depth -= 1;
			if (depth === keyframesDepth) keyframesDepth = -1;
			prelude = "";
		} else if (char === ";") {
			prelude = "";
		} else {
			prelude += char;
		}
	}
	return found.filter((selector) => selector && !THEME_ROOTS.has(selector));
})();

describe("components.css confinement", () => {
	test("finds the stylesheet's selectors", () => {
		expect(selectors.length).toBeGreaterThan(100);
	});

	test("confines every rule that does not require an authored-content name", () => {
		const unconfined = selectors.filter(
			(selector) =>
				!selector.startsWith(CONTENT_ROOT) && !requiresAuthoredName(selector),
		);
		expect(unconfined).toEqual([]);
	});

	// Elements portal menus and popovers holding authored markup to <body>,
	// outside every [data-pie-content] root, and those rules have to reach it.
	test("leaves KDS, MathJax and fraction rules document-wide", () => {
		const confined = selectors.filter(
			(selector) =>
				selector.startsWith(CONTENT_ROOT) &&
				requiresAuthoredName(selector.slice(CONTENT_ROOT.length)),
		);
		expect(confined).toEqual([]);
		expect(selectors).toContain("table.kds-fraction");
		expect(selectors).toContain(".TEX-I");
		expect(selectors).toContain("table.frac");
		expect(selectors).toContain(
			'[data-color-scheme] [data-pie-authored-fill="shade"]',
		);
	});

	test("confines the legacy content classes that are common words", () => {
		for (const name of ["abs", "noprint", "variable", "whole", "fillin"]) {
			const rules = selectors.filter((selector) =>
				new RegExp(`\\.${name}(?![\\w-])`).test(selector),
			);
			expect(rules.length).toBeGreaterThan(0);
			for (const rule of rules) expect(rule.startsWith(CONTENT_ROOT)).toBe(true);
		}
	});

	test("lists only page-wide classes the stylesheet styles", () => {
		const styled = new Set(
			selectors.flatMap(
				(selector) => selector.match(/(?<=\.)-?[_a-zA-Z][\w-]*/g) ?? [],
			),
		);
		expect(
			[...PAGE_WIDE_CONTENT_CLASSES].filter((name) => !styled.has(name)),
		).toEqual([]);
	});
});
