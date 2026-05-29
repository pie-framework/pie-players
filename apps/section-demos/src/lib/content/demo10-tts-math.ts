import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 10: TTS with MathML
 *
 * This fixture intentionally avoids embedded <speak> tags in the generated
 * examples so the assessment toolkit's automatic MathML-to-speech path is
 * exercised directly.
 */
export const demo10TtsMathSection: AssessmentSection = {
	identifier: "demo10-tts-math",
	title: "Demo 10: TTS with MathML",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "passage-automatic-math-tts",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-automatic-math-tts",
				name: "Automatic Math Speech",
				baseId: "passage-automatic-math-tts",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
						<h2>Automatic Math Speech</h2>
						<p>
							This passage contains structured MathML without authored SSML. TTS
							should read the expression below as natural math speech before the
							configured provider receives the text.
						</p>
						<p>
							The slope formula is
							<math xmlns="http://www.w3.org/1998/Math/MathML">
								<mrow>
									<mi>m</mi>
									<mo>=</mo>
									<mfrac>
										<mrow>
											<msub><mi>y</mi><mn>2</mn></msub>
											<mo>-</mo>
											<msub><mi>y</mi><mn>1</mn></msub>
										</mrow>
										<mrow>
											<msub><mi>x</mi><mn>2</mn></msub>
											<mo>-</mo>
											<msub><mi>x</mi><mn>1</mn></msub>
										</mrow>
									</mfrac>
								</mrow>
							</math>.
						</p>
						<p>
							A second example uses a square root:
							<math xmlns="http://www.w3.org/1998/Math/MathML">
								<msqrt>
									<mrow><mi>x</mi><mo>+</mo><mn>9</mn></mrow>
								</msqrt>
							</math>.
						</p>
					</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "mathml-fraction-question",
			required: true,
			item: {
				id: "mathml-fraction-question",
				name: "Question 1: Fraction MathML",
				baseId: "mathml-fraction-question",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="mathmlFraction"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "mathmlFraction",
							element: "multiple-choice",
							prompt: `<div>
								<p>
									Which choice is equivalent to
									<math xmlns="http://www.w3.org/1998/Math/MathML">
										<mfrac><mn>1</mn><mn>2</mn></mfrac>
									</math>
									of 8?
								</p>
								<p><em>Expected TTS: "one half", not raw numerator and denominator text.</em></p>
							</div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn></math>',
									correct: false,
								},
								{
									value: "b",
									label:
										'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>4</mn></math>',
									correct: true,
								},
								{
									value: "c",
									label:
										'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>6</mn></math>',
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "mathjax-data-mathml-question",
			required: true,
			item: {
				id: "mathjax-data-mathml-question",
				name: "Question 2: MathJax data-mathml",
				baseId: "mathjax-data-mathml-question",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="mathjaxDataMathml"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "mathjaxDataMathml",
							element: "multiple-choice",
							prompt: `<div>
								<p>
									Read the rendered expression
									<span
										class="MathJax"
										data-mathml='<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>'
									>
										<math xmlns="http://www.w3.org/1998/Math/MathML">
											<msup><mi>x</mi><mn>2</mn></msup>
										</math>
									</span>
									aloud with TTS.
								</p>
								<p><em>Expected TTS: "x squared" from the data-mathml attribute.</em></p>
							</div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "x squared",
									correct: true,
								},
								{
									value: "b",
									label: "x times two",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
	],
};
