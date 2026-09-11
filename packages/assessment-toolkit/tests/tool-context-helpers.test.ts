import { describe, expect, test } from "bun:test";
import {
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
	hasScienceContent,
} from "../src/services/tool-context";
import type { ToolContext } from "../src/services/tool-context";

describe("tool-context helpers", () => {
	test("detects math content in item markup", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Solve 3 + 5 = ?</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(true);
	});

	test("does not detect math content in plain text", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Read the passage and answer.</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(false);
	});

	// Both content gates used to answer `true` for essentially every item:
	// `hasMathContent` matched any hyphen or slash, and `hasScienceContent` matched
	// any one- or two-letter capitalised word. They gate `isVisibleInContext` for
	// the calculator, ruler, graph and periodic table, so a gate that cannot say no
	// is not a gate.
	const item = (config: Record<string, unknown>): ToolContext =>
		({
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: { config } as any,
		}) as ToolContext;

	describe("math gate", () => {
		for (const markup of [
			"<div>Solve 3 + 5 = ?</div>",
			"<div>Is 5 &gt; 3? Compare 12 / 4 and 20% of 50.</div>",
			"<div>Evaluate 2^3 and compare with \u03c0.</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(true);
			});
		}

		// Prose that the old bare-operator pattern read as mathematical.
		for (const markup of [
			"<div>This is a well-known, self-evident truth.</div>",
			"<div>Choose the best answer and/or explain why.</div>",
			"<div>Read paragraph 3 and summarize the main idea.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(false);
			});
		}

		// The MathML pattern was unreachable: extraction stripped tags before the
		// predicate ran, so an item whose only math signal is the element matched
		// nothing. It is now tested against the markup view.
		test("sees MathML, whose only signal is the tag", () => {
			expect(hasMathContent(item({ markup: "<p><math><mi>x</mi></math></p>" }))).toBe(
				true,
			);
		});
		test("sees MathML inside an element snippet", () => {
			expect(
				hasMathContent(item({ elements: { "pie-x": "<math><mn>2</mn></math>" } })),
			).toBe(true);
		});
		test("sees LaTeX in a model prompt", () => {
			expect(hasMathContent(item({ models: [{ prompt: "Solve \\(x+1\\)" }] }))).toBe(
				true,
			);
		});
	});

	describe("science gate", () => {
		for (const markup of [
			"<div>The periodic table lists every element.</div>",
			"<div>Water is H\u2082O and salt is NaCl.</div>",
			"<div>The formula for carbon dioxide is CO2.</div>",
			"<div>Describe photosynthesis in green plants.</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasScienceContent(item({ markup }))).toBe(true);
			});
		}

		// Every one of these contains a one- or two-letter capitalised word, which
		// the old element-symbol pattern accepted. A lone symbol is not a formula:
		// "In", "He", "As" and "At" are ordinary English.
		for (const markup of [
			"<div>It was the best of times. In the end, He knew.</div>",
			"<div>No one expected As You Like It to end that way.</div>",
			"<div>At first, In fact, So then \u2014 transitions matter.</div>",
			"<div>Hello, said the man. Nothing happened.</div>",
			"<div>Compare Mercury and Venus in the passage.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasScienceContent(item({ markup }))).toBe(false);
			});
		}
	});

	test("detects readable text threshold", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<p>This sentence is long enough for reading tools.</p>",
				},
			} as any,
		};

		expect(hasReadableText(context)).toBe(true);
	});

	test("detects choice interactions from item models", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [{ element: "pie-multiple-choice" }],
				},
			} as any,
		};

		expect(hasChoiceInteraction(context)).toBe(true);
	});

	test("detects EBSR as a choice interaction (choices live under partA/partB)", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [
						{
							element: "ebsr",
							partA: { choiceMode: "radio", choices: [{ value: "a" }] },
							partB: { choiceMode: "checkbox", choices: [{ value: "a" }] },
						},
					],
				},
			} as any,
		};

		expect(hasChoiceInteraction(context)).toBe(true);
	});

	// `choices` holds the draggables for these three, so reading it on a named
	// model put the answer eliminator on items the tool cannot act on.
	for (const element of [
		"placement-ordering",
		"categorize",
		"categorize-element",
		"drag-in-the-blank",
	]) {
		test(`does not treat ${element} as a choice interaction despite its choices`, () => {
			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {
					config: {
						models: [
							{
								element,
								choices: [
									{ id: "1", label: "first" },
									{ id: "2", label: "second" },
								],
							},
						],
					},
				} as any,
			};

			expect(hasChoiceInteraction(context)).toBe(false);
		});
	}

	test("still reads choices when a model names no element", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [{ choices: [{ value: "a" }, { value: "b" }] }],
				},
			} as any,
		};

		expect(hasChoiceInteraction(context)).toBe(true);
	});
});
