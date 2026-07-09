import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo: Print Showcase (pie-print-player)
 *
 * Renders a section's stimulus + items through the standalone
 * `@pie-players/pie-print-player` (`<pie-print>`), which loads the
 * `dist/browser/print/index.js` artifact for each element. The section
 * player itself has no print view, so this demo composes each
 * `rubricBlock` passage and `assessmentItemRef` item into print configs.
 *
 * Element versions are pinned to ng pre-release builds whose
 * browser print bundles are published and verified:
 * - @pie-element/passage@7.1.2-next.5
 * - @pie-element/multiple-choice@13.2.2-next.5
 * - @pie-element/ebsr@14.2.2-next.5
 */
export const demoPrintShowcaseSection: AssessmentSection = {
	identifier: "demo-print-showcase",
	title: "Print Showcase",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "print-showcase-passage",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "print-showcase-passage-001",
				name: "Hope Is the Thing with Feathers",
				baseId: "print-showcase-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<passage-element id="p1"></passage-element>',
					elements: {
						"passage-element": "@pie-element/passage@7.1.2-next.5",
					},
					models: [
						{
							id: "p1",
							element: "passage-element",
							passages: [
								{
									title: "Hope Is the Thing with Feathers",
									author: "by Emily Dickinson",
									text: "<p>Hope is the thing with feathers<br/>That perches in the soul,<br/>And sings the tune without the words,<br/>And never stops at all,</p><p>And sweetest in the gale is heard;<br/>And sore must be the storm<br/>That could abash the little bird<br/>That kept so many warm.</p>",
								},
							],
						},
					],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "print-q1-multiple-choice",
			required: true,
			item: {
				id: "print-q1",
				name: "Question 1 (Multiple Choice)",
				baseId: "print-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="print-q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@13.2.2-next.5",
					},
					models: [
						{
							id: "print-q1",
							element: "multiple-choice",
							choiceMode: "radio",
							choicePrefix: "letters",
							promptEnabled: true,
							prompt: "<p>Which is the largest planet in our solar system?</p>",
							choices: [
								{ correct: false, value: "mercury", label: "Mercury" },
								{ correct: true, value: "jupiter", label: "Jupiter" },
								{ correct: false, value: "earth", label: "Earth" },
								{ correct: false, value: "mars", label: "Mars" },
							],
						},
					],
				},
			},
		},
		{
			identifier: "print-q2-ebsr",
			required: true,
			item: {
				id: "print-q2",
				name: "Question 2 (EBSR)",
				baseId: "print-q2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<ebsr-element id="print-q2"></ebsr-element>',
					elements: {
						"ebsr-element": "@pie-element/ebsr@14.2.2-next.5",
					},
					models: [
						{
							id: "print-q2",
							element: "ebsr-element",
							partA: {
								choiceMode: "checkbox",
								choicePrefix: "numbers",
								promptEnabled: true,
								prompt: "What color is the sky?",
								choices: [
									{ value: "yellow", label: "Yellow" },
									{ value: "green", label: "Green" },
									{ correct: true, value: "blue", label: "Blue" },
								],
							},
							partB: {
								choiceMode: "checkbox",
								choicePrefix: "numbers",
								promptEnabled: true,
								prompt:
									"What color do you get when you mix Red with your answer in Part 1?",
								choices: [
									{ value: "orange", label: "Orange" },
									{ correct: true, value: "purple", label: "Purple" },
									{ value: "pink", label: "Pink" },
									{ value: "green", label: "Green" },
								],
							},
						},
					],
				},
			},
		},
	],
};
