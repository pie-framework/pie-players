import { describe, expect, test } from "bun:test";
import { isItemSummary } from "../src/summarize.js";

const entry = {
	id: "1",
	pkg: "@pie-element/multiple-choice",
	source: "summary",
	label: "Multiple choice",
	summary: {
		prompt: "<p>Pick one</p>",
		options: [{ id: "a", label: "Four", correct: true, group: "Numbers" }],
		parts: [{ id: "A", prompt: "Part A", options: [{ id: "x", label: "X" }], answer: "X" }],
		figure: { src: "a.png", alt: "A" },
		media: [{ kind: "video", src: "a.mp4", title: "Clip" }],
		manualScoring: false,
	},
};

describe("isItemSummary", () => {
	test("accepts a complete schema-1 summary and ignores unknown fields", () => {
		expect(isItemSummary({ schema: 1, stem: "<p>Stem</p>", entries: [entry], extra: true })).toBe(true);
		expect(isItemSummary({ schema: 1, entries: [{ ...entry, summary: {} }] })).toBe(true);
	});

	test.each([
		["another schema", { schema: 2, entries: [] }],
		["no entries", { schema: 1 }],
		["a non-string stem", { schema: 1, stem: 1, entries: [] }],
		["an unknown source", { schema: 1, entries: [{ ...entry, source: "guess" }] }],
		["a missing summary", { schema: 1, entries: [{ ...entry, summary: undefined }] }],
		["an option without a label", { schema: 1, entries: [{ ...entry, summary: { options: [{ id: "a" }] } }] }],
		["a non-boolean correct", { schema: 1, entries: [{ ...entry, summary: { options: [{ id: "a", label: "A", correct: "yes" }] } }] }],
		["a part with a numeric prompt", { schema: 1, entries: [{ ...entry, summary: { parts: [{ prompt: 1 }] } }] }],
		["a figure without src", { schema: 1, entries: [{ ...entry, summary: { figure: { alt: "A" } } }] }],
		["an unknown media kind", { schema: 1, entries: [{ ...entry, summary: { media: [{ kind: "image" }] } }] }],
		["null", null],
	])("rejects %s", (_name, value) => {
		expect(isItemSummary(value)).toBe(false);
	});
});
