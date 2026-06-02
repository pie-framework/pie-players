import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

const mathml = (content: string, attributes = ""): string =>
	`<math xmlns="http://www.w3.org/1998/Math/MathML"${attributes}>${content}</math>`;

const standardQuadraticMath = mathml(`<mrow>
                    <mi>a</mi><mo>&#x2062;</mo><msup><mi>x</mi><mn>2</mn></msup>
                    <mo>+</mo><mi>b</mi><mo>&#x2062;</mo><mi>x</mi>
                    <mo>+</mo><mi>c</mi><mo>=</mo><mn>0</mn>
                  </mrow>`);

const quadraticFormulaMath = mathml(
	`<mrow>
                    <mi>x</mi><mo>=</mo>
                    <mfrac>
                      <mrow>
                        <mo>-</mo><mi>b</mi><mo>±</mo>
                        <msqrt>
                          <mrow>
                            <msup><mi>b</mi><mn>2</mn></msup>
                            <mo>-</mo><mn>4</mn><mo>&#x2062;</mo><mi>a</mi><mo>&#x2062;</mo><mi>c</mi>
                          </mrow>
                        </msqrt>
                      </mrow>
                      <mrow><mn>2</mn><mo>&#x2062;</mo><mi>a</mi></mrow>
                    </mfrac>
                  </mrow>`,
	' display="block"',
);

const discriminantMath = mathml(`<mrow>
                    <msup><mi>b</mi><mn>2</mn></msup>
                    <mo>-</mo><mn>4</mn><mo>&#x2062;</mo><mi>a</mi><mo>&#x2062;</mo><mi>c</mi>
                  </mrow>`);

const q1EquationMath = mathml(`<mrow>
                    <msup><mi>x</mi><mn>2</mn></msup>
                    <mo>-</mo><mn>5</mn><mo>&#x2062;</mo><mi>x</mi>
                    <mo>+</mo><mn>6</mn><mo>=</mo><mn>0</mn>
                  </mrow>`);

const factoredEquationMath = mathml(`<mrow>
                    <mo>(</mo><mi>x</mi><mo>-</mo><mn>2</mn><mo>)</mo>
                    <mo>&#x2062;</mo>
                    <mo>(</mo><mi>x</mi><mo>-</mo><mn>3</mn><mo>)</mo>
                  </mrow>`);

/**
 * Demo 10: TTS with Generated SSML
 *
 * This fixture is the no-authored-SSML counterpart to Demo 4 (TTS with SSML).
 * It carries the *same visible content* — the quadratic-formula passage, the
 * method-selection question with MathML choices, and the source-based response
 * directions — but deliberately ships **no `accessibilityCatalogs` and no
 * `<speak>` markup** and no `data-catalog-idref` anchors.
 *
 * With nothing authored, the assessment toolkit's generated-speech path takes
 * over: it lets Speech Rule Engine convert the MathML and, for SSML-capable
 * providers (AWS Polly, Google), sends SRE's SSML on the fly. That preserves
 * details such as `<say-as interpret-as="character">` for variables without
 * toolkit-specific speech rewrites, while reusing the same confidence-gated
 * highlighting pipeline as the authored-SSML demo. Compare side by side with
 * the `tts-ssml` demo to see authored vs. generated SSML over identical content.
 */
export const demo10TtsGeneratedSsmlSection: AssessmentSection = {
	identifier: "demo10-tts-generated-ssml",
	title: "Demo 10: TTS with Generated SSML",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			identifier: "passage-quadratic-equations",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-quadratic-generated-001",
				name: "One Formula, Every Quadratic",
				baseId: "passage-quadratic-generated",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <div class="subsection">
              <h3>The Quadratic Formula</h3>

              <div class="passage-content">
                <p>
                  Given any quadratic equation written in the standard form
                  ${standardQuadraticMath}, the quadratic formula returns the values
                  of <em>x</em> that make the equation true:
                </p>
                <p class="formula">
                  ${quadraticFormulaMath}
                </p>
                <p>
                  The expression under the square root, ${discriminantMath}, is called
                  the <strong>discriminant</strong>, and it tells you what kind of
                  solutions to expect before you finish solving.
                </p>
              </div>
            </div>

            <div class="subsection">
              <h3>Choosing a Method</h3>

              <div class="passage-content">
                <p>
                  When a quadratic factors cleanly into two simple binomials, factoring is
                  the quickest way to solve it. When it does not, the quadratic formula
                  always works.
                </p>
              </div>
            </div>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "q1-quadratic-method",
			required: true,
			item: {
				id: "generated-quadratic-q1",
				name: "Question 1: Method Selection",
				baseId: "generated-quadratic-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="gq1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "gq1",
							element: "multiple-choice",
							prompt: `<div>
                <span>Based on the passage, which method should you use to solve</span>
                <span>${q1EquationMath}<span aria-hidden="true">?</span></span>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: `<div>
                    The quadratic formula, because it works for all equations
                  </div>`,
									correct: false,
								},
								{
									value: "b",
									label: `<div>
                    <span>Factoring, because this equation factors easily into</span>
                    <span>${factoredEquationMath}</span>
                  </div>`,
									correct: true,
								},
								{
									value: "c",
									label: `<div>
                    Completing the square
                  </div>`,
									correct: false,
								},
								{
									value: "d",
									label: `<div>
                    Graphing the equation
                  </div>`,
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "q2-essay-instructions",
			required: true,
			item: {
				id: "generated-directions-q2",
				name: "Question 2: Source-Based Response Directions",
				baseId: "generated-directions-q2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<extended-text-entry id="gq2"></extended-text-entry>',
					elements: {
						"extended-text-entry": "@pie-element/extended-text-entry@latest",
					},
					models: [
						{
							id: "gq2",
							element: "extended-text-entry",
							prompt: `<div>
                <p>Read the notice, then write a short response.</p>
                <p>
                  In your response, <strong>be sure to</strong>:
                </p>
                <ul>
                  <li>Identify the main request</li>
                  <li>Explain why the deadline matters</li>
                  <li>Recommend one next step</li>
                </ul>
                <p>
                  The deadline is 04/22/2026. The request comes from the PTA.
                </p>
              </div>`,
							maxCharacters: 2000,
						},
					],
				},
			},
		},
	],
};
