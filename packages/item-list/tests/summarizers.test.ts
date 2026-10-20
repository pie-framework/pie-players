import { describe, expect, test } from "bun:test";
import type { ElementSummary } from "@pie-element/shared-types";
import { summarizers } from "../src/summarizers/index.js";
import { lineEquation } from "../src/summarizers/graph-marks.js";
import { excerpt } from "../src/summarizers/shared.js";

const blank = (n: number) => `<span class="pie-item-summary__blank">[${n}]</span>`;

function summarize(element: string, model: Record<string, unknown>, role: "instructor" | "student" = "instructor"): ElementSummary {
	const fn = summarizers[`@pie-element/${element}`];
	if (!fn) throw new Error(`no summarizer for ${element}`);
	return fn(model, { role });
}

/** Every answer and correct marker in a summary, its parts included. */
function answers(summary: ElementSummary): unknown[] {
	const blocks = [summary, ...(summary.parts ?? [])];
	return blocks.flatMap((block) => [
		...(block.answer === undefined ? [] : [block.answer]),
		...(block.options ?? []).flatMap((option) => (option.correct === undefined ? [] : [option.correct])),
	]);
}

describe("choice elements", () => {
	test("multiple-choice keeps authored order and marks the keyed choices", () => {
		expect(
			summarize("multiple-choice", {
				prompt: "<p>Pick</p>",
				shuffle: true,
				choices: [
					{ value: "a", label: "Four", correct: true },
					{ value: "b", label: "Five" },
				],
			}),
		).toEqual({
			prompt: "<p>Pick</p>",
			options: [
				{ id: "a", label: "Four", correct: true },
				{ id: "b", label: "Five" },
			],
		});
	});

	test("ebsr reads each part as a question and skips a disabled part prompt", () => {
		expect(
			summarize("ebsr", {
				partA: { prompt: "<p>A</p>", choices: [{ value: "1", label: "One", correct: true }] },
				partB: { prompt: "<p>B</p>", promptEnabled: false, choices: [{ value: "2", label: "Two" }] },
			}),
		).toEqual({
			parts: [
				{ id: "partA", prompt: "<p>A</p>", options: [{ id: "1", label: "One", correct: true }] },
				{ id: "partB", options: [{ id: "2", label: "Two" }] },
			],
		});
	});

	test("likert and matrix list their scale without an answer key", () => {
		expect(
			summarize("likert", {
				prompt: "<p>Agree?</p>",
				promptEnabled: false,
				choices: [
					{ label: "No", value: -1 },
					{ label: "Yes", value: 1 },
				],
			}),
		).toEqual({
			prompt: "<p>Agree?</p>",
			options: [
				{ id: "-1", label: "No" },
				{ id: "1", label: "Yes" },
			],
		});
		expect(summarize("matrix", { prompt: "<p>Rate</p>", rowLabels: ["Tea"], columnLabels: ["Low", "High"] })).toEqual({
			prompt: "<p>Rate</p>",
			options: [
				{ id: "0", label: "Low" },
				{ id: "1", label: "High" },
			],
			parts: [{ id: "0", prompt: "Tea" }],
		});
	});
});

