/**
 * Items summarized once in Node and once in the browser by `round-trip.spec.ts`, through the bundled
 * summarizers. They cover the stem, markup order and each fallback rung.
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
		id: "unsummarized-element",
		elements: { "acme-sorter": "@acme/sorter@1.0.0" },
		models: [{ id: "1", element: "acme-sorter", prompt: "<p>Sort these.</p>" }],
		markup: '<acme-sorter id="1"></acme-sorter>',
	},
	{
		id: "no-markup",
		elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
		models: [{ id: "1", element: "multiple-choice", prompt: "<p>Only a prompt</p>" }],
	},
];
