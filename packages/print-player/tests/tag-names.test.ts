import { describe, expect, test } from "bun:test";
import { define } from "../src/ce-registry";
import { toPrintHashedTag, validateCustomElementTag } from "../src/tag-names";

describe("print tag helpers", () => {
	test("validates custom element names", () => {
		expect(validateCustomElementTag("pie-print-item")).toBe("pie-print-item");
		expect(() => validateCustomElementTag("pieprint")).toThrow(
			"must include a hyphen",
		);
	});

	test("ensures print hash tag is positive", () => {
		expect(toPrintHashedTag("pie-mc", "x", () => -99)).toBe("pie-mc-print-99");
	});
});

describe("ce-registry define", () => {
	test("fails fast for invalid tag names", () => {
		const TestEl = (() => {}) as unknown as CustomElementConstructor;
		expect(() => define("invalidtag", TestEl)).toThrow("must include a hyphen");
	});
});
