import { describe, expect, test } from "bun:test";

import { scopeSelector, scopeStylesheetCss } from "../src/ui/scope-css.js";

const SCOPE = ".pie-item-player.pie-abc";

/** Comparisons here are about structure, not the formatter's whitespace. */
const norm = (css: string) => css.replace(/\s+/g, " ").trim();

const scope = (css: string) => norm(scopeStylesheetCss(css, SCOPE));

describe("flat selector rules — the behaviour existing consumers could depend on", () => {
	test("a single rule is prefixed with the scope", () => {
		expect(scope(".a { color: red; }")).toBe(
			`${SCOPE} .a { color: red; }`.replace(/\s+/g, " "),
		);
	});

	test("each selector in a list is scoped independently", () => {
		expect(scope(".a, .b > .c { color: red; }")).toBe(
			`${SCOPE} .a, ${SCOPE} .b > .c { color: red; }`,
		);
	});

	test("element, id, attribute and descendant selectors all scope", () => {
		expect(scope("table td[data-x] { color: red; }")).toBe(
			`${SCOPE} table td[data-x] { color: red; }`,
		);
		expect(scope("#main .a { color: red; }")).toBe(
			`${SCOPE} #main .a { color: red; }`,
		);
	});

	test("a leading pseudo-class becomes a descendant, not a qualifier on the root", () => {
		// `:hover` meant "some hovered element", so it must not become
		// `.scope:hover`, which is the player's own box.
		expect(scope(":hover { color: red; }")).toBe(
			`${SCOPE} :hover { color: red; }`,
		);
		expect(scope("::selection { background: yellow; }")).toBe(
			`${SCOPE} ::selection { background: yellow; }`,
		);
	});

	test("declarations are emitted verbatim, including url() references", () => {
		const out = scopeStylesheetCss(
			".a { background: url(img/x.png) no-repeat; }",
			SCOPE,
		);
		expect(out).toContain("url(img/x.png) no-repeat");
	});

	test("multiple rules are all scoped", () => {
		expect(scope(".a { color: red; } .b { color: blue; }")).toBe(
			`${SCOPE} .a { color: red; } ${SCOPE} .b { color: blue; }`,
		);
	});
});

describe(":root, html and body are replaced rather than prefixed", () => {
	test(":root becomes the scope, so custom properties actually apply", () => {
		expect(scope(":root { --pie-color: red; }")).toBe(
			`${SCOPE} { --pie-color: red; }`,
		);
	});

	test("html and body become the scope", () => {
		expect(scope("html { color: red; }")).toBe(`${SCOPE} { color: red; }`);
		expect(scope("body { color: red; }")).toBe(`${SCOPE} { color: red; }`);
	});

	test("anything following the root selector is preserved", () => {
		expect(scope("html.dark .a { color: red; }")).toBe(
			`${SCOPE}.dark .a { color: red; }`,
		);
		expect(scope(":root[dir='rtl'] .a { color: red; }")).toBe(
			`${SCOPE}[dir='rtl'] .a { color: red; }`,
		);
		expect(scope("body > .a { color: red; }")).toBe(
			`${SCOPE} > .a { color: red; }`,
		);
		expect(scope("body:not(.x) { color: red; }")).toBe(
			`${SCOPE}:not(.x) { color: red; }`,
		);
	});

	test("a class or element merely starting with those names is left alone", () => {
		expect(scope(".bodyguard { color: red; }")).toBe(
			`${SCOPE} .bodyguard { color: red; }`,
		);
		expect(scope("htmlish { color: red; }")).toBe(
			`${SCOPE} htmlish { color: red; }`,
		);
	});

	test("a non-leading html or body is not touched", () => {
		expect(scope(".a body { color: red; }")).toBe(
			`${SCOPE} .a body { color: red; }`,
		);
	});
});

