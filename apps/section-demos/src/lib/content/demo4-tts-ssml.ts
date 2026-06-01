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
 * Demo 4: TTS with SSML Extraction
 *
 * Topic: Practical SSML controls for assessment TTS
 * Complexity: Advanced (★★★)
 * Time: ~8 minutes
 *
 * Learning Objectives:
 * - Demonstrate SSML extraction and accessibility catalog generation
 * - Show multi-level TTS: content-level buttons and user-selection TTS
 * - Showcase controlled math pronunciation with embedded SSML
 * - Demonstrate realistic pacing, emphasis, and say-as controls
 *
 * TTS Features Demonstrated:
 * - Passage with SSML for controlled pacing around a math expression
 * - Q1: SSML in prompt (slow speech for complex math) and choices (emphasis)
 * - Q2: Practical non-math SSML for directions, dates, and acronyms
 * - Content-level TTS buttons in headers
 */
export const demo4Section: AssessmentSection = {
	identifier: "demo4-tts-ssml",
	title: "Demo 4: TTS with SSML Extraction",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			identifier: "passage-quadratic-equations",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-quadratic-001",
				name: "One Formula, Every Quadratic",
				baseId: "passage-quadratic",
				version: { major: 1, minor: 0, patch: 0 },
				accessibilityCatalogs: [
					{
						identifier: "passage-quadratic-formula",
						cards: [
							{
								catalog: "spoken",
								language: "en-US",
								content: `<speak xml:lang="en-US">
                  Given any quadratic equation written in the standard form
                  <prosody rate="slow">
                    A X squared, plus B X, plus C, equals zero,
                  </prosody>
                  <break time="300ms"/>
                  the quadratic formula returns the values of x that make the equation true:
                  <break time="400ms"/>
                  <prosody rate="slow">
                    X equals, negative B, plus or minus,
                    the square root of, B squared minus 4 A C,
                    <break time="150ms"/>
                    all divided by, 2 A.
                  </prosody>
                  <break time="500ms"/>
                  The expression under the square root,
                  <prosody rate="slow">B squared minus 4 A C,</prosody>
                  is called the <emphasis>discriminant</emphasis>, and it tells you
                  what kind of solutions to expect before you finish solving.
                </speak>`,
							},
						],
					},
					{
						identifier: "passage-quadratic-method",
						cards: [
							{
								catalog: "spoken",
								language: "en-US",
								content: `<speak xml:lang="en-US">When a quadratic factors cleanly into two simple binomials, factoring is the quickest way to solve it. When it does not, the quadratic formula always works.</speak>`,
							},
						],
					},
				],
				config: {
					markup: `<div class="passage">
            <div class="subsection">
              <h3>The Quadratic Formula</h3>

              <div class="passage-content" data-catalog-idref="passage-quadratic-formula">
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

              <div class="passage-content" data-catalog-idref="passage-quadratic-method">
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
				id: "quadratic-q1",
				name: "Question 1: Method Selection",
				baseId: "quadratic-q1",
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
							accessibilityCatalogs: [
								{
									identifier: "q1-prompt-text",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: `<speak xml:lang="en-US">
                  Based on the passage, which method should you use to solve
                </speak>`,
										},
									],
								},
								{
									identifier: "q1-equation",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: `<speak xml:lang="en-US">
                  <prosody rate="slow">X squared, minus 5 X, plus 6,
                  equals zero?</prosody>
                </speak>`,
										},
									],
								},
								{
									identifier: "q1-choice-a",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content:
												"<speak>The <emphasis>quadratic formula</emphasis>, because it works for all equations</speak>",
										},
									],
								},
								{
									identifier: "q1-choice-b-text",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content:
												'<speak><emphasis level="strong">Factoring</emphasis>, because this equation factors easily into</speak>',
										},
									],
								},
								{
									identifier: "q1-choice-b-equation",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content:
												'<speak><prosody rate="slow">X minus 2, times X minus 3</prosody></speak>',
										},
									],
								},
								{
									identifier: "q1-choice-c",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: "<speak>Completing the square</speak>",
										},
									],
								},
								{
									identifier: "q1-choice-d",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: "<speak>Graphing the equation</speak>",
										},
									],
								},
							],
							prompt: `<div>
                <span data-catalog-idref="q1-prompt-text">Based on the passage, which method should you use to solve</span>
                <span data-catalog-idref="q1-equation">${q1EquationMath}<span aria-hidden="true">?</span></span>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: `<div data-catalog-idref="q1-choice-a">
                    The quadratic formula, because it works for all equations
                  </div>`,
									correct: false,
								},
								{
									value: "b",
									label: `<div>
                    <span data-catalog-idref="q1-choice-b-text">Factoring, because this equation factors easily into</span>
                    <span data-catalog-idref="q1-choice-b-equation">${factoredEquationMath}</span>
                  </div>`,
									correct: true,
								},
								{
									value: "c",
									label: `<div data-catalog-idref="q1-choice-c">
                    Completing the square
                  </div>`,
									correct: false,
								},
								{
									value: "d",
									label: `<div data-catalog-idref="q1-choice-d">
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
				id: "directions-q2",
				name: "Question 2: Source-Based Response Directions",
				baseId: "directions-q2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<extended-text-entry id="q2"></extended-text-entry>',
					elements: {
						"extended-text-entry": "@pie-element/extended-text-entry@latest",
					},
					models: [
						{
							id: "q2",
							element: "extended-text-entry",
							accessibilityCatalogs: [
								{
									identifier: "q2-prompt",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: `<speak xml:lang="en-US">
                  Read the notice, then write a short response.
                  <break time="600ms"/>
                  In your response, <emphasis level="moderate">be sure to</emphasis>:
                  <break time="300ms"/>
                  <prosody rate="95%">
                    identify the main request,
                    <break time="250ms"/>
                    explain why the deadline matters,
                    <break time="250ms"/>
                    and recommend one next step.
                  </prosody>
                  <break time="600ms"/>
                  The deadline is
                  <say-as interpret-as="date" format="mdy">04/22/2026</say-as>.
                  The request comes from the
                  <say-as interpret-as="characters">PTA</say-as>.
                </speak>`,
										},
									],
								},
							],
							prompt: `<div data-catalog-idref="q2-prompt">
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
