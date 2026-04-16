import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

export const demo6Section: AssessmentSection = {
	identifier: "demo6-tabbed-layout",
	title: "Demo 6: Tabbed Layout",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "demo6-passage-main",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "demo6-passage-main",
				name: "Urban Trees and Heat",
				baseId: "demo6-passage-main",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Urban Trees and Heat</h2>
            <p>
              Cities are often warmer than nearby rural areas because concrete and asphalt
              absorb and store heat during the day. This effect is called an urban heat island.
              During summer evenings, these materials release stored heat slowly, which can keep
              neighborhoods uncomfortably warm.
            </p>
            <p>
              Planting trees can reduce heat stress in two ways. First, tree canopies block direct
              sunlight, lowering surface temperatures on sidewalks and buildings. Second, trees cool
              surrounding air through transpiration, a process where water evaporates from leaves.
              Studies in several U.S. cities show that shaded streets can be several degrees cooler
              than unshaded streets during peak afternoon heat.
            </p>
            <p>
              Urban planners caution that tree programs work best when paired with long-term care.
              Young trees need regular watering, and species should be selected for local climate,
              available space, and storm resilience. Without maintenance plans, many new plantings
              fail in the first few years.
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
			identifier: "demo6-q1",
			required: true,
			item: {
				id: "demo6-item-1",
				name: "Question 1",
				baseId: "demo6-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="demo6q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "demo6q1",
							element: "multiple-choice",
							prompt:
								"Which statement best explains the urban heat island effect described in the passage?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Rural areas receive less sunlight than cities",
									correct: false,
								},
								{
									value: "b",
									label:
										"City materials absorb and release heat more than natural ground cover",
									correct: true,
								},
								{
									value: "c",
									label: "City parks trap warm air below tree branches",
									correct: false,
								},
								{
									value: "d",
									label: "Most city buildings generate heat only during winter",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "demo6-q2",
			required: true,
			item: {
				id: "demo6-item-2",
				name: "Question 2",
				baseId: "demo6-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="demo6q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "demo6q2",
							element: "multiple-choice",
							prompt:
								"According to the passage, how do trees directly cool surrounding air?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "By reflecting heat back into the atmosphere",
									correct: false,
								},
								{
									value: "b",
									label: "By releasing cooler groundwater through roots",
									correct: false,
								},
								{
									value: "c",
									label: "Through transpiration from leaves",
									correct: true,
								},
								{
									value: "d",
									label: "Through increased nighttime wind speeds",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "demo6-q3",
			required: true,
			item: {
				id: "demo6-item-3",
				name: "Question 3",
				baseId: "demo6-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="demo6q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "demo6q3",
							element: "multiple-choice",
							prompt:
								"Which planning decision is emphasized as most important for tree programs to succeed?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Choosing fast-growing species even if they are not climate-adapted",
									correct: false,
								},
								{
									value: "b",
									label: "Planting as many trees as possible in one season",
									correct: false,
								},
								{
									value: "c",
									label: "Pairing new planting with maintenance and local fit",
									correct: true,
								},
								{
									value: "d",
									label: "Restricting trees to downtown commercial districts",
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
