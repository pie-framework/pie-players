/**
 * Parse-level coverage for `scopeStylesheetCss`.
 *
 * The unit tests next door compare output strings. That cannot tell you whether
 * the output is *valid CSS* — the bug being fixed produced strings that looked
 * plausible and that a CSS parser then threw away. So these tests inject the
 * scoped stylesheet into a document and assert against the CSSOM the parser
 * built from it: rule types, the preserved `@media` condition, the `@keyframes`
 * name, and — for the `:root` case — that the resulting selector actually
 * matches the player root element.
 *
 * happy-dom is not a browser, so this proves the output parses as structured
 * CSS, not how any specific engine renders it.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { scopeStylesheetCss } from "../src/ui/scope-css.js";

const SCOPE = ".pie-item-player.pie-abc";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

/** Inject scoped CSS and hand back the rules the parser actually produced. */
const parseScoped = (css: string): CSSRule[] => {
	const style = document.createElement("style");
	style.textContent = scopeStylesheetCss(css, SCOPE);
	document.head.appendChild(style);
	return Array.from(style.sheet?.cssRules ?? []);
};

/** The same stylesheet as the old regex scoped it, for comparison. */
const parseLegacyScoped = (css: string): CSSRule[] => {
	const style = document.createElement("style");
	style.textContent = css.replace(
		/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
		`${SCOPE} $1$2`,
	);
	document.head.appendChild(style);
	return Array.from(style.sheet?.cssRules ?? []);
};

const PARTNER_CSS = `
:root { --partner-accent: #b30000; }
.partner-content .table td { padding: 4px; }
@media screen and (min-width: 40em) {
	.partner-content .table td { padding: 8px; }
}
@font-face { font-family: PartnerSerif; }
@keyframes partner-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
`;

describe("scoped output parses as valid CSS", () => {
	test("every rule in a realistic partner stylesheet survives the parser", () => {
		const rules = parseScoped(PARTNER_CSS);
		expect(rules.map((rule) => rule.constructor.name)).toEqual([
			"CSSStyleRule",
			"CSSStyleRule",
			"CSSMediaRule",
			"CSSFontFaceRule",
			"CSSKeyframesRule",
		]);
	});

	test("the @media condition is preserved and its inner rule is scoped", () => {
		const media = parseScoped(PARTNER_CSS).find(
			(rule): rule is CSSMediaRule => rule.constructor.name === "CSSMediaRule",
		);
		expect(media).toBeDefined();
		expect(media?.conditionText).toContain("min-width: 40em");
		const inner = Array.from(media?.cssRules ?? []) as CSSStyleRule[];
		expect(inner).toHaveLength(1);
		expect(inner[0]?.selectorText).toBe(`${SCOPE} .partner-content .table td`);
	});

	test("@keyframes keeps its name, so animation-name still resolves", () => {
		const keyframes = parseScoped(PARTNER_CSS).find(
			(rule) => rule.constructor.name === "CSSKeyframesRule",
		) as CSSKeyframesRule | undefined;
		expect(keyframes?.name).toBe("partner-fade");
	});

	test("the old scoper produced no @media rule at all from the same input", () => {
		// The regression this fix exists for, stated as a parser outcome rather
		// than a string diff: the condition was destroyed, so the media rule was
		// simply not there.
		const legacy = parseLegacyScoped(PARTNER_CSS);
		expect(
			legacy.some((rule) => rule.constructor.name === "CSSMediaRule"),
		).toBe(false);
		expect(
			parseScoped(PARTNER_CSS).some(
				(rule) => rule.constructor.name === "CSSMediaRule",
			),
		).toBe(true);
	});
});

describe("the scoped :root rule targets the player root", () => {
	test("its selector matches the player element and not the document root", () => {
		const rules = parseScoped(":root { --partner-accent: #b30000; }");
		const styleRule = rules[0] as CSSStyleRule;
		expect(styleRule.selectorText).toBe(SCOPE);

		const player = document.createElement("div");
		player.className = "pie-item-player pie-abc";
		document.body.appendChild(player);

		expect(player.matches(styleRule.selectorText)).toBe(true);
		expect(document.documentElement.matches(styleRule.selectorText)).toBe(
			false,
		);
	});

	test("the old scoper produced a selector the player could never match", () => {
		const legacy = parseLegacyScoped(":root { --partner-accent: #b30000; }");
		const legacySelector = (legacy[0] as CSSStyleRule).selectorText;

		const player = document.createElement("div");
		player.className = "pie-item-player pie-abc";
		document.body.appendChild(player);

		expect(legacySelector).toContain(":root");
		expect(player.matches(legacySelector)).toBe(false);
	});
});

describe("flat rules parse the same as before", () => {
	test("selector text is equivalent between the old and new scopers", () => {
		const css = ".a { color: red; } .b > .c, .d { color: blue; }";
		// Compared modulo whitespace: the old scoper emitted `.scope  .b > .c,.scope  .d`
		// with a doubled space and none after the comma. Those select the same
		// elements, and matching its spacing is not a property worth preserving.
		const selectorsOf = (rules: CSSRule[]) =>
			rules.map((rule) =>
				(rule as CSSStyleRule).selectorText
					.replace(/\s+/g, " ")
					.replace(/\s*,\s*/g, ", ")
					.trim(),
			);
		expect(selectorsOf(parseScoped(css))).toEqual(
			selectorsOf(parseLegacyScoped(css)),
		);
	});
});