describe("conditional group at-rules keep their condition and scope inside", () => {
	test("@media keeps its condition and scopes the inner rules", () => {
		expect(
			scope("@media screen and (min-width: 40em) { .a { color: red; } }"),
		).toBe(
			`@media screen and (min-width: 40em) { ${SCOPE} .a { color: red; } }`,
		);
	});

	test("the @media condition is never prefixed with the scope", () => {
		const out = scopeStylesheetCss(
			"@media print { .a { color: red; } }",
			SCOPE,
		);
		expect(out).not.toContain(`${SCOPE} @media`);
		expect(out).toContain("@media print");
	});

	test("@supports keeps its condition", () => {
		expect(scope("@supports (display: grid) { .a { display: grid; } }")).toBe(
			`@supports (display: grid) { ${SCOPE} .a { display: grid; } }`,
		);
	});

	test("@container and @layer blocks recurse", () => {
		expect(scope("@container (min-width: 20em) { .a { color: red; } }")).toBe(
			`@container (min-width: 20em) { ${SCOPE} .a { color: red; } }`,
		);
		expect(scope("@layer base { .a { color: red; } }")).toBe(
			`@layer base { ${SCOPE} .a { color: red; } }`,
		);
	});

	test("nested conditional at-rules recurse all the way down", () => {
		expect(
			scope(
				"@media screen { @supports (display: grid) { .a { color: red; } } }",
			),
		).toBe(
			`@media screen { @supports (display: grid) { ${SCOPE} .a { color: red; } } }`,
		);
	});

	test("a :root inside @media is still replaced", () => {
		expect(scope("@media screen { :root { --x: 1; } }")).toBe(
			`@media screen { ${SCOPE} { --x: 1; } }`,
		);
	});

	test("a comma-separated media query list survives intact", () => {
		expect(scope("@media screen, print { .a { color: red; } }")).toBe(
			`@media screen, print { ${SCOPE} .a { color: red; } }`,
		);
	});
});

describe("at-rules whose blocks are not selectors pass through untouched", () => {
	test("@font-face is emitted verbatim, so the font still loads", () => {
		const out = scope(
			"@font-face { font-family: Foo; src: url(f.woff2) format('woff2'); }",
		);
		expect(out).toBe(
			"@font-face { font-family: Foo; src: url(f.woff2) format('woff2'); }",
		);
		expect(out).not.toContain(SCOPE);
	});

	test("@keyframes keeps its name and its percentage selectors", () => {
		const out = scope(
			"@keyframes spin { 0% { opacity: 0; } 100% { opacity: 1; } }",
		);
		expect(out).toBe(
			"@keyframes spin { 0% { opacity: 0; } 100% { opacity: 1; } }",
		);
		expect(out).not.toContain(SCOPE);
	});

	test("a vendor-prefixed @keyframes is recognised too", () => {
		const out = scope("@-webkit-keyframes spin { from { opacity: 0; } }");
		expect(out).toBe("@-webkit-keyframes spin { from { opacity: 0; } }");
		expect(out).not.toContain(SCOPE);
	});

	test("@page, @property and @counter-style pass through", () => {
		expect(scope("@page { margin: 1cm; }")).toBe("@page { margin: 1cm; }");
		expect(scope("@property --x { syntax: '<color>'; inherits: false; }")).toBe(
			"@property --x { syntax: '<color>'; inherits: false; }",
		);
		expect(scope("@counter-style thumbs { system: cyclic; }")).toBe(
			"@counter-style thumbs { system: cyclic; }",
		);
	});

	test("an unrecognised at-rule is left alone rather than guessed at", () => {
		expect(scope("@totally-new (x) { .a { color: red; } }")).toBe(
			"@totally-new (x) { .a { color: red; } }",
		);
	});
});

describe("statement at-rules", () => {
	test("@import passes through unchanged, as it did before", () => {
		expect(scope("@import url('other.css'); .a { color: red; }")).toBe(
			`@import url('other.css'); ${SCOPE} .a { color: red; }`,
		);
	});

	test("@charset and a block-less @layer pass through", () => {
		expect(scope('@charset "utf-8"; .a { color: red; }')).toBe(
			`@charset "utf-8"; ${SCOPE} .a { color: red; }`,
		);
		expect(scope("@layer a, b; .a { color: red; }")).toBe(
			`@layer a, b; ${SCOPE} .a { color: red; }`,
		);
	});
});

