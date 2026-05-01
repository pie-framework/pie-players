import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 7: Heading Accessibility — baseHeadingLevel & includeSrHeading
 *
 * Demonstrates how `baseHeadingLevel` rewrites `data-heading` paragraph nodes
 * into real heading elements, and how `includeSrHeading` controls whether a
 * visually-hidden screen-reader heading is injected at the top of the player.
 *
 * Uses a multiple-choice item whose prompt contains two `data-heading`
 * paragraphs so the heading-level rewrite is clearly visible in the DOM.
 */
export const demo7Section: AssessmentSection = {
	identifier: "demo7-heading-accessibility",
	title: "Demo 7: Heading Accessibility",
	keepTogether: true,

	assessmentItemRefs: [
		{
			identifier: "q1-nordic-countries",
			required: true,
			item: {
				id: "nordic-q1",
				name: "Nordic Countries Question",
				baseId: "nordic-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "q1",
							element: "multiple-choice",
							choiceMode: "checkbox",
							choicePrefix: "numbers",
							choices: [
								{
									correct: true,
									value: "sweden",
									label: "Sweden",
									feedback: { type: "none", value: "" },
								},
								{
									value: "iceland",
									label: "Iceland",
									feedback: { type: "none", value: "" },
									rationale: "Rationale for Iceland",
								},
								{
									value: "norway",
									label: "Norway",
									feedback: { type: "none", value: "" },
									rationale: "Rationale for Norway",
								},
								{
									correct: true,
									value: "finland",
									label: "Finland",
									feedback: { type: "none", value: "" },
									rationale: "Rationale for Finland",
								},
							],
							extraCSSRules: {
								names: ["red", "blue"],
								rules: `
									.red { color: red !important; }
									.blue { color: blue !important; }
								`,
							},
							prompt:
								'<p data-heading="heading1" class="red">Which of the following are Nordic countries?</p><p data-heading="heading2" class="blue">Select all that apply.</p>',
							promptEnabled: true,
							toolbarEditorPosition: "bottom",
							rubricEnabled: false,
						},
					],
				},
			},
		},
	],
};
