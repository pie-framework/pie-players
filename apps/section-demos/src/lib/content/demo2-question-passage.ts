import type { QtiAssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 2: Single Question with Single Passage
 *
 * Topic: Renaissance History (10th grade level, Lexile ~1050L)
 * Complexity: Intermediate (★★☆)
 * Time: ~10 minutes
 *
 * Learning Objectives:
 * - Understand how passages are rendered alongside questions
 * - See the relationship between passage content and comprehension questions
 * - Learn about the Renaissance period and its cultural impact
 */
export const demo2Section: QtiAssessmentSection = {
	identifier: "demo2-question-passage",
	title: "Demo 2: Question with Passage",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			id: "passage-renaissance",
			view: "candidate",
			use: "passage",
			passage: {
				id: "passage-renaissance-001",
				name: "The Renaissance: A Cultural Rebirth",
				baseId: "passage-renaissance",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage" style="padding: 1.5rem; line-height: 1.7;">
            <h2 style="margin-top: 0; color: #2c3e50; font-size: 1.5rem; margin-bottom: 1rem;">
              The Renaissance: A Cultural Rebirth
            </h2>

            <p style="margin-bottom: 1rem;">
              The Renaissance, spanning roughly from the 14th to 17th centuries, marked a profound
              transformation in European intellectual and artistic life. Beginning in Italy and spreading
              throughout Europe, this period witnessed a renewed interest in classical Greek and Roman
              learning, art, and philosophy. The term "Renaissance" itself means "rebirth," reflecting
              the era's emphasis on rediscovering and building upon ancient wisdom.
            </p>

            <p style="margin-bottom: 1rem;">
              During this time, wealthy merchant families like the Medici of Florence became patrons of
              the arts, supporting artists such as Leonardo da Vinci, Michelangelo, and Raphael. These
              artists developed new techniques like linear perspective, which created more realistic depth
              in paintings. Writers like Shakespeare and Dante explored human nature and emotion in
              unprecedented ways. Scientists and thinkers such as Galileo and Copernicus challenged
              long-held beliefs about the universe, laying the groundwork for the Scientific Revolution.
            </p>

            <p style="margin-bottom: 0;">
              The invention of the printing press by Johannes Gutenberg around 1440 accelerated the spread
              of Renaissance ideas. Books became more accessible, literacy rates increased, and new ideas
              could travel faster than ever before. This technological advancement democratized knowledge
              and helped transform European society from the medieval period into the early modern era.
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
			identifier: "q1-renaissance",
			required: true,
			item: {
				id: "renaissance-q1",
				name: "Question 1",
				baseId: "renaissance-q1",
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
                <p><strong>According to the passage, what was the primary significance of Gutenberg's printing press during the Renaissance?</strong></p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"It allowed artists to reproduce their paintings more accurately",
									correct: false,
								},
								{
									value: "b",
									label:
										"It helped spread knowledge and ideas more quickly to more people",
									correct: true,
								},
								{
									value: "c",
									label: "It enabled scientists to conduct more experiments",
									correct: false,
								},
								{
									value: "d",
									label: "It replaced the need for wealthy patrons of the arts",
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
