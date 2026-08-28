import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import {
	basicCalculatorItem,
	scientificCalculatorItem,
} from "./demo8-tool-visibility";

type AssessmentItemRef = NonNullable<
	AssessmentSection["assessmentItemRefs"]
>[number];

/*
 * A graphing item of its own, asking something the plot answers rather than
 * something arithmetic does — the same reason the GeoGebra and Cortex suites carry
 * one. The zero of a quadratic is the case where a learner reads the graph.
 */
const graphingCalculatorItem = {
	identifier: "q3-desmos-graphing-zero",
	required: true,
	toolMetadata: { calculator: "graphing" },
	item: {
		id: "calculator-desmos-q3",
		name: "Question 3: Graphing Calculator",
		baseId: "calculator-desmos-q3",
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
						"Graph y = x^2 - 5x + 6. What are the x-intercepts of the parabola?",
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "x = 2 and x = 3", correct: true },
						{ value: "b", label: "x = -2 and x = -3", correct: false },
						{ value: "c", label: "x = 1 and x = 6", correct: false },
						{ value: "d", label: "x = 0 and x = 5", correct: false },
					],
				},
			],
		},
	},
} as AssessmentItemRef;

export const demoDesmosCalculatorSection: AssessmentSection = {
	identifier: "demo-desmos-calculator-suite",
	title: "Desmos Calculator Suite",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "desmos-calculator-suite-intro",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "desmos-calculator-suite-passage",
				name: "Desmos Calculator Configuration",
				baseId: "desmos-calculator-suite-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Desmos Calculator Configuration</h2>
            <p>
              Each item requests its calculator mode through assessment-toolkit
              context: basic, scientific, then graphing. Desmos is the provider a
              host gets when it configures none, so this is also what
              <code>DEFAULT_CALCULATOR_PROVIDER_ID</code> resolves to.
            </p>
            <p>
              Unlike the other demos in this app, this one configures Desmos rather
              than accepting its defaults. The host passes:
            </p>
            <pre><code>calculator: {
  provider: {
    id: 'calculator-desmos',
    runtime: { authFetcher }
  },
  settings: {
    degreeMode: 'radian',
    restrictedFunctions: true,
    settingsMenu: false, links: false,
    notes: false, folders: false,
    images: false, sliders: false
  }
}</code></pre>
            <p>
              Everything under <code>settings</code> is Desmos' own API, and its type
              lives in <code>@pie-players/pie-calculator-desmos</code> rather than in
              the generic calculator contract — a host that switches providers
              changes that block and nothing else. Alongside it,
              <code>restrictedMode</code> is the one lockdown field every provider
              reads, and it is monotonic — <code>settings</code> cannot relax what it
              turns off.
            </p>
            <p>
              <code>runtime.authFetcher</code> is where the API key comes from: the
              key is fetched by the host at open time rather than compiled into the
              item, which is what keeps it out of item content. The provider cannot
              start without it, so a network failure here surfaces as the tool
              failing to load rather than as a silent blank panel.
            </p>
            <p>
              The graphing calculator opens at 720&times;660 and the scientific and
              basic ones at 380 wide, sized per type from what each layout measures.
              Drag a corner: below what a layout can hold, the panel scrolls its
              content and the keys step down in size rather than being cut off.
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
