import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import {
	basicCalculatorItem,
	scientificCalculatorItem,
} from "./demo8-tool-visibility";

type AssessmentItemRef = NonNullable<
	AssessmentSection["assessmentItemRefs"]
>[number];

const graphingCalculatorItem = {
	identifier: "q3-geogebra-graphing-intersection",
	required: true,
	toolMetadata: { calculator: "graphing" },
	item: {
		id: "calculator-geogebra-q3",
		name: "Question 3: Graphing Calculator",
		baseId: "calculator-geogebra-q3",
		version: { major: 1, minor: 0, patch: 0 },
		toolMetadata: { calculator: "graphing" },
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
						"Graph y = 2x + 1 and y = -x + 7. At which point do the two lines intersect?",
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "(1, 3)", correct: false },
						{ value: "b", label: "(2, 5)", correct: true },
						{ value: "c", label: "(3, 4)", correct: false },
						{ value: "d", label: "(4, 3)", correct: false },
					],
				},
			],
		},
	},
} as AssessmentItemRef;

export const demoGeoGebraCalculatorSection: AssessmentSection = {
	identifier: "demo-geogebra-calculator-suite",
	title: "GeoGebra Calculator Suite",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "geogebra-calculator-suite-intro",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "geogebra-calculator-suite-passage",
				name: "GeoGebra Calculator Modes",
				baseId: "geogebra-calculator-suite-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>GeoGebra Calculator Modes</h2>
            <p>
              Each item requests its calculator mode through assessment-toolkit
              context: basic, scientific, then graphing. PIE maps the basic request
              to GeoGebra Scientific because GeoGebra has no four-function embed.
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
		graphingCalculatorItem,
	],
};
