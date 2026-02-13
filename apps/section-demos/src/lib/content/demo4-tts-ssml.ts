import type { QtiAssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 4: TTS with SSML Extraction
 *
 * Topic: Quadratic Equations (9th-10th grade, Lexile ~1000L)
 * Complexity: Advanced (★★★)
 * Time: ~15 minutes
 *
 * Learning Objectives:
 * - Demonstrate SSML extraction and accessibility catalog generation
 * - Show multi-level TTS: content-level buttons and user-selection TTS
 * - Showcase proper math pronunciation with embedded SSML
 * - Compare SSML-enhanced TTS vs plain text fallback
 * - Demonstrate AWS-specific SSML tags (aws-break, aws-emphasis, aws-w, aws-say-as)
 *
 * TTS Features Demonstrated:
 * - Passage with SSML for proper pronunciation ("polynomial", math expressions)
 * - Q1: SSML in prompt (slow speech for complex math) and choices (emphasis)
 * - Q2: Plain text fallback (no SSML)
 * - Q3: Advanced AWS SSML tags (breaks, emphasis levels, parts of speech, spell-out)
 * - Content-level TTS buttons in headers
 */
export const demo4Section: QtiAssessmentSection = {
	identifier: "demo4-tts-ssml",
	title: "Demo 4: TTS with SSML Extraction",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			identifier: "passage-quadratic-equations",
			view: "candidate",
			class: "stimulus",
			passage: {
				id: "passage-quadratic-001",
				name: "Understanding Quadratic Equations",
				baseId: "passage-quadratic",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage" style="padding: 1.5rem; line-height: 1.7; background: #f8f9fa; border-radius: 8px;">
            <h2 style="margin-top: 0; color: #2c3e50; font-size: 1.5rem; margin-bottom: 1rem;">
              Understanding Quadratic Equations
            </h2>

            <div class="passage-content">
              <speak xml:lang="en-US">
                A <emphasis level="strong">quadratic equation</emphasis> is a
                <phoneme alphabet="ipa" ph="ˌpɒlɪˈnoʊmiəl">polynomial</phoneme>
                equation of the second degree.
                <break time="300ms"/>
                The general form is <prosody rate="slow">a x squared,
                plus b x, plus c, equals zero</prosody>, where a is not equal
                to zero.
                <break time="500ms"/>
                To solve quadratic equations, we can use three main methods:
                <break time="200ms"/>
                <prosody rate="medium">
                  factoring, <break time="100ms"/>
                  completing the square, <break time="100ms"/>
                  or the quadratic formula.
                </prosody>
              </speak>

              <p style="margin-bottom: 1rem;">
                A <strong>quadratic equation</strong> is a polynomial equation of the
                second degree. The general form is ax² + bx + c = 0, where a ≠ 0.
              </p>

              <p style="margin-bottom: 1rem;">
                To solve quadratic equations, we can use three main methods:
                <strong>factoring</strong>, <strong>completing the square</strong>,
                or the <strong>quadratic formula</strong>.
              </p>
            </div>

            <div class="subsection" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #dee2e6;">
              <h3 style="color: #495057; font-size: 1.25rem; margin-bottom: 0.75rem;">
                The Quadratic Formula
              </h3>

              <div class="passage-content">
                <speak xml:lang="en-US">
                  The quadratic formula is: <break time="200ms"/>
                  <prosody rate="slow">
                    x equals, negative b, plus or minus,
                    the square root of, b squared, minus 4 a c,
                    <break time="100ms"/>
                    all divided by, 2 a
                  </prosody>
                  <break time="300ms"/>
                  This formula works for <emphasis>any</emphasis> quadratic equation,
                  even when factoring is difficult or impossible.
                </speak>

                <p style="margin-bottom: 0.5rem;">
                  The quadratic formula is:
                </p>
                <p style="font-size: 1.25rem; text-align: center; font-family: 'Times New Roman', serif; margin: 1rem 0;">
                  x = (-b ± √(b² - 4ac)) / 2a
                </p>
                <p>
                  This formula works for <em>any</em> quadratic equation, even when
                  factoring is difficult or impossible.
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
							prompt: `<div>
                <speak xml:lang="en-US">
                  Based on the passage, which method should you use to solve
                  <prosody rate="slow">x squared, minus five x, plus six,
                  equals zero</prosody>?
                </speak>

                <p><strong>Based on the passage, which method should you use to solve x² - 5x + 6 = 0?</strong></p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: `<div>
                    <speak>The <emphasis>quadratic formula</emphasis>, because it works for all equations</speak>
                    <span>The quadratic formula, because it works for all equations</span>
                  </div>`,
									correct: false,
								},
								{
									value: "b",
									label: `<div>
                    <speak><emphasis level="strong">Factoring</emphasis>, because this equation factors easily into <prosody rate="slow">x minus 2, times x minus 3</prosody></speak>
                    <span>Factoring, because this equation factors easily into (x - 2)(x - 3)</span>
                  </div>`,
									correct: true,
								},
								{
									value: "c",
									label: `<div>
                    <speak>Completing the square</speak>
                    <span>Completing the square</span>
                  </div>`,
									correct: false,
								},
								{
									value: "d",
									label: `<div>
                    <speak>Graphing the equation</speak>
                    <span>Graphing the equation</span>
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
			identifier: "q2-find-factors",
			required: true,
			item: {
				id: "quadratic-q2",
				name: "Question 2: Finding Factors",
				baseId: "quadratic-q2",
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
							prompt: `<div>
                <p><strong>What are the factors of the equation x² - 5x + 6 = 0?</strong></p>
                <p style="font-size: 0.9rem; color: #6c757d; margin-top: 0.5rem;">
                  <em>Note: This question has no embedded SSML - demonstrating plain text TTS fallback.</em>
                </p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "(x - 2)(x - 3)",
									correct: true,
								},
								{
									value: "b",
									label: "(x - 1)(x - 6)",
									correct: false,
								},
								{
									value: "c",
									label: "(x + 2)(x + 3)",
									correct: false,
								},
								{
									value: "d",
									label: "(x + 1)(x + 6)",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "q3-essay-instructions",
			required: true,
			item: {
				id: "quadratic-q3",
				name: "Question 3: Essay Instructions (AWS SSML)",
				baseId: "quadratic-q3",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<extended-text-entry id="q3"></extended-text-entry>',
					elements: {
						"extended-text-entry": "@pie-element/extended-text-entry@latest",
					},
					models: [
						{
							id: "q3",
							element: "extended-text-entry",
							prompt: `<div>
                <speak xml:lang="en-US">
                  Write a detailed explanation of how to solve quadratic equations.
                  <aws-break time='2s' strength='strong'/>
                  In your response, <aws-emphasis level='moderate'>be sure to</aws-emphasis>:
                  <aws-break time='500ms' strength='medium'/>
                  <prosody rate="95%">
                    clearly <aws-w role='amazon:VB'>state</aws-w> the three main methods,
                    <aws-break time='300ms' strength='weak'/>
                    organize your ideas in writing,
                    <aws-break time='300ms' strength='weak'/>
                    develop your ideas in detail,
                    <aws-break time='300ms' strength='weak'/>
                    use evidence from the passage in your response,
                    <aws-break time='300ms' strength='weak'/>
                    and use correct spelling, capitalization, punctuation, and grammar.
                  </prosody>
                  <aws-break time='1s' strength='medium'/>
                  For mathematical notation, spell out equations.
                  For example, write <aws-say-as interpret-as='spell-out'>x²</aws-say-as> as
                  <aws-emphasis level='strong'>x squared</aws-emphasis>.
                </speak>

                <div style="padding: 1rem; background: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 1rem;">
                  <p style="margin: 0 0 0.75rem 0; font-weight: 600; color: #856404;">
                    AWS SSML Demo - Advanced TTS Features
                  </p>
                  <p style="margin: 0; font-size: 0.9rem; color: #856404;">
                    This prompt demonstrates AWS-specific SSML tags including aws-break,
                    aws-emphasis, aws-w (parts of speech), and aws-say-as (spell-out).
                  </p>
                </div>

                <p><strong>Write a detailed explanation of how to solve quadratic equations.</strong></p>
                <p style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                  In your response, <strong>be sure to</strong>:
                </p>
                <ul style="margin-top: 0.5rem; line-height: 1.8;">
                  <li>Clearly <strong>state</strong> the three main methods</li>
                  <li>Organize your ideas in writing</li>
                  <li>Develop your ideas in detail</li>
                  <li>Use evidence from the passage in your response</li>
                  <li>Use correct spelling, capitalization, punctuation, and grammar</li>
                </ul>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #6c757d;">
                  <em>Note: For mathematical notation, spell out equations.
                  For example, write x² as "x squared".</em>
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
