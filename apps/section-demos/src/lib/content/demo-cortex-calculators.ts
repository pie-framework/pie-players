import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import {
	basicCalculatorItem,
	scientificCalculatorItem,
} from "./demo8-tool-visibility";

type AssessmentItemRef = NonNullable<
	AssessmentSection["assessmentItemRefs"]
>[number];

/*
 * A graphing item of its own rather than a reuse, because the Cortex graphing
 * calculator is the mode with no Desmos or GeoGebra equivalent in this repository
 * — it plots in JSXGraph and traces from the keyboard — so the item asks a
 * question that needs the plot rather than one a learner can answer by arithmetic.
 */
const graphingCalculatorItem = {
	identifier: "q3-cortex-graphing-vertex",
	required: true,
	toolMetadata: { calculator: "graphing" },
	item: {
		id: "calculator-cortex-q3",
		name: "Question 3: Graphing Calculator",
		baseId: "calculator-cortex-q3",
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
						"Graph y = x^2 - 4x + 1. What are the coordinates of its vertex?",
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
} as AssessmentItemRef;

export const demoCortexCalculatorSection: AssessmentSection = {
	identifier: "demo-cortex-calculator-suite",
	title: "Open-Source Calculator Suite",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "cortex-calculator-suite-intro",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "cortex-calculator-suite-passage",
				name: "Open-Source Calculator Configuration",
				baseId: "cortex-calculator-suite-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Open-Source Calculator Configuration</h2>
            <p>
              Each item requests its calculator mode through assessment-toolkit
              context: basic, scientific, then graphing. No vendor key and no network
              request — the provider is a package in this repository, and it runs
              offline.
            </p>
            <p>
              This demo configures the calculator rather than accepting its defaults.
              The host passes:
            </p>
            <pre><code>calculator: {
  provider: { id: 'calculator-cortex' },
  restrictedMode: true,
  settings: {
    angleMode: 'radian',
    historyLimit: 20,
    allowedFunctions: [ /* factorial and log-base-n omitted */ ]
  }
}</code></pre>
            <p>
              So the scientific keypad has no <strong>!</strong> key and no
              <strong>log</strong>-with-a-base key, and typing either raises the
              calculator's own error rather than answering. That is the point of the
              narrowing: a host cannot be offered a key the validator would refuse.
              Clipboard actions are off because <code>restrictedMode</code> is
              monotonic and cannot be relaxed by <code>allowClipboard</code>.
            </p>
            <p>
              Angle mode is radian here, so <code>sin(&pi;/2)</code> answers 1 while
              the same expression in the default degree mode does not. History keeps
              20 entries; tap one to bring it back into the expression.
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
