import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * PIE-512 regression fixture: asymmetric sections to reproduce the
 * cross-section event-delivery failure reported in narrow split-pane
 * layouts.
 *
 * Section A — passage + one MC item (mirrors the consumer's Q6-style page).
 * Section B — three MC items, no passage (mirrors the consumer's Q7/Q8-style
 * pages where multiple items mount but only the first is in the viewport).
 *
 * The combination is what triggers the bug end-to-end: navigating
 * A → B → A in a 320×900 split-pane viewport should re-deliver
 * `content-loaded` and `section-loading-complete` to consumers each time the
 * cohort flips, and currently does not on the second cohort.
 */
export const pie512SectionA: AssessmentSection = {
	identifier: "pie-512-section-a",
	title: "PIE-512 Section A: Passage + Single Item",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "pie-512-a-passage",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "pie-512-a-passage",
				name: "PIE-512 Section A Passage",
				baseId: "pie-512-a-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Reading Passage A</h2>
            <p>
              This is a short stimulus passage paired with a single multiple
              choice item. The shape mirrors the Knowledge Check page that
              the consumer reports failing on the first navigation step in
              the PIE-512 regression.
            </p>
            <p>
              The passage exists primarily to force a passage + item layout
              so that responsive collapse logic in the split-pane layout has
              two distinct renderables to track.
            </p>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "pie-512-a-q1",
			required: true,
			item: {
				id: "pie-512-a-item-1",
				name: "Section A Question 1",
				baseId: "pie-512-a-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="pie-512-a-q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "pie-512-a-q1",
							element: "multiple-choice",
							prompt: "Which institution is described as supporting Amsterdam merchants in the passage above?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Harbor and financial institutions",
									correct: true,
								},
								{
									value: "b",
									label: "City guild courts",
									correct: false,
								},
								{
									value: "c",
									label: "Royal naval treasury",
									correct: false,
								},
								{
									value: "d",
									label: "Imperial customs office",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
	],
};

export const pie512SectionB: AssessmentSection = {
	identifier: "pie-512-section-b",
	title: "PIE-512 Section B: Three Items, No Passage",
	keepTogether: true,

	assessmentItemRefs: [
		{
			identifier: "pie-512-b-q1",
			required: true,
			item: {
				id: "pie-512-b-item-1",
				name: "Section B Question 1",
				baseId: "pie-512-b-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="pie-512-b-q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "pie-512-b-q1",
							element: "multiple-choice",
							prompt: "Pick the best answer (Section B, Question 1).",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "First", correct: true },
								{ value: "b", label: "Second", correct: false },
								{ value: "c", label: "Third", correct: false },
								{ value: "d", label: "Fourth", correct: false },
							],
						},
					],
				},
			},
		},
		{
			identifier: "pie-512-b-q2",
			required: true,
			item: {
				id: "pie-512-b-item-2",
				name: "Section B Question 2",
				baseId: "pie-512-b-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="pie-512-b-q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "pie-512-b-q2",
							element: "multiple-choice",
							prompt: "Pick the best answer (Section B, Question 2).",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "Alpha", correct: false },
								{ value: "b", label: "Beta", correct: true },
								{ value: "c", label: "Gamma", correct: false },
								{ value: "d", label: "Delta", correct: false },
							],
						},
					],
				},
			},
		},
		{
			identifier: "pie-512-b-q3",
			required: true,
			item: {
				id: "pie-512-b-item-3",
				name: "Section B Question 3",
				baseId: "pie-512-b-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="pie-512-b-q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "pie-512-b-q3",
							element: "multiple-choice",
							prompt: "Pick the best answer (Section B, Question 3).",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "North", correct: false },
								{ value: "b", label: "South", correct: false },
								{ value: "c", label: "East", correct: true },
								{ value: "d", label: "West", correct: false },
							],
						},
					],
				},
			},
		},
	],
};
