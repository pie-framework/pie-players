import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Formative delivery: check-answer, retry, and mastery.
 *
 * Exercises every branch of the resolved policy in one section, because the
 * interesting part is how the four differ side by side:
 *
 * - `q1` inherits the section default — three tries, correctness feedback after
 *   each, so the control cycles Check → Try again.
 * - `q2` gets one try and the solution, which is the classic checkpoint: the
 *   reveal projects `role: "instructor"` so the element also shows the authored
 *   correct response, and the control disappears afterwards.
 * - `q3` withholds feedback until the tries are spent (`on-final-try`), so the
 *   first two checks record a Try and reveal nothing.
 * - `q4` opts out entirely, proving one item can stay ordinary inside a
 *   formative section.
 *
 * See `docs/prds/formative-delivery-contract.md`.
 */
const choiceItem = (args: {
	itemId: string;
	modelId: string;
	prompt: string;
	choices: Array<{ value: string; label: string; correct: boolean }>;
}) => ({
	id: args.itemId,
	name: args.itemId,
	baseId: args.itemId,
	version: { major: 1, minor: 0, patch: 0 },
	config: {
		markup: `<multiple-choice id="${args.modelId}"></multiple-choice>`,
		elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
		models: [
			{
				id: args.modelId,
				element: "multiple-choice",
				prompt: args.prompt,
				choiceMode: "radio",
				choices: args.choices,
			},
		],
	},
});

export const demoFormativeDeliverySection: AssessmentSection = {
	identifier: "formative-delivery",
	title: "Formative Delivery",
	keepTogether: true,

	// The section default. Every item inherits it unless its own ref overrides a
	// field.
	formative: {
		enabled: true,
		maxTries: 3,
		feedback: "correctness",
	},

	assessmentItemRefs: [
		{
			identifier: "fd-q1",
			required: true,
			item: choiceItem({
				itemId: "fd-item-1",
				modelId: "fd-m1",
				prompt:
					"Three tries with correctness feedback. Which planet has the shortest year?",
				choices: [
					{ value: "a", label: "Mercury", correct: true },
					{ value: "b", label: "Venus", correct: false },
					{ value: "c", label: "Mars", correct: false },
					{ value: "d", label: "Jupiter", correct: false },
				],
			}),
		},
		{
			identifier: "fd-q2",
			required: true,
			formative: { maxTries: 1, feedback: "solution" },
			item: choiceItem({
				itemId: "fd-item-2",
				modelId: "fd-m2",
				prompt:
					"One try, then the answer is shown. Which gas makes up most of Earth's atmosphere?",
				choices: [
					{ value: "a", label: "Oxygen", correct: false },
					{ value: "b", label: "Nitrogen", correct: true },
					{ value: "c", label: "Carbon dioxide", correct: false },
					{ value: "d", label: "Argon", correct: false },
				],
			}),
		},
		{
			identifier: "fd-q3",
			required: true,
			formative: { maxTries: 3, revealOn: "on-final-try" },
			item: choiceItem({
				itemId: "fd-item-3",
				modelId: "fd-m3",
				prompt:
					"Three tries, but nothing is revealed until the last one. What is the largest ocean?",
				choices: [
					{ value: "a", label: "Atlantic", correct: false },
					{ value: "b", label: "Indian", correct: false },
					{ value: "c", label: "Pacific", correct: true },
					{ value: "d", label: "Arctic", correct: false },
				],
			}),
		},
		{
			identifier: "fd-q4",
			required: true,
			formative: { enabled: false },
			item: choiceItem({
				itemId: "fd-item-4",
				modelId: "fd-m4",
				prompt:
					"Opted out: this item has no check control and no feedback. Which metal is liquid at room temperature?",
				choices: [
					{ value: "a", label: "Mercury", correct: true },
					{ value: "b", label: "Lead", correct: false },
					{ value: "c", label: "Tin", correct: false },
					{ value: "d", label: "Zinc", correct: false },
				],
			}),
		},
	],
};
