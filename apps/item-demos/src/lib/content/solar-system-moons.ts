import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	id: "solar-system-moons",
	name: "Solar System Question",
	description: "Beginner multiple-choice: which planet has the most moons.",
	sourcePackage: "multiple-choice",
	sourceVariantId: "progressive-solar-system",
	tags: ["progressive", "beginner", "science"],
	item: {
		id: "solar-system-moons",
		name: "Solar System Question",
		config: {
			markup: '<multiple-choice-element id="q1"></multiple-choice-element>',
			elements: {
				"multiple-choice-element": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "q1",
					element: "multiple-choice-element",
					prompt: "Which planet in our solar system has the most moons?",
					choicePrefix: "letters",
					scoringType: "auto",
					lockChoiceOrder: false,
					partialScoring: false,
					choices: [
						{ value: "A", label: "Mars", correct: false },
						{ value: "B", label: "Jupiter", correct: true },
						{ value: "C", label: "Saturn", correct: false },
						{ value: "D", label: "Neptune", correct: false },
					],
					choiceMode: "radio",
					promptEnabled: true,
					rationaleEnabled: false,
					teacherInstructionsEnabled: false,
					studentInstructionsEnabled: false,
				},
			],
			id: "",
		},
	},
};

export default demo;