describe("parsing is string- and paren-aware", () => {
	test("a comma inside :is() does not split the selector list", () => {
		expect(scope(":is(.a, .b) .c { color: red; }")).toBe(
			`${SCOPE} :is(.a, .b) .c { color: red; }`,
		);
	});

	test("a brace inside a string does not end the block", () => {
		const out = scope('.a { content: "{"; color: red; }');
		expect(out).toBe(`${SCOPE} .a { content: "{"; color: red; }`);
	});

	test("a comment between rules is not absorbed into the next selector", () => {
		expect(scope(".a { color: red; } /* note */ .b { color: blue; }")).toBe(
			`${SCOPE} .a { color: red; } ${SCOPE} .b { color: blue; }`,
		);
	});

	test("a comment-like string literal survives", () => {
		expect(scope('.a { content: "/*"; }')).toBe(
			`${SCOPE} .a { content: "/*"; }`,
		);
	});

	test("a comment inside a selector list is stripped without gluing tokens", () => {
		expect(scope(".a /* x */ .b { color: red; }")).toBe(
			`${SCOPE} .a .b { color: red; }`,
		);
	});
});

describe("native CSS nesting", () => {
	test("a style rule's block is emitted verbatim, so nested selectors stay relative", () => {
		const out = scope(".a { color: red; & .b { color: blue; } }");
		expect(out).toBe(`${SCOPE} .a { color: red; & .b { color: blue; } }`);
	});
});

describe("edge cases", () => {
	test("empty and non-string input yield an empty string", () => {
		expect(scopeStylesheetCss("", SCOPE)).toBe("");
		expect(scopeStylesheetCss(undefined, SCOPE)).toBe("");
		expect(scopeStylesheetCss(null, SCOPE)).toBe("");
		expect(scopeStylesheetCss(42, SCOPE)).toBe("");
	});

	test("an empty scope selector returns the CSS untouched", () => {
		expect(scopeStylesheetCss(".a { color: red; }", "  ")).toBe(
			".a { color: red; }",
		);
	});

	test("an unterminated block is scoped rather than dropped or thrown on", () => {
		expect(scope(".a { color: red;")).toBe(`${SCOPE} .a { color: red;}`);
	});

	test("scoping is idempotent", () => {
		const once = scopeStylesheetCss(".a { color: red; }", SCOPE);
		expect(norm(scopeStylesheetCss(once, SCOPE))).toBe(norm(once));
	});

	test("whitespace-only input produces nothing", () => {
		expect(scope("\n\n  \t")).toBe("");
	});
});

describe("regressions against the old single-regex scoper", () => {
	// Each of these was mangled by
	// `css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, '<scope> $1$2')`.
	const cases: Array<[string, string]> = [
		[":root vars", ":root { --pie-color: red; }"],
		["@media", "@media screen and (min-width: 40em) { .a { color: red; } }"],
		["@supports", "@supports (display: grid) { .a { display: grid; } }"],
		["@font-face", "@font-face { font-family: Foo; }"],
		["@keyframes", "@keyframes spin { 0% { opacity: 0; } }"],
	];

	for (const [name, css] of cases) {
		test(`${name} no longer produces an invalid scoped selector`, () => {
			const out = scopeStylesheetCss(css, SCOPE);
			// The old output glued the scope onto an at-rule or onto `:root`.
			expect(out).not.toContain(`${SCOPE} @`);
			expect(out).not.toContain(`${SCOPE} :root`);
			expect(out).not.toContain(`${SCOPE} 0%`);
		});
	}
});

describe("scopeSelector", () => {
	test("empty selector or empty scope yields an empty string", () => {
		expect(scopeSelector("", SCOPE)).toBe("");
		expect(scopeSelector("   ", SCOPE)).toBe("");
		expect(scopeSelector(".a", "")).toBe("");
	});

	test("an already-scoped selector is returned unchanged", () => {
		expect(scopeSelector(`${SCOPE} .a`, SCOPE)).toBe(`${SCOPE} .a`);
		expect(scopeSelector(SCOPE, SCOPE)).toBe(SCOPE);
	});
});
