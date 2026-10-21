import "./support/dom.js";
import { describe, expect, test } from "bun:test";
import { highlightSegments } from "../src/list/highlights.js";

const text = (snippet: string) =>
	highlightSegments(snippet)
		.map((segment) => (segment.mark ? `[${segment.text}]` : segment.text))
		.join("");

describe("highlightSegments", () => {
	test("keeps the words of neighbouring blocks and line breaks apart", () => {
		expect(text("<p>one</p><p><mark>two</mark></p>three<br>four")).toBe("one [two] three four");
	});

	test("drops the tail of a tag the fragmenter cut through at the start", () => {
		expect(text('ss="lead">the <mark>river</mark>')).toBe("the [river]");
		expect(text("p>the <mark>river</mark>")).toBe("the [river]");
		expect(text("5 > 3 and <mark>river</mark>")).toBe("5 > 3 and [river]");
	});

	test("reads an entity-encoded HTML field as its text", () => {
		expect(text("&lt;p class=&quot;x&quot;&gt;the <mark>river</mark> &amp;amp; banks&lt;/p&gt;")).toBe(
			"the [river] & banks ",
		);
	});
});
