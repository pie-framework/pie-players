import type { SummaryResolver } from "../../../src/summarize.js";

/**
 * Items summarized once in Node and once in the browser by `round-trip.spec.ts`. They cover the
 * stem, markup order, each fallback rung and a resolved summarizer.
 */
export const roundTripItems = [
	{
		id: "stem-and-prompt",
		elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
		models: [
			{
				id: "1",
				element: "multiple-choice",
				prompt: "<p>Which is \\(2 + 2\\)?</p>",
				choices: [
					{ value: "a", label: "Four", correct: true },
					{ value: "b", label: "Five" },
				],
			},
		],
		markup: '<p>Read the question.</p><multiple-choice id="1"></multiple-choice>',
	},
	{
		id: "markup-order-and-child-prompts",
		elements: {
			ebsr: "@pie-element/ebsr@13.0.0",
			"extended-text-entry": "@pie-element/extended-text-entry@14.0.0",
		},
		models: [
			{ id: "2", element: "extended-text-entry", prompt: "<p>Explain.</p>" },
			{
				id: "1",
				element: "ebsr",
				partA: { prompt: "<p>Part A</p>" },
				partB: { prompt: "<p>Part B</p>" },
			},
			{ id: "untagged", element: "extended-text-entry", prompt: "<p>Never shown.</p>" },
		],
		markup: '<ebsr id="1"></ebsr><extended-text-entry id="2"></extended-text-entry>',
	},
	{
		id: "labels-only",
		elements: { "pie-hotspot": "@pie-element/hotspot@10.0.0" },
		models: [{ id: "1", element: "pie-hotspot", promptEnabled: false, prompt: "<p>Hidden</p>" }],
		markup: '<pie-hotspot id="1"></pie-hotspot>',
	},
	{
		id: "no-markup",
		elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
		models: [{ id: "1", element: "multiple-choice", prompt: "<p>Only a prompt</p>" }],
	},
];

/** A summarizer for multiple choice alone, so every other element takes a fallback rung. */
export const roundTripResolver: SummaryResolver = async (_tagName, pkg) =>
	pkg.startsWith("@pie-element/multiple-choice@")
		? (model, { role }) => {
				const { prompt, choices } = model as {
					prompt: string;
					choices?: { value: string; label: string; correct?: boolean }[];
				};
				return {
					prompt,
					options: (choices ?? []).map((choice) => ({
						id: choice.value,
						label: choice.label,
						...(role === "instructor" && choice.correct ? { correct: true } : {}),
					})),
				};
			}
		: null;
