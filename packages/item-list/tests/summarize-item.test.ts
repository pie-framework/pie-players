import { describe, expect, spyOn, test } from "bun:test";
import type { ElementSummary, SummarizeFn } from "@pie-element/shared-types";
import type { PieContent, PieModel } from "@pie-players/pie-players-shared/types";
import { type SummaryResolver, summarizeItem } from "../src/summarize.js";
import { withoutAnswers } from "../src/summarize/summarize-item.js";

function item(
	models: PieModel[],
	markup = models.map((m) => `<${m.element} id="${m.id}"></${m.element}>`).join(""),
): PieContent {
	const elements: Record<string, string> = {};
	for (const model of models) elements[model.element] = `@pie-element/${model.element}@1.2.3`;
	return { id: "item", elements, models, markup };
}

const resolverOf =
	(summarize: SummarizeFn | null): SummaryResolver =>
	async () =>
		summarize;

/** Sends every element to the prompt or label rung. */
const noSummaries = resolverOf(null);

describe("prompt and label rungs", () => {
	test("takes the model prompt and drops instructor-only model fields", async () => {
		const summary = await summarizeItem(
			item([
				{
					id: "1",
					element: "multiple-choice",
					prompt: "<p>Pick one</p>",
					teacherInstructions: "<p>Secret</p>",
					rationale: "<p>Because</p>",
				},
			]),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary).toEqual({
			schema: 1,
			entries: [
				{
					id: "1",
					pkg: "@pie-element/multiple-choice",
					source: "prompt",
					label: "Multiple choice",
					summary: { prompt: "<p>Pick one</p>" },
				},
			],
		});
	});

	test("skips a prompt the model disables", async () => {
		const summary = await summarizeItem(
			item([
				{ id: "1", element: "drawing-response", prompt: "<p>Draw</p>", promptEnabled: false },
			]),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary.entries[0]).toMatchObject({ source: "label", label: "Drawing response" });
	});

	test("counts an image-only prompt as content", async () => {
		const summary = await summarizeItem(
			item([{ id: "1", element: "hotspot", prompt: '<p><img src="map.png"></p>' }]),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary.entries[0]?.source).toBe("prompt");
	});

	test("reads a multi-part element's prompts as parts", async () => {
		const summary = await summarizeItem(
			item([
				{
					id: "1",
					element: "ebsr",
					partA: { prompt: "<p>Part A</p>" },
					partB: { prompt: "<p>Part B</p>" },
					partC: { prompt: "<p>Off</p>", promptEnabled: false },
					choices: [{ prompt: "<p>Not a part</p>" }],
				},
			]),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary.entries[0]).toMatchObject({
			source: "prompt",
			summary: {
				parts: [
					{ id: "partA", prompt: "<p>Part A</p>" },
					{ id: "partB", prompt: "<p>Part B</p>" },
				],
			},
		});
	});

	test("summarizes through the bundled summarizers by default", async () => {
		const summary = await summarizeItem(
			item([
				{
					id: "1",
					element: "multiple-choice",
					prompt: "<p>Pick one</p>",
					choices: [{ value: "a", label: "Four", correct: true }],
				},
			]),
			{ role: "instructor" },
		);
		expect(summary.entries[0]).toMatchObject({
			source: "summary",
			summary: { prompt: "<p>Pick one</p>", options: [{ id: "a", label: "Four", correct: true }] },
		});
	});

	test("drops label entries when another entry has content", async () => {
		const summary = await summarizeItem(
			item([
				{ id: "1", element: "multiple-choice", prompt: "<p>Pick</p>" },
				{ id: "2", element: "drawing-response" },
			]),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary.entries.map((entry) => entry.id)).toEqual(["1"]);
	});

	test("keeps label entries when no entry has content, whatever the stem holds", async () => {
		const models = [{ id: "1", element: "drawing-response" }];
		const summary = await summarizeItem(
			item(models, '<p>Stem</p><drawing-response id="1"></drawing-response>'),
			{ role: "instructor", resolve: noSummaries },
		);
		expect(summary.stem).toBe("<p>Stem</p>");
		expect(summary.entries).toEqual([
			{
				id: "1",
				pkg: "@pie-element/drawing-response",
				source: "label",
				label: "Drawing response",
				summary: {},
			},
		]);
	});
});

