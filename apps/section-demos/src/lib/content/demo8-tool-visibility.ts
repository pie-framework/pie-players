import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

type AssessmentItemRef = NonNullable<
	AssessmentSection["assessmentItemRefs"]
>[number];

type CalculatorToolMetadata = {
	toolMetadata?: {
		calculator?: "basic" | "scientific";
	};
};

function withCalculatorToolMetadata(
	itemRef: AssessmentItemRef,
	calculator: "basic" | "scientific",
): AssessmentItemRef {
	const refWithMetadata = itemRef as typeof itemRef & CalculatorToolMetadata;
	const itemWithMetadata = itemRef.item as typeof itemRef.item &
		CalculatorToolMetadata;

	return {
		...itemRef,
		toolMetadata: {
			...(refWithMetadata.toolMetadata ?? {}),
			calculator,
		},
		item: {
			...itemRef.item,
			toolMetadata: {
				...(itemWithMetadata.toolMetadata ?? {}),
				calculator,
			},
		},
	} as AssessmentItemRef;
}

const basicCalculatorItem: AssessmentItemRef = withCalculatorToolMetadata(
	{
		identifier: "q1-basic-calculator-cost",
		required: true,
		item: {
			id: "calculator-visibility-q1",
			name: "Question 1: Basic Calculator",
			baseId: "calculator-visibility-q1",
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
						prompt:
							"The club needs 24 soil kits at $18.75 each and must pay one $36 delivery fee. What is the total cost?",
						choiceMode: "radio",
						choices: [
							{
								value: "a",
								label: "$414.00",
								correct: false,
							},
							{
								value: "b",
								label: "$450.00",
								correct: false,
							},
							{
								value: "c",
								label: "$486.00",
								correct: true,
							},
							{
								value: "d",
								label: "$522.00",
								correct: false,
							},
						],
					},
				],
			},
		},
	},
	"basic",
);

const scientificCalculatorItem: AssessmentItemRef = withCalculatorToolMetadata(
	{
		identifier: "q2-scientific-calculator-growth",
		required: true,
		item: {
			id: "calculator-visibility-q2",
			name: "Question 2: Scientific Calculator",
			baseId: "calculator-visibility-q2",
			version: { major: 1, minor: 0, patch: 0 },
			config: {
				markup: '<multiple-choice id="q2"></multiple-choice>',
				elements: {
					"multiple-choice": "@pie-element/multiple-choice@latest",
				},
				models: [
					{
						id: "q2",
						element: "multiple-choice",
						prompt:
							"A plant tray starts with 250 seedlings and is modeled by P = 250(1.08)^6 after six weeks. Which value is closest to P?",
						choiceMode: "radio",
						choices: [
							{
								value: "a",
								label: "333",
								correct: false,
							},
							{
								value: "b",
								label: "397",
								correct: true,
							},
							{
								value: "c",
								label: "520",
								correct: false,
							},
							{
								value: "d",
								label: "661",
								correct: false,
							},
						],
					},
				],
			},
		},
	},
	"scientific",
);

const noCalculatorItem: AssessmentItemRef = {
	identifier: "q3-no-calculator-planning",
	required: true,
	item: {
		id: "calculator-visibility-q3",
		name: "Question 3: No Calculator",
		baseId: "calculator-visibility-q3",
		version: { major: 1, minor: 0, patch: 0 },
		config: {
			markup: '<multiple-choice id="q3"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "q3",
					element: "multiple-choice",
					prompt:
						"Why does the teacher ask the club to separate the fixed delivery fee from the per-kit cost?",
					choiceMode: "radio",
					choices: [
						{
							value: "a",
							label: "The delivery fee changes with every soil kit ordered.",
							correct: false,
						},
						{
							value: "b",
							label:
								"The per-kit cost is the only cost that matters in the budget.",
							correct: false,
						},
						{
							value: "c",
							label:
								"It helps the club tell which costs stay the same and which costs increase with each kit.",
							correct: true,
						},
						{
							value: "d",
							label:
								"The club cannot estimate totals until the garden boxes are built.",
							correct: false,
						},
					],
				},
			],
		},
	},
};

export const demo8ToolVisibilitySection: AssessmentSection = {
	identifier: "demo8-tool-visibility",
	title: "Demo 8: Tool Visibility from Item Data",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "passage-garden-budget",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-garden-budget-001",
				name: "STEM Club Garden Budget",
				baseId: "passage-garden-budget",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>
              STEM Club Garden Budget
            </h2>

            <p>
              The STEM club is planning a school garden. Each raised garden box needs soil kits,
              labels, and a sensor tray for measuring early plant growth. The teacher wants students
              to choose the right calculation tool for each task instead of using the same tool for
              every question.
            </p>

            <p>
              The basic budget task uses ordinary arithmetic. Each soil kit costs $18.75, and the
              club needs 24 kits. The supplier also charges one fixed delivery fee of $36 for the
              whole order.
            </p>

            <p>
              The growth-model task uses an exponent. The club starts with 250 seedlings and models
              the population after six weeks with the expression <strong>P = 250(1.08)<sup>6</sup></strong>.
              This is the kind of calculation where a scientific calculator is more appropriate.
            </p>

            <p>
              The final planning question asks students to interpret the budget setup, so it does not
              request a calculator at all.
            </p>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		basicCalculatorItem,
		scientificCalculatorItem,
		noCalculatorItem,
	],
};
