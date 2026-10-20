import { describe, expect, test } from "bun:test";
import { displayName, packageName } from "../src/summarize/label.js";
import { hasContent, readItemMarkup } from "../src/summarize/markup.js";

const TAGS = new Set(["multiple-choice", "ebsr"]);

describe("readItemMarkup", () => {
	test("locates element tags in order and keeps the markup outside them", () => {
		const markup =
			'<p>Read this.</p><multiple-choice id="1"><span>inner</span></multiple-choice><ebsr id=\'2\'></ebsr><p>After</p>';
		expect(readItemMarkup(markup, TAGS)).toEqual({
			elements: [
				{ tagName: "multiple-choice", id: "1" },
				{ tagName: "ebsr", id: "2" },
			],
			outside: "<p>Read this.</p><p>After</p>",
		});
	});

	test("runs a span to the close tag that matches its own nesting", () => {
		const markup =
			'<multiple-choice id="a"><multiple-choice id="b"></multiple-choice>still a</multiple-choice>out';
		const result = readItemMarkup(markup, TAGS);
		expect(result.elements).toEqual([{ tagName: "multiple-choice", id: "a" }]);
		expect(result.outside).toBe("out");
	});

	test("ends an unclosed element at its open tag", () => {
		const result = readItemMarkup('<p>Stem</p><ebsr id="1"><p>Tail</p>', TAGS);
		expect(result.elements).toEqual([{ tagName: "ebsr", id: "1" }]);
		expect(result.outside).toBe("<p>Stem</p><p>Tail</p>");
	});

	test("reads a quoted `>` as part of an attribute", () => {
		const result = readItemMarkup(
			'<multiple-choice data-note="a > b" id="1"></multiple-choice>x',
			TAGS,
		);
		expect(result.elements).toEqual([{ tagName: "multiple-choice", id: "1" }]);
		expect(result.outside).toBe("x");
	});

	test("matches tags case-insensitively and reads unquoted and self-closing tags", () => {
		const result = readItemMarkup("<EBSR id=7 />rest", TAGS);
		expect(result.elements).toEqual([{ tagName: "ebsr", id: "7" }]);
		expect(result.outside).toBe("rest");
	});

	test("leaves tags outside the set in the markup", () => {
		const markup = '<other-element id="1"></other-element>';
		expect(readItemMarkup(markup, TAGS)).toEqual({ elements: [], outside: markup });
	});
});

describe("hasContent", () => {
	test("counts text and images, not tags, whitespace or non-breaking spaces", () => {
		expect(hasContent("<p>Hi</p>")).toBe(true);
		expect(hasContent('<p><img src="a.png"></p>')).toBe(true);
		expect(hasContent("<p> &nbsp;&#160; </p><br>")).toBe(false);
		expect(hasContent("")).toBe(false);
		expect(hasContent(undefined)).toBe(false);
		expect(hasContent(42)).toBe(false);
	});
});

describe("labels", () => {
	test("strips the version from a package spec", () => {
		expect(packageName("@pie-element/multiple-choice@11.0.0")).toBe(
			"@pie-element/multiple-choice",
		);
		expect(packageName("@pie-element/ebsr")).toBe("@pie-element/ebsr");
		expect(packageName("plain-element@1.2.3")).toBe("plain-element");
	});

	test("derives a display name from the package", () => {
		expect(displayName("@pie-element/multiple-choice")).toBe("Multiple choice");
		expect(displayName("@pie-element/drag_in_the_blank")).toBe("Drag in the blank");
		expect(displayName("ebsr")).toBe("Ebsr");
	});
});
