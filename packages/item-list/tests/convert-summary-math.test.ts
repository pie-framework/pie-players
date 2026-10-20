import { describe, expect, test } from "bun:test";
import { convertSummaryMath, type ItemSummary } from "../src/summarize.js";

const TEX = "\\(x^2\\)";

const summary: ItemSummary = {
	schema: 1,
	stem: `<p>Given ${TEX}</p>`,
	entries: [
		{
			id: "1",
			pkg: "@pie-element/multiple-choice",
			source: "summary",
			label: "Multiple Choice",
			summary: {
				prompt: `<p>Solve ${TEX}</p>`,
				answer: `<p>${TEX}</p>`,
				options: [
					{ id: "a", label: `<p>${TEX}</p>`, group: `<p>${TEX}</p>`, correct: true },
					{ id: "b", label: "<p>None</p>", group: `<p>${TEX}</p>` },
				],
				parts: [{ id: "a", prompt: `<p>Part ${TEX}</p>`, options: [{ id: "c", label: `<p>${TEX}</p>` }] }],
				figure: { src: "https://example.com/graph.png", alt: TEX },
				manualScoring: true,
			},
		},
	],
};

describe("convertSummaryMath", () => {
	test("converts the TeX in every HTML field and keeps the rest", async () => {
		const converted = await convertSummaryMath(summary);
		const [entry] = converted.entries;
		const fields = [
			converted.stem,
			entry.summary.prompt,
			entry.summary.answer,
			entry.summary.options?.[0].label,
			...(entry.summary.options ?? []).map((option) => option.group),
			entry.summary.parts?.[0].prompt,
			entry.summary.parts?.[0].options?.[0].label,
		];
		for (const field of fields) {
			expect(field).toContain("<math");
			expect(field).not.toContain("\\(");
		}
		expect(entry.summary.options?.[1].label).toBe("<p>None</p>");
		// Equal groups stay equal, so the row still groups the options together.
		expect(entry.summary.options?.[0].group).toBe(entry.summary.options?.[1].group);
		expect(entry.summary.options?.[0].correct).toBe(true);
		expect(entry.summary.figure).toEqual(summary.entries[0].summary.figure);
		expect(entry.summary.manualScoring).toBe(true);
		expect({ ...entry, summary: undefined }).toEqual({ ...summary.entries[0], summary: undefined });
		expect(converted.schema).toBe(1);
	});

	test("adds no fields the summary did not have", async () => {
		const plain: ItemSummary = {
			schema: 1,
			entries: [{ id: "1", pkg: "@pie-element/x", source: "label", label: "X", summary: {} }],
		};
		expect(await convertSummaryMath(plain)).toEqual(plain);
	});
});