describe("cloze elements", () => {
	test("explicit-constructed-response marks blanks and lists every accepted answer", () => {
		expect(
			summarize("explicit-constructed-response", {
				prompt: "<p>Fill in</p>",
				markup: "<p>{{0}} and {{1}}</p>",
				choices: {
					0: [{ label: "cat", value: "0" }, { label: "kitten", value: "1" }],
					1: [{ label: "dog", value: "0" }],
				},
			}),
		).toEqual({
			prompt: `<p>Fill in</p><p>${blank(1)} and ${blank(2)}</p>`,
			answer: '<ol><li value="1">cat / kitten</li><li value="2">dog</li></ol>',
		});
	});

	test("falls back to slateMarkup when markup is absent", () => {
		const summary = summarize("explicit-constructed-response", {
			slateMarkup:
				'<p>A <span data-type="explicit_constructed_response" data-index="0" data-value="cat"></span></p>',
			choices: { 0: [{ label: "cat", value: "0" }] },
		});
		expect(summary.prompt).toBe(`<p>A ${blank(1)}</p>`);
	});

	test("inline-dropdown groups each blank's choices and honours alternateResponse", () => {
		expect(
			summarize("inline-dropdown", {
				markup: "<p>{{0}}</p>",
				choices: {
					0: [
						{ label: "red", value: "r", correct: true },
						{ label: "crimson", value: "c" },
						{ label: "blue", value: "b" },
					],
				},
				alternateResponse: { 0: ["c"] },
			}).options,
		).toEqual([
			{ id: "0:r", label: "red", correct: true, group: "[1]" },
			{ id: "0:c", label: "crimson", correct: true, group: "[1]" },
			{ id: "0:b", label: "blue", group: "[1]" },
		]);
	});

	test("drag-in-the-blank lists tokens and the token each blank takes, alternates included", () => {
		expect(
			summarize("drag-in-the-blank", {
				markup: "<p>{{0}} {{1}}</p>",
				choices: [
					{ id: "x", value: "<b>one</b>" },
					{ id: "y", value: "two" },
					{ id: "z", value: "uno" },
				],
				correctResponse: { 0: "x", 1: "y" },
				alternateResponses: [["z"]],
			}),
		).toEqual({
			prompt: `<p>${blank(1)} ${blank(2)}</p>`,
			options: [
				{ id: "x", label: "<b>one</b>" },
				{ id: "y", label: "two" },
				{ id: "z", label: "uno" },
			],
			answer: '<ol><li value="1"><b>one</b> / uno</li><li value="2">two</li></ol>',
		});
	});

	test("math-templated states each blank's answers as TeX", () => {
		expect(
			summarize("math-templated", {
				markup: "<p>{{0}}</p>",
				responses: { 0: { answer: "2x", alternates: { 1: "x2" } } },
			}).answer,
		).toBe('<ol><li value="1">\\(2x\\) / \\(x2\\)</li></ol>');
	});

	test("math-inline lists complete expressions; Simple mode scores the first only", () => {
		const model = {
			expression: "\\${{response}}",
			responses: [
				{ id: "1", answer: "\\$410", alternates: { a: "\\$410.00" } },
				{ id: "2", answer: "\\$400" },
			],
		};
		expect(summarize("math-inline", { ...model, responseType: "Advanced Multi" })).toEqual({
			prompt: "<p>\\(\\$\\square\\)</p>",
			answer: "<ol><li>\\(\\$410\\)</li><li>\\(\\$410.00\\)</li><li>\\(\\$400\\)</li></ol>",
		});
		expect(summarize("math-inline", { ...model, responseType: "Simple" }).answer).toBe(
			"<ol><li>\\(\\$410\\)</li><li>\\(\\$410.00\\)</li></ol>",
		);
	});

	test("image-cloze-association reads snake_case keys and ignores promptEnabled", () => {
		expect(
			summarize("image-cloze-association", {
				prompt: "<p>Drag</p>",
				promptEnabled: false,
				image: { src: "board.png" },
				possible_responses: ['<img src="a.png">', '<img src="b.png">'],
				validation: {
					valid_response: { value: [{ images: ['<img src="a.png">'] }] },
					alt_responses: [{ value: [{ images: ['<img src="b.png">'] }] }],
				},
			}),
		).toEqual({
			prompt: "<p>Drag</p>",
			figure: { src: "board.png" },
			options: [
				{ id: "0", label: '<img src="a.png">' },
				{ id: "1", label: '<img src="b.png">' },
			],
			answer: '<ol><li value="1"><img src="a.png"> / <img src="b.png"></li></ol>',
		});
	});
});

describe("pairing and ordering elements", () => {
	test("match answers each row with the header after its value index", () => {
		expect(
			summarize("match", {
				headers: ["Animal", "Mammal", "Fish"],
				rows: [
					{ id: 1, title: "Whale", values: [true, false] },
					{ id: 2, title: "Trout", values: [false, true] },
				],
			}).parts,
		).toEqual([
			{ id: "1", prompt: "Whale", answer: "Mammal" },
			{ id: "2", prompt: "Trout", answer: "Fish" },
		]);
	});

	test("categorize answers each category with its choices", () => {
		expect(
			summarize("categorize", {
				choices: [
					{ id: "c1", content: "Cat" },
					{ id: "c2", content: "Cod" },
				],
				categories: [
					{ id: "k1", label: "Land" },
					{ id: "k2", label: "Sea" },
				],
				correctResponse: [
					{ category: "k1", choices: ["c1"] },
					{ category: "k2", choices: ["c2"] },
				],
			}),
		).toEqual({
			options: [
				{ id: "c1", label: "Cat" },
				{ id: "c2", label: "Cod" },
			],
			parts: [
				{ id: "k1", prompt: "Land", answer: "Cat" },
				{ id: "k2", prompt: "Sea", answer: "Cod" },
			],
		});
	});

	test("match-list pairs each prompt with its related answer", () => {
		expect(
			summarize("match-list", {
				prompts: [{ id: 1, title: "2+2", relatedAnswer: 7 }],
				answers: [{ id: 7, title: "4" }],
			}).parts,
		).toEqual([{ id: "1", prompt: "2+2", answer: "4" }]);
	});

	test("placement-ordering reads both correctResponse forms", () => {
		const choices = [
			{ id: "a", label: "First" },
			{ id: "b", label: "Second" },
		];
		for (const correctResponse of [[{ id: "b" }, { id: "a" }], ["b", "a"]]) {
			expect(summarize("placement-ordering", { choices, correctResponse }).answer).toBe(
				"<ol><li>Second</li><li>First</li></ol>",
			);
		}
	});

	test("select-text lists tokens, reading text by offset when a token has none", () => {
		expect(
			summarize("select-text", {
				text: "The cat sat.",
				tokens: [
					{ start: 4, end: 7, correct: true },
					{ text: "sat", start: 8, end: 11 },
				],
			}),
		).toEqual({
			prompt: "The cat sat.",
			options: [
				{ id: "0", label: "cat", correct: true },
				{ id: "1", label: "sat" },
			],
		});
	});
});

