import { describe, expect, test } from "bun:test";
import {
	toPrintHashedTag,
	toViewTag,
	validateCustomElementTag,
	VIEW_TAG_SUFFIX,
} from "../src/pie/tag-names";

describe("validateCustomElementTag", () => {
	test("accepts valid hyphenated names", () => {
		expect(validateCustomElementTag("pie-foo")).toBe("pie-foo");
		expect(validateCustomElementTag("multiple-choice")).toBe("multiple-choice");
		expect(validateCustomElementTag("foo--version-1-2-3")).toBe(
			"foo--version-1-2-3",
		);
	});

	test("rejects names without hyphen", () => {
		expect(() => validateCustomElementTag("foo")).toThrow(
			"must include a hyphen",
		);
	});

	test("rejects uppercase names", () => {
		expect(() => validateCustomElementTag("Pie-Foo")).toThrow(
			"must be lowercase",
		);
	});

	test("rejects reserved names", () => {
		expect(() => validateCustomElementTag("annotation-xml")).toThrow(
			"reserved by the HTML spec",
		);
	});
});

describe("tag helpers", () => {
	test("toViewTag applies built-in suffixes", () => {
		expect(toViewTag("pie-mc", "delivery")).toBe("pie-mc");
		expect(toViewTag("pie-mc", "author")).toBe(
			`pie-mc${VIEW_TAG_SUFFIX.author}`,
		);
		expect(toViewTag("pie-mc", "print")).toBe(`pie-mc${VIEW_TAG_SUFFIX.print}`);
	});

	test("toPrintHashedTag uses a positive hash value", () => {
		const tag = toPrintHashedTag("pie-mc", "url", () => -123);
		expect(tag).toBe("pie-mc-print-123");
	});
});