describe("element order", () => {
	const models: PieModel[] = [
		{ id: "a", element: "multiple-choice", prompt: "<p>A</p>" },
		{ id: "b", element: "extended-text-entry", prompt: "<p>B</p>" },
		{ id: "c", element: "multiple-choice", prompt: "<p>C</p>" },
	];

	test("follows the markup and skips models it does not tag", async () => {
		const summary = await summarizeItem(
			item(
				models,
				'<extended-text-entry id="b"></extended-text-entry><p> </p><multiple-choice id="a"></multiple-choice><multiple-choice id="a"></multiple-choice>',
			),
			{ role: "instructor" },
		);
		expect(summary.entries.map((entry) => entry.id)).toEqual(["b", "a"]);
		expect(summary.stem).toBeUndefined();
	});

	test("follows the models when the item has no markup", async () => {
		const summary = await summarizeItem(item(models, ""), { role: "instructor" });
		expect(summary.entries.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
	});

	test("reads an item nested under `pie`", async () => {
		const summary = await summarizeItem(
			{ id: "outer", pie: item([models[0] as PieModel]) },
			{ role: "instructor" },
		);
		expect(summary.entries.map((entry) => entry.id)).toEqual(["a"]);
	});
});

describe("summary rung", () => {
	const graded: ElementSummary = {
		prompt: "<p>Pick</p>",
		options: [
			{ id: "x", label: "X", correct: true },
			{ id: "y", label: "Y" },
		],
		answer: "<p>X</p>",
		parts: [{ id: "p", options: [{ id: "z", label: "Z", correct: true }], answer: "Z" }],
	};

	test("asks the resolver with the versioned spec and uses a non-empty summary", async () => {
		const calls: [string, string][] = [];
		const summary = await summarizeItem(
			item([{ id: "1", element: "multiple-choice", prompt: "<p>Model prompt</p>" }]),
			{
				role: "instructor",
				resolve: async (tagName, pkg) => {
					calls.push([tagName, pkg]);
					return () => graded;
				},
			},
		);
		expect(calls).toEqual([["multiple-choice", "@pie-element/multiple-choice@1.2.3"]]);
		expect(summary.entries[0]).toMatchObject({
			source: "summary",
			pkg: "@pie-element/multiple-choice",
			summary: graded,
		});
	});

	test("falls back to the prompt for a missing summarizer or an empty summary", async () => {
		const model = { id: "1", element: "multiple-choice", prompt: "<p>Model prompt</p>" };
		for (const resolve of [resolverOf(null), resolverOf(() => ({ prompt: "<p> </p>" }))]) {
			const summary = await summarizeItem(item([model]), { role: "instructor", resolve });
			expect(summary.entries[0]?.source).toBe("prompt");
		}
	});

	test("warns once per package when a summarizer throws", async () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const resolve = resolverOf(() => {
				throw new Error("boom");
			});
			const config = item([
				{ id: "1", element: "throwing-element", prompt: "<p>One</p>" },
				{ id: "2", element: "throwing-element", prompt: "<p>Two</p>" },
			]);
			const first = await summarizeItem(config, { role: "instructor", resolve });
			await summarizeItem(config, { role: "instructor", resolve });
			expect(first.entries.map((entry) => entry.source)).toEqual(["prompt", "prompt"]);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0])).toContain("@pie-element/throwing-element");
		} finally {
			warn.mockRestore();
		}
	});

	test("passes the role on and strips answers for a student", async () => {
		const roles: string[] = [];
		const resolve = resolverOf((_model, options) => {
			roles.push(options.role);
			return graded;
		});
		const config = item([{ id: "1", element: "multiple-choice" }]);
		const student = await summarizeItem(config, { role: "student", resolve });
		const instructor = await summarizeItem(config, { role: "instructor", resolve });
		expect(roles).toEqual(["student", "instructor"]);
		expect(student.entries[0]?.summary).toEqual({
			prompt: "<p>Pick</p>",
			options: [
				{ id: "x", label: "X" },
				{ id: "y", label: "Y" },
			],
			parts: [{ id: "p", options: [{ id: "z", label: "Z" }] }],
		});
		expect(instructor.entries[0]?.summary).toEqual(graded);
	});
});

describe("withoutAnswers", () => {
	test("leaves a summary without answers as it was", () => {
		const summary: ElementSummary = {
			prompt: "<p>P</p>",
			media: [{ kind: "audio" }],
			manualScoring: true,
		};
		expect(withoutAnswers(summary)).toEqual(summary);
	});
});
