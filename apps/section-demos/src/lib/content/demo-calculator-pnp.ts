import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/*
 * One item with no calculator metadata, so the learner's profile is the only
 * input to whether a calculator shows and which flavor it opens in. The page
 * renders the item without a section player; the section is only how the demo
 * registry carries content. The equation carries a spoken card, which read-aloud
 * speaks in its place.
 */
export const demoCalculatorPnpSection: AssessmentSection = {
	identifier: "demo-calculator-pnp",
	title: "Calculator by Profile",
	assessmentItemRefs: [
		{
			identifier: "calculator-pnp-q1",
			required: true,
			item: {
				id: "calculator-pnp-q1",
				name: "Question 1",
				baseId: "calculator-pnp-q1",
				version: { major: 1, minor: 0, patch: 0 },
				accessibilityCatalogs: [
					{
						identifier: "calculator-pnp-q1-equation",
						cards: [
							{
								catalog: "spoken",
								language: "en-US",
								content: "y equals x squared, minus 4 x, plus 1",
							},
						],
					},
				],
				config: {
					markup: '<multiple-choice id="q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "q1",
							element: "multiple-choice",
							prompt:
								'Graph <span data-catalog-idref="calculator-pnp-q1-equation">y = x^2 - 4x + 1</span>. What are the coordinates of its vertex?',
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "(2, -3)", correct: true },
								{ value: "b", label: "(-2, 13)", correct: false },
								{ value: "c", label: "(2, 1)", correct: false },
								{ value: "d", label: "(4, 1)", correct: false },
							],
						},
					],
				},
			},
		},
	],
};