describe("graphical elements", () => {
	test("number-line writes marks in interval notation", () => {
		expect(
			summarize("number-line", {
				correctResponse: [
					{ type: "point", domainPosition: 3, pointType: "full" },
					{ type: "line", domainPosition: 1, size: 3, leftPoint: "full", rightPoint: "empty" },
					{ type: "ray", domainPosition: 2, pointType: "empty", direction: "negative" },
				],
			}).answer,
		).toBe("<p>\\(\\{3\\},\\ [1,4),\\ (-\\infty,2)\\)</p>");
	});

	test("fraction-model sums the filled parts over the parts per model", () => {
		expect(
			summarize("fraction-model", {
				partsPerModel: 4,
				correctResponse: [
					{ id: 1, value: 4 },
					{ id: 2, value: 1 },
				],
			}).answer,
		).toBe("<p>\\(\\frac{5}{4}\\)</p>");
	});

	test("graphing states lines as equations and points as coordinates", () => {
		expect(
			summarize("graphing", {
				answers: {
					correctAnswer: {
						marks: [
							{ type: "point", x: 1, y: 2 },
							{ type: "line", from: { x: 0, y: 1 }, to: { x: 1, y: 3 } },
							{ type: "circle", root: { x: 1, y: -2 }, edge: { x: 4, y: 2 } },
						],
					},
					alternate1: { marks: [{ type: "point", x: 9, y: 9 }] },
				},
			}).answer,
		).toBe("<ol><li>\\((1,2)\\)</li><li>\\(y=2x+1\\)</li><li>\\((x-1)^2+(y+2)^2=25\\)</li></ol>");
	});

	test("line equations cover vertical, horizontal and negative slopes", () => {
		expect(lineEquation({ x: 2, y: 0 }, { x: 2, y: 5 })).toBe("x=2");
		expect(lineEquation({ x: 0, y: 3 }, { x: 4, y: 3 })).toBe("y=3");
		expect(lineEquation({ x: 0, y: 0 }, { x: 1, y: -1 })).toBe("y=-x");
		expect(lineEquation({ x: 0, y: -2 }, { x: 2, y: -1 })).toBe("y=0.5x-2");
	});

	test("graphing-solution-set states its boundary lines", () => {
		expect(
			summarize("graphing-solution-set", {
				answers: {
					correctAnswer: {
						marks: [
							{ type: "line", fill: "Dashed", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
							{ type: "polygon", points: [{ x: 0, y: 0 }], isSolution: true },
						],
					},
				},
			}).answer,
		).toBe("<ol><li>\\(y=x\\)</li></ol>");
	});

	test("charting tabulates the keyed data", () => {
		expect(
			summarize("charting", {
				title: "Pets",
				correctAnswer: { data: [{ label: "Cats", value: 3 }] },
			}),
		).toEqual({
			prompt: "<p><b>Pets</b></p>",
			answer: '<table><tbody><tr><th scope="row">Cats</th><td>3</td></tr></tbody></table>',
		});
	});

	test("hotspot and drawing-response show their image", () => {
		expect(summarize("hotspot", { imageUrl: "map.png" })).toEqual({ figure: { src: "map.png" } });
		expect(summarize("drawing-response", { imageUrl: "bg.png", backgroundImageEnabled: false })).toEqual({
			manualScoring: true,
		});
	});
});

describe("manually scored and stimulus elements", () => {
	test("rubric lists score points highest first, honouring excludeZero", () => {
		expect(summarize("rubric", { points: ["None", "Some", "All"], excludeZero: true })).toEqual({
			options: [
				{ id: "2", label: "<b>2</b> All" },
				{ id: "1", label: "<b>1</b> Some" },
			],
			manualScoring: true,
		});
	});

	test("complex-rubric summarizes the rubric its type selects", () => {
		expect(
			summarize("complex-rubric", {
				rubricType: "multiTraitRubric",
				rubrics: {
					simpleRubric: { points: ["x"] },
					multiTraitRubric: {
						scales: [{ scorePointsLabels: ["Low", "High"], traits: [{ name: "Voice", scorePointsDescriptors: ["Flat", "Vivid"] }] }],
					},
				},
			}),
		).toEqual({
			parts: [
				{
					id: "0",
					prompt: "Voice",
					options: [
						{ id: "0", label: "<b>Low</b> Flat" },
						{ id: "1", label: "<b>High</b> Vivid" },
					],
				},
			],
			manualScoring: true,
		});
	});

	test("passage shows a title and excerpt, several passages as parts", () => {
		expect(summarize("passage", { passages: [{ title: "Tides", text: "<p>Water</p>" }] })).toEqual({
			prompt: "<p><b>Tides</b></p><p>Water</p>",
		});
		expect(
			summarize("passage", {
				titleEnabled: false,
				passages: [{ title: "A", text: "<p>One</p>" }, { text: "<p>Two</p>" }],
			}).parts,
		).toEqual([
			{ id: "0", prompt: "<p>One</p>" },
			{ id: "1", prompt: "<p>Two</p>" },
		]);
	});

	test("excerpt cuts after the block that reaches the limit", () => {
		const long = `<p>${"a".repeat(300)}</p><p>${"b".repeat(200)}</p><p>tail</p>`;
		expect(excerpt(long)).toBe(`<p>${"a".repeat(300)}</p><p>${"b".repeat(200)}</p><p>…</p>`);
		expect(excerpt("<p>short</p>")).toBe("<p>short</p>");
	});
});

describe("every bundled summarizer", () => {
	const models: Record<string, Record<string, unknown>> = {
		"multiple-choice": { choices: [{ value: "a", label: "A", correct: true }] },
		ebsr: { partA: { choices: [{ value: "a", label: "A", correct: true }] } },
		"explicit-constructed-response": { markup: "{{0}}", choices: { 0: [{ label: "x" }] } },
		"inline-dropdown": { markup: "{{0}}", choices: { 0: [{ label: "x", value: "x", correct: true }] } },
		"drag-in-the-blank": { markup: "{{0}}", choices: [{ id: "a", value: "x" }], correctResponse: { 0: "a" } },
		"math-templated": { markup: "{{0}}", responses: { 0: { answer: "1" } } },
		"math-inline": { expression: "{{response}}", responses: [{ answer: "1" }] },
		match: { headers: ["", "Yes"], rows: [{ id: 1, title: "Row", values: [true] }] },
		categorize: { choices: [{ id: "c", content: "C" }], categories: [{ id: "k", label: "K" }], correctResponse: [{ category: "k", choices: ["c"] }] },
		"match-list": { prompts: [{ id: 1, title: "P", relatedAnswer: 1 }], answers: [{ id: 1, title: "A" }] },
		"placement-ordering": { choices: [{ id: "a", label: "A" }], correctResponse: ["a"] },
		"select-text": { text: "ab", tokens: [{ start: 0, end: 1, correct: true }] },
		"image-cloze-association": { possibleResponses: ["x"], validation: { validResponse: { value: [{ images: ["x"] }] } } },
		"number-line": { correctResponse: [{ type: "point", domainPosition: 1 }] },
		"fraction-model": { partsPerModel: 2, correctResponse: [{ id: 1, value: 1 }] },
		graphing: { answers: { correctAnswer: { marks: [{ type: "point", x: 1, y: 1 }] } } },
		"graphing-solution-set": { answers: { correctAnswer: { marks: [{ type: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] } } },
		charting: { correctAnswer: { data: [{ label: "A", value: 1 }] } },
	};

	test("withholds every answer and correct marker from a student", () => {
		for (const [element, model] of Object.entries(models)) {
			expect({ element, answers: answers(summarize(element, model)).length > 0 }).toEqual({ element, answers: true });
			expect({ element, answers: answers(summarize(element, model, "student")) }).toEqual({ element, answers: [] });
		}
	});

	test("reads a missing or malformed model without throwing", () => {
		for (const [pkg, fn] of Object.entries(summarizers)) {
			for (const model of [undefined, null, 42, "x", [], {}, { choices: "nope", passages: {}, rows: [null] }]) {
				expect(() => fn(model, { role: "instructor" }), pkg).not.toThrow();
			}
		}
	});
});
