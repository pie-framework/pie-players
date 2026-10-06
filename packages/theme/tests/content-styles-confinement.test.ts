import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
);

const CONTENT_ROOT = ":where([data-pie-content]) ";

/**
 * Unprefixed legacy content classes. They name content semantics (a book title,
 * a stacked fraction, a numbered paragraph) rather than presentation, so no
 * host UI carries them.
 */
const LEGACY_CONTENT_CLASSES = new Set([
	"abs",
	"block-quote",
	"book-title",
	"book-title-k5",
	"content-emphasis",
	"embedded-error",
	"equation-block",
	"evaluate-bottom-border",
	"fillin",
	"frac",
	"newradical",
	"noprint",
	"numbered-paragraph",
	"p-number",
	"passage-author",
	"passage-subtitle",
	"passage-title",
	"proper-name",
	"relative-emphasis",
	"short-quote",
	"text-block",
	"variable",
	"Verdana2t",
	"whole",
	"word-callout",
]);

/** KDS classes and MathJax output, which only authored content carries. */
const AUTHORED_PREFIXES = ["kds-", "Kds", "mjx-", "TEX-"];

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
	const names = [
		...(bare.match(/(?<=\.)-?[_a-zA-Z][\w-]*/g) ?? []),
		...(bare.match(/(?<=^|[\s>+~])mjx-[\w-]+/g) ?? []),
	];
	return names.some(
		(name) =>
			LEGACY_CONTENT_CLASSES.has(name) ||
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
	return found.filter((selector) => selector && selector !== ":root");
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
	test("leaves KDS, MathJax and legacy-content rules document-wide", () => {
		const confined = selectors.filter(
			(selector) =>
				selector.startsWith(CONTENT_ROOT) &&
				requiresAuthoredName(selector.slice(CONTENT_ROOT.length)),
		);
		expect(confined).toEqual([]);
		expect(selectors).toContain("table.kds-fraction");
		expect(selectors).toContain(".TEX-I");
		expect(selectors).toContain(".noprint");
	});

	test("lists only legacy classes the stylesheet styles", () => {
		const styled = new Set(
			selectors.flatMap(
				(selector) => selector.match(/(?<=\.)-?[_a-zA-Z][\w-]*/g) ?? [],
			),
		);
		expect(
			[...LEGACY_CONTENT_CLASSES].filter((name) => !styled.has(name)),
		).toEqual([]);
	});
});
