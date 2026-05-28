import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

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
                    a x squared, plus b x, plus c, equals zero,
                  </prosody>
                  <break time="300ms"/>
                  the quadratic formula returns the values of x that make the equation true:
                  <break time="400ms"/>
                  <prosody rate="slow">
                    x equals, negative b, plus or minus,
                    the square root of, b squared minus four a c,
                    <break time="150ms"/>
                    all divided by, two a.
                  </prosody>
                  <break time="500ms"/>
                  The expression under the square root,
                  <prosody rate="slow">b squared minus four a c,</prosody>
                  is called the <emphasis>discriminant</emphasis>, and it tells you
                  what kind of solutions to expect before you finish solving.
                </speak>`,
							},
						],
					},
					{
						identifier: "passage-quadratic-discriminant",
						cards: [
							{
								catalog: "spoken",
								language: "en-US",
								content: `<speak xml:lang="en-US">
                  When the discriminant is <emphasis>positive</emphasis>, the equation
                  has two distinct real solutions; the parabola crosses the x-axis twice.
                  <break time="300ms"/>
                  When the discriminant is <emphasis>zero</emphasis>, there is exactly
                  one real solution; the parabola just touches the x-axis.
                  <break time="300ms"/>
                  When the discriminant is <emphasis>negative</emphasis>, there are no
                  real solutions; the parabola never crosses the axis, and the formula
                  returns a pair of complex numbers instead.
                  <break time="500ms"/>
                  Factoring is faster when an equation factors cleanly, but most
                  quadratic equations do not. The formula works <emphasis>every</emphasis> time.
                </speak>`,
							},
						],
					},
				],
				config: {
					markup: `<div class="passage">
            <h2>One Formula, Every Quadratic</h2>

            <div class="subsection">
              <h3>The Quadratic Formula</h3>

              <div class="passage-content" data-catalog-idref="passage-quadratic-formula">
                <p>
                  Given any quadratic equation written in the standard form
                  <em>ax² + bx + c = 0</em>, the quadratic formula returns the values
                  of <em>x</em> that make the equation true:
                </p>
                <p class="formula">
                  x = (-b ± √(b² - 4ac)) / 2a
                </p>
                <p>
                  The expression under the square root, <em>b² - 4ac</em>, is called
                  the <strong>discriminant</strong>, and it tells you what kind of
                  solutions to expect before you finish solving.
                </p>
              </div>
            </div>

            <div class="subsection">
              <h3>What the Discriminant Tells You</h3>

              <div class="passage-content" data-catalog-idref="passage-quadratic-discriminant">
                <ul>
                  <li>
                    If <em>b² - 4ac &gt; 0</em>, there are <strong>two</strong> distinct
                    real solutions; the parabola crosses the x-axis twice.
                  </li>
                  <li>
                    If <em>b² - 4ac = 0</em>, there is exactly <strong>one</strong> real
                    solution; the parabola just touches the x-axis.
                  </li>
                  <li>
                    If <em>b² - 4ac &lt; 0</em>, there are <strong>no</strong> real
                    solutions; the formula returns a pair of complex numbers instead.
                  </li>
                </ul>
                <p>
                  Factoring is faster when an equation factors cleanly, but most quadratic
                  equations do not. The formula works <em>every</em> time.
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
									identifier: "q1-prompt",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content: `<speak xml:lang="en-US">
                  Based on the passage, which method should you use to solve
                  <prosody rate="slow">x squared, minus five x, plus six,
                  equals zero</prosody>?
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
									identifier: "q1-choice-b",
									cards: [
										{
											catalog: "spoken",
											language: "en-US",
											content:
												'<speak><emphasis level="strong">Factoring</emphasis>, because this equation factors easily into <prosody rate="slow">x minus 2, times x minus 3</prosody></speak>',
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
							prompt: `<div data-catalog-idref="q1-prompt">
                Based on the passage, which method should you use to solve x² - 5x + 6 = 0?
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
									label: `<div data-catalog-idref="q1-choice-b">
                    Factoring, because this equation factors easily into (x - 2)(x - 3)
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
