import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 3: Three Questions, One Passage
 *
 * Topic: Photosynthesis and Ecosystems (8-9th grade level, Lexile ~950L)
 * Complexity: Advanced (★★★)
 * Time: ~15 minutes
 *
 * Learning Objectives:
 * - See how multiple questions share a single passage
 * - Understand reading comprehension assessment structure
 * - Learn about photosynthesis and its role in ecosystems
 */
export const demo3Section: AssessmentSection = {
	identifier: "demo3-three-questions",
	title: "Demo 3: Three Questions, One Passage",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			identifier: "passage-photosynthesis",
			view: "candidate",
			class: "stimulus",
			passage: {
				id: "passage-photosynthesis-001",
				name: "Photosynthesis: The Foundation of Life on Earth",
				baseId: "passage-photosynthesis",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage" style="padding: 1.5rem; line-height: 1.7;">
            <h2 style="margin-top: 0; color: #2c3e50; font-size: 1.5rem; margin-bottom: 1rem;">
              Photosynthesis: The Foundation of Life on Earth
            </h2>

            <p style="margin-bottom: 1rem;">
              Photosynthesis is one of the most important biological processes on our planet, serving as
              the foundation for nearly all life. This remarkable process allows plants, algae, and certain
              bacteria to convert light energy from the sun into chemical energy stored in glucose molecules.
              The word photosynthesis comes from Greek roots meaning "putting together with light," which
              perfectly describes what happens during this vital reaction.
            </p>

            <p style="margin-bottom: 1rem;">
              The process occurs primarily in plant leaves, specifically in specialized cellular structures
              called <strong>chloroplasts</strong>. Inside these chloroplasts, a green pigment called
              chlorophyll captures light energy. The plant then uses this energy to combine carbon dioxide
              from the air with water absorbed through its roots. Through a series of complex chemical
              reactions, the plant produces <strong>glucose</strong> (a simple sugar) and releases
              <strong>oxygen</strong> as a byproduct. The chemical equation for photosynthesis can be
              written as: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.
            </p>

            <p style="margin-bottom: 1rem;">
              The glucose produced through photosynthesis serves multiple purposes. Plants use some glucose
              immediately for energy to fuel their own growth and reproduction. They convert the rest into
              more complex molecules like cellulose (which forms cell walls) or starch (which serves as
              stored energy). When animals eat plants, they break down these molecules to obtain the energy
              originally captured from sunlight. This makes plants the primary producers in most ecosystems,
              forming the base of the food chain.
            </p>

            <p style="margin-bottom: 1rem;">
              The oxygen released during photosynthesis is equally crucial for life on Earth. Nearly all the
              oxygen in our atmosphere—the gas we breathe to survive—comes from photosynthesis. Ancient
              photosynthetic bacteria and plants spent billions of years transforming Earth's early atmosphere,
              gradually increasing oxygen levels from near zero to the 21% we have today. Without this long
              history of photosynthesis, complex animal life as we know it could never have evolved.
            </p>

            <p style="margin-bottom: 0;">
              Understanding photosynthesis is essential for addressing modern environmental challenges. As
              human activities release more carbon dioxide into the atmosphere, <strong>forests and oceans</strong>
              (home to countless photosynthetic organisms) play a critical role in <strong>absorbing this
              excess CO₂</strong>. Protecting these natural systems and supporting photosynthetic life is
              therefore not just about preserving biodiversity—it's about maintaining the delicate balance
              that makes Earth habitable for all organisms, including humans.
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
			identifier: "q1-photosynthesis-products",
			required: true,
			item: {
				id: "photosynthesis-q1",
				name: "Question 1",
				baseId: "photosynthesis-q1",
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
                <p><strong>Question 1: Based on the passage, what are the two main products of photosynthesis?</strong></p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Chlorophyll and carbon dioxide",
									correct: false,
								},
								{
									value: "b",
									label: "Glucose and oxygen",
									correct: true,
								},
								{
									value: "c",
									label: "Water and light energy",
									correct: false,
								},
								{
									value: "d",
									label: "Cellulose and starch",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "q2-photosynthesis-location",
			required: true,
			item: {
				id: "photosynthesis-q2",
				name: "Question 2",
				baseId: "photosynthesis-q2",
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
                <p><strong>Question 2: According to the passage, where in plant cells does photosynthesis primarily occur?</strong></p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "In the roots",
									correct: false,
								},
								{
									value: "b",
									label: "In the cell walls",
									correct: false,
								},
								{
									value: "c",
									label: "In the chloroplasts",
									correct: true,
								},
								{
									value: "d",
									label: "In the atmosphere",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "q3-photosynthesis-environment",
			required: true,
			item: {
				id: "photosynthesis-q3",
				name: "Question 3",
				baseId: "photosynthesis-q3",
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
							prompt: `<div>
                <p><strong>Question 3: What role do forests and oceans play in addressing modern environmental challenges, according to the passage?</strong></p>
              </div>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "They produce more oxygen than animals need",
									correct: false,
								},
								{
									value: "b",
									label:
										"They absorb excess carbon dioxide from human activities",
									correct: true,
								},
								{
									value: "c",
									label: "They prevent ancient bacteria from evolving",
									correct: false,
								},
								{
									value: "d",
									label: "They increase the temperature of Earth's atmosphere",
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
