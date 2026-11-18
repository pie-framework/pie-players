import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/*
 * One item per path the answer eliminator takes its choices from. Multiple
 * choice 13.2 and EBSR 14.2 predate `answer-masking`, so the legacy adapters read
 * their markup; the current multiple choice and select-text declare it and
 * supply their own choices. The math choices are named from a note, which says
 * "(eliminated)" itself. The section is only how the demo registry carries the
 * items: the page renders each in its own item scope.
 */

const SELECT_TEXT =
	"Plants take in carbon dioxide and water, and they release oxygen while they make sugar from sunlight.";

/** Word tokens of `text` at their offsets, the shape select-text's model takes. */
const wordTokens = (text: string, correct: readonly string[]) =>
	[...text.matchAll(/[A-Za-z]+/g)].map((match) => ({
		text: match[0],
		start: match.index,
		end: match.index + match[0].length,
		correct: correct.includes(match[0]),
	}));

const math = (latex: string) => `<span data-latex="">\\(${latex}\\)</span>`;

export const demoAnswerEliminatorSection: AssessmentSection = {
	identifier: "demo-answer-eliminator",
	title: "Answer Eliminator",
	assessmentItemRefs: [
		{
			identifier: "ae-legacy-mc",
			required: true,
			item: {
				id: "ae-legacy-mc",
				name: "Multiple choice 13.2 (legacy adapter)",
				baseId: "ae-legacy-mc",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="ae-legacy-mc"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@13.2.0-next.19",
					},
					models: [
						{
							id: "ae-legacy-mc",
							element: "multiple-choice",
							prompt: "Which gas do plants release during photosynthesis?",
							choiceMode: "radio",
							lockChoiceOrder: true,
							choices: [
								{ value: "a", label: "Carbon dioxide", correct: false },
								{ value: "b", label: "Oxygen", correct: true },
								{ value: "c", label: "Nitrogen", correct: false },
								{
									value: "d",
									label:
										"Water vapour, which leaves through the stomata on the underside of the leaf",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "ae-legacy-ebsr",
			required: true,
			item: {
				id: "ae-legacy-ebsr",
				name: "EBSR 14.2 (legacy adapter)",
				baseId: "ae-legacy-ebsr",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<ebsr id="ae-legacy-ebsr"></ebsr>',
					elements: { ebsr: "@pie-element/ebsr@14.2.0-next.19" },
					models: [
						{
							id: "ae-legacy-ebsr",
							element: "ebsr",
							partLabels: true,
							partA: {
								id: "ae-legacy-ebsr",
								element: "ebsr",
								prompt: "Where in the cell does photosynthesis take place?",
								choiceMode: "radio",
								lockChoiceOrder: true,
								choices: [
									{ value: "a", label: "The nucleus", correct: false },
									{ value: "b", label: "The chloroplasts", correct: true },
									{ value: "c", label: "The cell wall", correct: false },
								],
							},
							partB: {
								id: "ae-legacy-ebsr",
								element: "ebsr",
								prompt: "Select TWO details that support your answer to Part A.",
								choiceMode: "checkbox",
								lockChoiceOrder: true,
								choices: [
									{ value: "a", label: "Chloroplasts hold chlorophyll", correct: true },
									{ value: "b", label: "Chlorophyll absorbs light", correct: true },
									{ value: "c", label: "The nucleus stores DNA", correct: false },
									{ value: "d", label: "The cell wall gives shape", correct: false },
								],
							},
						},
					],
				},
			},
		},
		{
			identifier: "ae-current-mc",
			required: true,
			item: {
				id: "ae-current-mc",
				name: "Multiple choice, current (declares answer-masking)",
				baseId: "ae-current-mc",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="ae-current-mc"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "ae-current-mc",
							element: "multiple-choice",
							prompt: `Which values solve ${math("x^2 = 4")}? Select all that apply.`,
							choiceMode: "checkbox",
							keyMode: "letters",
							lockChoiceOrder: true,
							choices: [
								{ value: "a", label: math("x = 2"), correct: true },
								{ value: "b", label: math("x = -2"), correct: true },
								{ value: "c", label: "x = 4", correct: false },
								{ value: "d", label: "There is no solution", correct: false },
							],
						},
					],
				},
			},
		},
		{
			identifier: "ae-select-text",
			required: true,
			item: {
				id: "ae-select-text",
				name: "Select text, current (declares answer-masking)",
				baseId: "ae-select-text",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<select-text id="ae-select-text"></select-text>',
					elements: { "select-text": "@pie-element/select-text@latest" },
					models: [
						{
							id: "ae-select-text",
							element: "select-text",
							prompt: "Select the word that names the gas plants release.",
							promptEnabled: true,
							mode: "word",
							highlightChoices: false,
							maxSelections: 1,
							text: SELECT_TEXT,
							tokens: wordTokens(SELECT_TEXT, ["oxygen"]),
						},
					],
				},
			},
		},
	],
};
