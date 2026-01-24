import type {
	ItemEntity,
	PassageEntity,
} from "@pie-players/pie-players-shared";

export interface PieExample {
	id: string;
	name: string;
	description: string;
	item: Partial<ItemEntity>;
}

export interface PieElementGroup {
	id: string;
	name: string;
	description: string;
	examples: PieExample[];
}

export function getAllExamples(): PieExample[] {
	return PIE_ELEMENT_GROUPS.flatMap((group) => group.examples);
}

export function getExampleById(id: string): PieExample | undefined {
	// Prefer the example’s stable public id (used throughout the demo UI and assessment templates),
	// but fall back to item.id for compatibility with older call sites.
	return (
		getAllExamples().find((example) => example.id === id) ??
		getAllExamples().find((example) => example.item.id === id)
	);
}

export function getExampleItemById(
	id: string,
): Partial<ItemEntity> | undefined {
	const example = getExampleById(id);
	return example?.item;
}

const complexRubricExampleModel = {
	id: "abc1234",
	element: "pp-pie-element-complex-rubric",
	rubricType: "simpleRubric",
	rubrics: {
		simpleRubric: {
			points: [
				"<div>nothing right</div>",
				"<div>a teeny bit right</div>",
				"<div>mostly right</div>",
				"<div>bingo</div>",
			],
			sampleAnswers: [
				null,
				"<div>just right</div>",
				"<div>not left</div>",
				null,
			],
			maxPoints: 3,
			excludeZero: false,
			excludeZeroEnabled: true,
			maxPointsEnabled: true,
			errors: {},
		},
		multiTraitRubric: {
			addScaleEnabled: true,
			description: false,
			excludeZero: true,
			halfScoring: false,
			maxPointsEnabled: true,
			pointLabels: true,
			scales: [
				{
					maxPoints: 4,
					scorePointsLabels: [
						"<div>Non-Scorable</div>",
						"<div>Developing</div>",
						"<div>Progressing</div>",
						"<div>Effective</div>",
					],
					traitLabel: "Trait",
					traits: [
						{
							name: "<div>Ideas</div>",
							standards: [],
							description: "the main message",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>Topic undefined and/or difficult to followDetails are unclear</div>",
								"<div>Topic too broadDetails are limited</div>",
								"<div>Writing stays on topicComplete details given</div>",
							],
						},
						{
							name: "<div>Organization</div>",
							standards: [],
							description: "the internal structure of the piece",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>Does not have a beginning, middle and/or endDoes not have a lead and/or conclusionTransitions confusing and/or not presentNot written in logical orderNo sign of paragraphing / incorrect paragraphing</div>",
								"<div>Weak beginning, middle and endHas evidence of a lead and/or conclusion but missing elementsTransitions are used sometimesSome logical orderMost paragraphing incorrect</div>",
								"<div>Has an acceptable beginning, middle and endIncludes a lead and conclusionTransitions are used correctlyMostly logical orderMostly correct paragraphing</div>",
							],
						},
						{
							name: "<div>Word Choice</div>",
							standards: [],
							description: "the vocabulary a writer chooses to convey meaning",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>Vocabulary is limited/used incorrectlyNo figurative language; words do not convey meaning</div>",
								"<div>Generally correct wordsAttempt at figurative languageand/or words convey general meaning</div>",
								"<div>Some active verbs and precise nounsEffective use of figurative language and/or words that enhance meaning</div>",
							],
						},
						{
							name: "<div>Sentence Fluency</div>",
							standards: [],
							description: "the rhythm and flow of the language",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>No sentences are clearNo variety in sentence structureFrequent run-ons and/or fragments are present</div>",
								"<div>Some sentences are clearSentence variety used rarelySome run-ons and/or fragments are present</div>",
								"<div>Most sentences are clearSome sentence variety is usedRun-ons and/or fragments are rare</div>",
							],
						},
						{
							name: "<div>Conventions</div>",
							standards: [],
							description: "the mechanical correctness",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>Many distracting errors are present in grammar, punctuation, capitalization and/or spelling</div>",
								"<div>Errors in grammar, punctuation, capitalization and/or spelling are present and some distract from meaning</div>",
								"<div>Errors in grammar, punctuation, capitalization and/or spelling are present but don’t distract from meaning</div>",
							],
						},
						{
							name: "<div>Voice</div>",
							standards: [],
							description:
								"the personal tone and flavor of the author's message",
							scorePointsDescriptors: [
								"<div>Student’s response is blank, not in English, not legible, or does not respond to the prompt.</div>",
								"<div>Not concerned with audience or purposeNo viewpoint (perspective) usedWriting is mechanical and lifeless</div>",
								"<div>Shows beginning awareness of audience/purposeSome viewpoint (perspective) used throughout the pieceWriting is distant, too formal or informal</div>",
								"<div>Awareness of audience; purpose is clear most of the timeUses viewpoint (perspective) throughout most of the paperWriting is pleasant, agreeable and satisfying</div>",
							],
						},
					],
				},
				{
					maxPoints: 5,
					scorePointsLabels: [
						"<div>Non-Scorable</div>",
						"<div>Unsatisfactory</div>",
						"<div>Satisfactory</div>",
						"<div></div>",
						"<div></div>",
					],
					traitLabel: "Category",
					traits: [
						{
							name: "<div>Presentation</div>",
							standards: [],
							description: "",
							scorePointsDescriptors: [
								"<div>Handwriting is unreadable, or response is blank, not in English, or too brief to evaluate. </div>",
								"<div>Handwriting poorOverall appearance is distracting to unacceptable</div>",
								"<div>Handwriting is generally legibleOverall appearance is acceptable or better</div>",
								"<div></div>",
								"<div></div>",
							],
						},
					],
				},
			],
			standards: false,
			visible: true,
			visibleToStudent: true,
		},
		rubricless: {
			maxPoints: 100,
			excludeZero: false,
			rubriclessInstructionEnabled: true,
		},
	},
};

export const CATEGORIZE_DEMO: Partial<ItemEntity> = {
	id: "categorize_demo",
	name: "Categorize Demo",
	config: {
		elements: { "pp-pie-element-categorize": "@pie-element/categorize@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-categorize",
				promptEnabled: true,
				choices: [
					{
						id: "0",
						content:
							'<div><span data-latex="" data-raw="420\\text{ cm}=4.2\\text{ meters}">420\\text{ cm}=4.2\\text{ meters}</span></div>',
						categoryCount: 0,
						correctResponseCount: 1,
					},
					{
						id: "1",
						content:
							'<div><span data-latex="" data-raw="3.4\\text{ kg}=340\\text{ g}">3.4\\text{ kg}=340\\text{ g}</span></div>',
						categoryCount: 0,
						correctResponseCount: 1,
					},
					{
						id: "2",
						content:
							'<div><span data-latex="" data-raw="1\\text{,}800\\text{ mL}=180\\text{ L}">1\\text{,}800\\text{ mL}=180\\text{ L}</span></div>',
						categoryCount: 0,
						correctResponseCount: 0,
					},
					{
						id: "3",
						content:
							'<div><span data-latex="" data-raw="3.5\\text{ meters}=350\\text{ cm}">3.5\\text{ meters}=350\\text{ cm}</span></div>',
						categoryCount: 0,
						correctResponseCount: 1,
					},
					{
						id: "4",
						content:
							'<div><span data-latex="" data-raw="4\\text{,}800\\text{ g}=0.48\\text{ kg}">4\\text{,}800\\text{ g}=0.48\\text{ kg}</span></div>',
						categoryCount: 0,
						correctResponseCount: 1,
					},
					{
						id: "5",
						content:
							'<div><span data-latex="" data-raw="250\\text{ mL}=0.25\\text{ L}">250\\text{ mL}=0.25\\text{ L}</span></div>',
						categoryCount: 0,
						correctResponseCount: 0,
					},
				],
				categories: [
					{ id: "0", label: "<div>Equivalent</div>" },
					{ id: "1", label: "<div><b>NOT </b>equivalent</div>" },
				],
				rowLabels: ["<div></div>"],
				correctResponse: [
					{ category: "0", choices: ["0", "3"] },
					{ category: "1", choices: ["4", "1"] },
				],
				allowAlternateEnabled: true,
				allowMaxChoicesPerCategory: false,
				allowMultiplePlacementsEnabled: "Yes",
				alternates: [],
				categoriesPerRow: 2,
				choicesLabel: "",
				choicesPosition: "below",
				feedbackEnabled: false,
				lockChoiceOrder: true,
				maxAnswerChoices: 6,
				maxChoicesPerCategory: 0,
				partialScoring: true,
				rationaleEnabled: true,
				studentInstructionsEnabled: true,
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				minRowHeight: "80px",
				teacherInstructions: "<div></div>",
				prompt: "<div></div>",
				rationale: "<div></div>",
			},
		],
		markup: "<pp-pie-element-categorize id='1'></pp-pie-element-categorize>",
	},
};

export const DRAG_IN_THE_BLANK_DEMO: Partial<ItemEntity> = {
	id: "drag_in_the_blank_demo",
	name: "Drag In The Blank Demo",
	config: {
		elements: {
			"pp-pie-element-drag-in-the-blank":
				"@pie-element/drag-in-the-blank@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-drag-in-the-blank",
				markup: "{{0}} + {{1}} = 15",
				disabled: false,
				mode: "gather",
				prompt: "<p>Solve the equation below.</p>",
				promptEnabled: true,
				shuffle: true,
				choices: [
					{ value: "<div>6</div>", id: "0" },
					{ value: "<div>9</div>", id: "1" },
				],
				choicesPosition: "below",
				correctResponse: { "0": "0", "1": "1" },
				duplicates: true,
				alternateResponses: [["1"], ["0"]],
				rationale:
					"<p>A correct response is shown below:</p><ul><li>2/6 = 1/3</li><li>4/8 = 1/2</li><li>6/10 = 3/5</li><li>9/12 = 3/4</li></ul>",
			},
		],
		markup:
			"<pp-pie-element-drag-in-the-blank id='1'></pp-pie-element-drag-in-the-blank>",
	},
};

export const DRAWING_RESPONSE_DEMO: Partial<ItemEntity> = {
	id: "drawing_response_demo_1",
	name: "Drawing Response Demo",
	config: {
		elements: {
			"pp-pie-element-drawing-response": "@pie-element/drawing-response@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-drawing-response",
				backgroundImageEnabled: true,
				imageDimensions: { height: 0, width: 0 },
				imageUrl: "",
				prompt: "",
				promptEnabled: true,
				spellCheckEnabled: true,
				studentInstructionsEnabled: true,
				teacherInstructions: "",
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
			},
		],
		markup:
			"<pp-pie-element-drawing-response id='1'></pp-pie-element-drawing-response>",
	},
};

export const EXPLICIT_CONSTRUCTED_RESPONSE_DEMO: Partial<ItemEntity> = {
	id: "explicit_constructed_response_demo",
	name: "Explicit Constructed Response Demo",
	config: {
		elements: {
			"pp-pie-element-explicit-constructed-response":
				"@pie-element/explicit-constructed-response@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-explicit-constructed-response",
				markup: "<p>The {{0}} jumped {{1}} the {{2}}</p>",
				disabled: false,
				choices: {
					"0": [
						{ label: "cow", value: "0" },
						{ label: "cattle", value: "1" },
						{ label: "calf", value: "2" },
					],
					"1": [
						{ label: "over", value: "0" },
						{ label: "past", value: "1" },
						{ label: "beyond", value: "2" },
					],
					"2": [{ label: "moon", value: "0" }],
				},
				prompt: "<div>Complete the sentence</div>",
				promptEnabled: true,
				displayType: "block",
				maxLengthPerChoiceEnabled: true,
				playerSpellCheckEnabled: true,
				rationale: "<div></div>",
				rationaleEnabled: true,
				spellCheckEnabled: true,
				studentInstructionsEnabled: true,
				teacherInstructions: "<div></div>",
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				responseAreaInputConfiguration: { characters: { disabled: true } },
				slateMarkup:
					'<p>The <span data-type="explicit_constructed_response" data-index="0" data-value="cow"></span> jumped <span data-type="explicit_constructed_response" data-index="1" data-value="over"></span> the <span data-type="explicit_constructed_response" data-index="2" data-value="moon"></span></p>',
				maxLengthPerChoice: [10, 10, 7],
			},
		],
		markup:
			"<pp-pie-element-explicit-constructed-response id='1'></pp-pie-element-explicit-constructed-response>",
	},
};

export const EQUATION_RESPONSE_DEMO: Partial<ItemEntity> = {
	id: "equation_response_demo",
	name: "Equation Response Demo",
	config: {
		elements: {
			"pp-pie-element-math-inline": "@pie-element/math-inline@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-math-inline",
				customKeys: [
					"<",
					"\\le",
					"\\ge",
					">",
					"\\frac{}{}",
					"x^{}",
					"\\left(\\right)",
					"\\abs{}",
					"\\sqrt{}",
					"\\sqrt[n]{}",
					"\\pi",
					"\\iota",
					"\\sin",
					"\\cos",
					"\\tan",
					"\\arcsin",
					"\\arccos",
					"\\arctan",
					"r",
					"V_uppercase",
					"\\fract",
				],
				equationEditor: "geometry",
				responseType: "Advanced Multi",
				expression: "{{response}}",
				responses: [
					{
						allowSpaces: true,
						answer: "r=\\sqrt{\\frac{V}{7\\pi}}",
						id: "1",
						alternates: {},
						validation: "symbolic",
						allowTrailingZeros: false,
						ignoreOrder: false,
					},
				],
				rationale:
					'<p>The correct answer is:</p><ul><li><span data-type="mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>r</mi><mo>=</mo><msqrt><mfrac><mi>V</mi><mrow><mn>7</mn><mi>π</mi></mrow></mfrac></msqrt></math></span></li></ul>',
				allowTrailingZerosDefault: false,
				feedback: {
					correct: { default: "Correct", type: "none" },
					incorrect: { default: "Incorrect", type: "none" },
					partial: { default: "Nearly", type: "none" },
				},
				feedbackEnabled: false,
				ignoreOrderDefault: false,
				partialScoring: true,
				prompt: "<div></div>",
				promptEnabled: true,
				rationaleEnabled: true,
				scoringType: "auto",
				studentInstructionsEnabled: true,
				teacherInstructions: "<div></div>",
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				validationDefault: "literal",
			},
		],
		markup: "<pp-pie-element-math-inline id='1'></pp-pie-element-math-inline>",
	},
};

export const INLINE_DROPDOWN_DEMO: Partial<ItemEntity> = {
	id: "inline_dropdown_demo",
	name: "Inline Dropdown Demo",
	config: {
		elements: {
			"pp-pie-element-inline-dropdown": "@pie-element/inline-dropdown@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-inline-dropdown",
				disabled: false,
				mode: "gather",
				prompt: "<div>Use the dropdowns to complete the sentence</div>",
				promptEnabled: true,
				shuffle: true,
				markup: "<div><p>The {{0}} jumped {{1}} the {{2}}</p></div>",
				choices: {
					"0": [
						{
							label: "cow ",
							value: "0",
							correct: true,
							rationale: "<div></div>",
						},
						{
							label: "dog ",
							value: "1",
							correct: false,
							rationale: "<div></div>",
						},
						{
							label: "cat ",
							value: "2",
							correct: false,
							rationale: "<div></div>",
						},
					],
					"1": [
						{
							label: "over ",
							value: "0",
							correct: true,
							rationale: "<div></div>",
						},
						{
							label: "under ",
							value: "1",
							correct: false,
							rationale: "<div></div>",
						},
						{
							label: "across ",
							value: "2",
							correct: false,
							rationale: "<div></div>",
						},
					],
					"2": [
						{
							label: "moon ",
							value: "0",
							correct: true,
							rationale: "<div></div>",
						},
						{
							label: "sun",
							value: "2",
							correct: false,
							rationale: "<div></div>",
						},
						{
							label: "house ",
							value: "3",
							correct: false,
							rationale: "<div></div>",
						},
					],
				},
				choiceRationaleEnabled: true,
				displayType: "block",
				rationale: "<div></div>",
				rationaleEnabled: true,
				studentInstructionsEnabled: true,
				teacherInstructions: "<div></div>",
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				slateMarkup:
					'<div><p>The <span data-type="inline_dropdown" data-index="0" data-value="cow "></span> jumped <span data-type="inline_dropdown" data-index="1" data-value="over "></span> the <span data-type="inline_dropdown" data-index="2" data-value="moon "></span></p></div>',
			},
		],
		markup:
			"<pp-pie-element-inline-dropdown id='1'></pp-pie-element-inline-dropdown>",
	},
};

export const MULTIPLE_CHOICE_BASIC: Partial<ItemEntity> = {
	id: "multiple_choice_demo",
	name: "Multiple Choice Demo",
	config: {
		markup: '<multiple-choice-element id="Q124"></multiple-choice-element>',
		elements: {
			"multiple-choice-element": "@pie-element/multiple-choice@latest",
		},
		models: [
			{
				id: "Q124",
				element: "multiple-choice-element",
				prompt: "What is the capital of France?",
				choicePrefix: "letters",
				scoringType: "auto",
				lockChoiceOrder: false,
				partialScoring: true,
				choices: [
					{ value: "A", label: "London", correct: false },
					{ value: "B", label: "Paris", correct: true },
					{ value: "C", label: "Berlin", correct: false },
					{ value: "D", label: "Rome", correct: false },
				],
				choiceMode: "radio",
				promptEnabled: true,
				rationaleEnabled: true,
				teacherInstructionsEnabled: true,
				studentInstructionsEnabled: true,
			},
		],
		id: "",
	},
};

export const MULTIPLE_CHOICE_MULTI: Partial<ItemEntity> = {
	id: "multiple_choice_multi_demo",
	name: "Multiple Choice Multi Demo",
	config: {
		markup: '<multiple-choice-element id="Q125"></multiple-choice-element>',
		elements: {
			"multiple-choice-element": "@pie-element/multiple-choice@latest",
		},
		models: [
			{
				id: "Q125",
				element: "multiple-choice-element",
				prompt: "Select all planets in our solar system:",
				choicePrefix: "letters",
				scoringType: "auto",
				lockChoiceOrder: false,
				partialScoring: true,
				choices: [
					{ value: "A", label: "Earth", correct: true },
					{ value: "B", label: "Mars", correct: true },
					{ value: "C", label: "Moon", correct: false },
					{ value: "D", label: "Jupiter", correct: true },
					{ value: "E", label: "Pluto", correct: false },
				],
				choiceMode: "checkbox",
				promptEnabled: true,
				rationaleEnabled: true,
				teacherInstructionsEnabled: true,
				studentInstructionsEnabled: true,
			},
		],
		id: "",
	},
};

export const TRUE_FALSE_EXAMPLE: Partial<ItemEntity> = {
	id: "true_false_demo",
	name: "True/ False Demo",
	config: {
		markup:
			'<multiple-choice-element--version-latest id="TF1"></multiple-choice-element--version-latest>',
		elements: {
			"multiple-choice-element--version-latest":
				"@pie-element/multiple-choice@latest",
		},
		models: [
			{
				lockChoiceOrder: false,
				partialScoring: false,
				scoringType: "auto",
				id: "TF1",
				choicePrefix: "letters",
				choices: [
					{
						correct: false,
						label: "<p>True.</p>",
						value: "option1",
					},
					{
						correct: true,
						label: "<p>False.</p>",
						value: "option2",
					},
				],
				choiceMode: "radio",
				prompt:
					"<p>The Dutch wanted their independence from Spain because the Dutch were Catholic and Spain was Protestant.</p>",
				studentInstructions: false,
				element: "multiple-choice-element--version-latest",
			},
		],
		id: "",
	},
};

export const NUMBER_LINE_DEMO: Partial<ItemEntity> = {
	id: "number_line_demo",
	name: "Number Line Demo",
	config: {
		elements: {
			"pp-pie-element-number-line": "@pie-element/number-line@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-number-line",
				correctResponse: [
					{ type: "point", pointType: "full", domainPosition: 1 },
					{
						type: "line",
						leftPoint: "full",
						rightPoint: "empty",
						domainPosition: 1,
						size: 2,
					},
				],
				feedback: {
					correct: { type: "default", default: "Correct" },
					partial: { type: "default", default: "Nearly" },
					incorrect: { type: "custom", custom: "<h1>Incorrect</h1>" },
				},
				prompt: "Set correct answer.",
				graph: {
					title: 'This is the title <span data-latex="">\\frac{1}{2}</span>',
					arrows: { left: true, right: true },
					width: 500,
					height: 400,
					domain: { min: -5, max: 5 },
					ticks: {
						minor: 1,
						major: 2,
						tickIntervalType: "Integer",
						integerTick: 1,
						decimalTick: 0.2,
						fractionTick: "1/5",
					},
					initialElements: [],
					maxNumberOfPoints: 20,
					showMinorTicks: true,
					snapPerTick: 1,
					tickLabelOverrides: [],
					initialType: "PF",
					exhibitOnly: false,
					availableTypes: {
						PF: true,
						LFF: true,
						LEF: true,
						LFE: true,
						LEE: true,
						RFN: true,
						RFP: true,
						REN: true,
						REP: true,
					},
				},
				promptEnabled: true,
				rationale: "",
				rationaleEnabled: true,
				teacherInstructions: "",
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				widthEnabled: true,
				language: "",
				titleEnabled: true,
			},
		],
		markup: "<pp-pie-element-number-line id='1'></pp-pie-element-number-line>",
	},
};

export const SELECT_TEXT_DEMO: Partial<ItemEntity> = {
	id: "select_text_demo",
	name: "Select Text Demo",
	config: {
		elements: {
			"pp-pie-element-select-text": "@pie-element/select-text@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-select-text",
				highlightChoices: true,
				feedback: {
					correct: { type: "default", default: "Correct" },
					incorrect: { type: "default", default: "Incorrect" },
					partial: { type: "default", default: "Nearly" },
				},
				partialScoring: true,
				maxSelections: 2,
				mode: "sentence",
				rationale: "Rationale goes here.",
				prompt: "What sentences contain the character 6 in them?",
				promptEnabled: true,
				text: "Rachel cut out 8 stars in 6 minutes. Lovelle cut out 6 stars in 4 minutes. Rachel cut out 4 more stars than Lovelle. Lovelle and Rachel cut the same number of stars in 6 minutes.",
				tokens: [
					{
						text: "Rachel cut out 8 stars in 6 minutes.",
						start: 0,
						end: 36,
						correct: true,
					},
					{
						text: "Lovelle cut out 6 stars in 4 minutes.",
						start: 37,
						end: 74,
						correct: true,
					},
					{
						text: "Lovelle and Rachel cut the same number of stars in 6 minutes.",
						start: 117,
						end: 177,
					},
				],
			},
		],
		markup: "<pp-pie-element-select-text id='1'></pp-pie-element-select-text>",
	},
};

export const EXTENDED_TEXT_DEMO: Partial<ItemEntity> = {
	id: "extended_text_demo",
	name: "Extended Text Demo",
	config: {
		elements: {
			"pp-pie-element-extended-text-entry":
				"@pie-element/extended-text-entry@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-extended-text-entry",
				feedback: { type: "default", default: "this is default feedback" },
				prompt: "This is the question prompt",
				promptEnabled: true,
				mathInput: false,
			},
		],
		markup:
			"<pp-pie-element-extended-text-entry id='1'></pp-pie-element-extended-text-entry>",
	},
};

export const MATCH_DEMO: Partial<ItemEntity> = {
	id: "match_demo",
	name: "Match Demo",
	config: {
		elements: { "pp-pie-element-match": "@pie-element/match@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-match",
				enableImages: true,
				feedback: {
					correct: { type: "none", default: "Correct" },
					partial: { type: "none", default: "Nearly" },
					incorrect: { type: "none", default: "Incorrect" },
				},
				headers: ["Column 1", "Column 2", "Column 3"],
				layout: 3,
				lockChoiceOrder: true,
				partialScoring: true,
				choiceMode: "radio",
				rows: [
					{ id: 1, title: "Question Text 1", values: [false, false] },
					{ id: 2, title: "Question Text 2", values: [false, false] },
					{ id: 3, title: "Question Text 3", values: [false, false] },
					{ id: 4, title: "Question Text 4", values: [false, false] },
				],
				promptEnabled: true,
				prompt: "Select correct answers.",
			},
		],
		markup: "<pp-pie-element-match id='1'></pp-pie-element-match>",
	},
};

export const MATCH_LIST: Partial<ItemEntity> = {
	id: "match_list_demo",
	name: "Match List Demo",
	config: {
		elements: { "pp-pie-element-match-list": "@pie-element/match-list@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-match-list",
				lockChoiceOrder: true,
				answers: [
					{ id: 2, title: "Battle of Lexington and Concord" },
					{ id: 3, title: "Declaration of Independence" },
					{ id: 1, title: "Boston Tea Party" },
					{ id: 0, title: "French and Indian War" },
					{ id: 4, title: "Constitutional Convention" },
				],
				prompt:
					"<p>Match each year to the corresponding historical event. Drag and drop the events.</p>",
				prompts: [
					{ id: 1, title: "1754", relatedAnswer: 0 },
					{ id: 2, title: "1773", relatedAnswer: 1 },
					{ id: 3, title: "1775", relatedAnswer: 2 },
					{ id: 4, title: "1776", relatedAnswer: 3 },
					{ id: 5, title: "1787", relatedAnswer: 4 },
				],
			},
		],
		markup: "<pp-pie-element-match-list id='1'></pp-pie-element-match-list>",
	},
};

export const PLACEMENT_ORDERING_DEMO: Partial<ItemEntity> = {
	id: "placement_ordering_demo",
	name: "Placement Ordering Demo",
	config: {
		elements: {
			"pp-pie-element-placement-ordering":
				"@pie-element/placement-ordering@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-placement-ordering",
				choiceLabel: "Choices",
				choices: [
					{ id: "c1", label: "Blueberry" },
					{ id: "c2", label: "Lemon" },
					{ id: "c3", label: "Melon" },
					{ id: "c4", label: "Pear" },
				],
				correctResponse: ["c1", "c2", "c3", "c4"],
				alternateResponses: [{ response: ["c4", "c3", "c2", "c1"] }],
				enableImages: false,
				feedback: {
					correct: { type: "custom", custom: "foo" },
					incorrect: { type: "custom", custom: "no" },
					partial: { type: "custom", custom: "nearly" },
				},
				feedbackEnabled: true,
				prompt: "Arrange the fruits alphabetically",
				promptEnabled: true,
				lockChoiceOrder: false,
				numberedGuides: false,
				orientation: "vertical",
				partialScoring: true,
				placementArea: false,
				scoringType: "auto",
				targetLabel: "Answers",
			},
		],
		markup:
			"<pp-pie-element-placement-ordering id='1'></pp-pie-element-placement-ordering>",
	},
};

export const EBSR_DEMO: Partial<ItemEntity> = {
	id: "ebsr_demo",
	name: "EBSR Demo",
	config: {
		elements: { "pp-pie-element-ebsr": "@pie-element/ebsr@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-ebsr",
				partA: {
					choiceMode: "radio",
					choicePrefix: "numbers",
					choices: [
						{ value: "yellow", label: "Yellow", hideTick: false },
						{ value: "green", label: "Green", hideTick: false },
						{ correct: true, value: "blue", label: "Blue", hideTick: false },
					],
					choicesLayout: "vertical",
					feedbackEnabled: false,
					gridColumns: 2,
					prompt: "What color is the sky?",
					promptEnabled: true,
					rationale: "",
					rationaleEnabled: true,
					spellCheckEnabled: true,
					studentInstructionsEnabled: true,
					teacherInstructionsEnabled: true,
					toolbarEditorPosition: "bottom",
					errors: {},
					partialScoring: true,
					showTeacherInstructions: false,
					alwaysShowCorrect: false,
					mode: "gather",
					disabled: true,
					animationsDisabled: true,
					lockChoiceOrder: true,
					keyMode: "numbers",
				},
				partB: {
					choiceMode: "radio",
					choicePrefix: "numbers",
					choices: [
						{ value: "orange", label: "Orange", hideTick: false },
						{
							correct: true,
							value: "purple",
							label: "Purple",
							hideTick: false,
						},
						{ value: "pink", label: "Pink", hideTick: false },
						{ value: "green", label: "Green", hideTick: false },
					],
					choicesLayout: "vertical",
					feedbackEnabled: false,
					gridColumns: 2,
					prompt:
						"What color do you get when you mix Red with your answer in Part 1?",
					promptEnabled: true,
					rationale: "",
					rationaleEnabled: true,
					spellCheckEnabled: true,
					studentInstructionsEnabled: true,
					teacherInstructionsEnabled: true,
					toolbarEditorPosition: "bottom",
					errors: {},
					partialScoring: true,
					showTeacherInstructions: false,
					alwaysShowCorrect: false,
					mode: "gather",
					disabled: true,
					animationsDisabled: true,
					lockChoiceOrder: true,
					keyMode: "numbers",
				},
				partLabels: true,
				partLabelType: "Letters",
			},
		],
		markup: "<pp-pie-element-ebsr id='1'></pp-pie-element-ebsr>",
	},
};

export const HOTSPOT_DEMO: Partial<ItemEntity> = {
	id: "hotspot_demo",
	name: "Hotspot Demo",
	config: {
		elements: { "pp-pie-element-hotspot": "@pie-element/hotspot@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-hotspot",
				disabled: false,
				mode: "gather",
				dimensions: { height: 500, width: 700 },
				imageUrl:
					"data:image/png;base64,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",
				hotspotColor: "rgba(137, 183, 244, 0.25)",
				hotspotList: [
					"rgba(137, 183, 244, 0.25)",
					"rgba(217, 30, 24, 0.25)",
					"rgba(254, 241, 96, 0.25)",
					"rgba(0, 0, 0, 0.1)",
				],
				outlineColor: "blue",
				outlineList: ["blue", "red", "yellow"],
				multipleCorrect: true,
				shapes: {
					rectangles: [
						{ id: "3", height: 64, width: 79, x: 261, y: 44, correct: true },
						{
							id: "4",
							height: 52.00000000000001,
							width: 89.63638305664061,
							x: 270,
							y: 215.4886474609375,
							correct: false,
						},
					],
					polygons: [
						{
							id: "2",
							points: [
								{ x: 21, y: 121 },
								{ x: 10, y: 149 },
								{ x: 12, y: 178 },
								{ x: 21, y: 226 },
								{ x: 30, y: 265 },
								{ x: 55, y: 287 },
								{ x: 65, y: 299 },
								{ x: 66, y: 316 },
								{ x: 101, y: 321 },
								{ x: 109, y: 294 },
								{ x: 106, y: 280 },
								{ x: 56, y: 193 },
								{ x: 68, y: 139 },
							],
							correct: false,
						},
						{
							id: "5",
							points: [
								{ x: 460, y: 371 },
								{ x: 461, y: 388 },
								{ x: 478, y: 384 },
								{ x: 498, y: 394 },
								{ x: 512, y: 383 },
								{ x: 529, y: 399 },
								{ x: 534, y: 428 },
								{ x: 564, y: 465 },
								{ x: 575, y: 461 },
								{ x: 575, y: 438 },
								{ x: 544, y: 367 },
							],
							correct: false,
						},
						{
							id: "7",
							points: [
								{ x: 530, y: 261 },
								{ x: 498, y: 292 },
								{ x: 556, y: 287 },
								{ x: 575, y: 302 },
								{ x: 601, y: 280 },
								{ x: 598, y: 246 },
							],
							correct: true,
						},
					],
					circles: [
						{
							id: "1",
							radius: 74.51845409024533,
							x: 71,
							y: 420,
							correct: false,
						},
						{
							id: "6",
							radius: 41.72529209005013,
							x: 479,
							y: 140,
							correct: false,
						},
					],
				},
				rationale: null,
				teacherInstructions: null,
				prompt: '<div>Which state(s) have names beginning in "North"?</div>',
				partialScoring: true,
				promptEnabled: true,
				rationaleEnabled: true,
				strokeWidth: 5,
				studentInstructionsEnabled: true,
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
			},
		],
		markup: "<pp-pie-element-hotspot id='1'></pp-pie-element-hotspot>",
	},
};

export const CHARTING_DEMO: Partial<ItemEntity> = {
	id: "charting_demo",
	name: "Charting Demo",
	config: {
		elements: { "pp-pie-element-charting": "@pie-element/charting@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-charting",
				promptEnabled: true,
				chartType: "bar",
				data: [
					{ label: "a", value: 1, interactive: true },
					{ label: "b", value: 0, interactive: true },
				],
				addCategoryEnabled: true,
				changeAddCategoryEnabled: false,
				changeEditableEnabled: false,
				changeInteractiveEnabled: false,
				correctAnswer: {
					data: [
						{ label: "a", value: 1 },
						{ label: "b", value: 0 },
					],
				},
				domain: {},
				graph: { width: 480, height: 480 },
				prompt: "",
				range: { label: "", max: 1, min: 0, labelStep: 0.05, step: 0.05 },
				rationale: "",
				rationaleEnabled: true,
				scoringType: "all or nothing",
				studentInstructionsEnabled: true,
				studentNewCategoryDefaultLabel: "New Category",
				teacherInstructions: "",
				teacherInstructionsEnabled: true,
				title: "",
			},
		],
		markup: "<pp-pie-element-charting id='1'></pp-pie-element-charting>",
	},
};

export const GRAPHING_DEMO: Partial<ItemEntity> = {
	id: "graphing_demo",
	name: "Graphing Demo",
	config: {
		elements: { "pp-pie-element-graphing": "@pie-element/graphing@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-graphing",
				promptEnabled: true,
				domain: { min: -10, max: 10, step: 1, labelStep: 0 },
				range: { min: -10, max: 10, step: 1, labelStep: 0 },
				backgroundMarks: [{ type: "point", x: 2, y: 2 }],
				answers: { correctAnswer: { name: "Correct Answer", marks: [] } },
				arrows: { left: true, right: true, up: true, down: true },
				coordinatesOnHover: false,
				defaultGridConfiguration: 0,
				graph: { width: 500, height: 500 },
				includeAxes: true,
				labels: {},
				labelsEnabled: true,
				padding: true,
				prompt: "",
				rationale: "",
				rationaleEnabled: true,
				standardGrid: false,
				studentInstructionsEnabled: true,
				teacherInstructions: "",
				teacherInstructionsEnabled: true,
				title: "",
				titleEnabled: true,
				toolbarTools: [
					"circle",
					"line",
					"label",
					"parabola",
					"point",
					"polygon",
					"ray",
					"segment",
					"sine",
					"vector",
				],
				defaultTool: "circle",
				dimensionsEnabled: true,
			},
		],
		markup: "<pp-pie-element-graphing id='1'></pp-pie-element-graphing>",
	},
};

export const MATH_TEMPLATED_DEMO: Partial<ItemEntity> = {
	id: "math_templated_demo",
	name: "Math Templated Demo",
	config: {
		elements: {
			"pp-pie-element-math-templated": "@pie-element/math-templated@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-math-templated",
				rationale: "Rationale",
				partialScoring: true,
				prompt:
					"There are 24 students in the class. They had the choice to buy supplies from two different stores, Store A and B. Each of them bought 2 binders and 5 notebooks. The students have a total of $420 to spend.",
				scoringType: "auto",
				feedbackEnabled: false,
				promptEnabled: true,
				rationaleEnabled: true,
				teacherInstructionsEnabled: true,
				studentInstructionsEnabled: true,
				toolbarEditorPosition: "bottom",
				validationDefault: "literal",
				ignoreOrderDefault: false,
				allowTrailingZerosDefault: false,
				teacherInstructions: "These are teacher instructions",
				customKeys: [],
				equationEditor: "geometry",
				markup:
					"<p>If the unit price of a notebook in Store A is $1.50, what is the unit price of a binder? \\" +
					"$" +
					"{{0}}</p><p>If the unit price of a binder in Store B is $2.80, what is the unit price of a notebook? \\" +
					"$" +
					"{{1}}</p>",
				responses: {
					"0": {
						allowTrailingZeros: false,
						answer: "5",
						id: "1",
						validation: "symbolic",
						ignoreOrder: false,
					},
					"1": {
						allowTrailingZeros: false,
						answer: "2.38",
						id: "2",
						validation: "literal",
						ignoreOrder: false,
					},
				},
				playerSpellCheckEnabled: true,
				spellCheckEnabled: true,
				slateMarkup:
					'<p>If the unit price of a notebook in Store A is $1.50, what is the unit price of a binder? \\$<span data-type="math_templated" data-index="0" data-value="5"></span></p><p>If the unit price of a binder in Store B is $2.80, what is the unit price of a notebook? \\$<span data-type="math_templated" data-index="1" data-value="2.38"></span></p>',
			},
		],
		markup:
			"<pp-pie-element-math-templated id='1'></pp-pie-element-math-templated>",
	},
};

export const PASSAGE_DEMO: Partial<ItemEntity> = {
	id: "passage_demo",
	name: "Passage Demo",
	configuration: {
		baseInputConfiguration: {
			audio: { disabled: false },
			video: { disabled: false },
			image: { disabled: false },
			h3: { disabled: true },
			blockquote: { disabled: true },
			textAlign: { disabled: true },
			showParagraphs: { disabled: false },
			separateParagraphs: { disabled: true },
		},
		settingsPanelDisabled: false,
		title: {
			settings: true,
			label: "Title",
			inputConfiguration: {
				audio: { disabled: true },
				video: { disabled: true },
				image: { disabled: true },
				textAlign: { disabled: false },
			},
			required: true,
		},
		subtitle: {
			settings: true,
			label: "Subtitle",
			inputConfiguration: {
				audio: { disabled: true },
				video: { disabled: true },
				image: { disabled: true },
				textAlign: { disabled: false },
			},
			required: true,
		},
		author: {
			settings: true,
			label: "Author",
			inputConfiguration: {
				audio: { disabled: true },
				video: { disabled: true },
				image: { disabled: true },
			},
			required: false,
		},
		text: {
			settings: true,
			label: "Text",
			inputConfiguration: {
				audio: { disabled: false },
				video: { disabled: false },
				image: { disabled: false },
				h3: { disabled: false },
				blockquote: { disabled: false },
				textAlign: { disabled: false },
			},
			required: true,
		},
		teacherInstructions: {
			settings: true,
			label: "Teacher Instructions",
			inputConfiguration: {
				audio: { disabled: false },
				video: { disabled: false },
				image: { disabled: false },
			},
			required: false,
		},
	},
	config: {
		elements: { "pp-pie-element-passage": "@pie-element/passage@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-passage",
				passages: [
					{
						teacherInstructions: "Teacher instructions tab 1",
						title: "Hope Is the Thing with Feathers",
						text: '<p><font style="visibility:hidden">00000</font>Hope is the thing with feathers<br /><font style="visibility:hidden">00000</font>That perches in the soul,<br /><font style="visibility:hidden">00000</font>And sings the tune without the words,<br /><font style="visibility:hidden">00000</font>And never stops at all,</p><p>5<font style="visibility:hidden">0000</font>And sweetest in the gale is heard;<br /><font style="visibility:hidden">00000</font>And sore must be the storm<br /><font style="visibility:hidden">00000</font>That could abash the little bird<br /><font style="visibility:hidden">00000</font>That kept so many warm.</p><p><font style="visibility:hidden">00000</font>I&#8217;ve heard it in the chillest land,<br />10<font style="visibility:hidden">000</font>And on the strangest sea;<br /><font style="visibility:hidden">00000</font>Yet, never, in extremity,<br /><font style="visibility:hidden">00000</font>It asked a crumb of me.</p><p><span class="no-number">&#34;Hope is the Thing With Feathers&#34; by Emily Dickinson, from <em>The Complete Poems of Emily Dickinson</em>. In the public domain.</span></p>',
					},
					{
						title: "Ineskeen Road, July Evening",
						text: "The bicycles go by in twos and threes -<br/>There's a dance in Billy Brennan's barn tonight,<br/>And there's the half-talk code of mysteries<br/>And the wink-and-elbow language of delight.<br/>Half-past eight and there is not a spot<br/>Upon a mile of road, no shadow thrown<br/>That might turn out a man or woman, not<br/>A footfall tapping secrecies of stone. <br/><p/>",
					},
				],
			},
		],
		markup: "<pp-pie-element-passage id='1'></pp-pie-element-passage>",
	},
};

export const IMAGE_DRAG_AND_DROP_DEMO: Partial<ItemEntity> = {
	id: "image_drag_and_drop_demo",
	name: "Image Drag And Drop Demo",
	config: {
		elements: {
			"pp-pie-element-image-cloze-association":
				"@pie-element/image-cloze-association@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-image-cloze-association",
				prompt: "This is the question prompt",
				promptEnabled: true,
				disabled: false,
				imageUrl:
					"https://app.fluence.net/ia/image/6412223997a34018b15f8512bee6c04c",
				image: {
					src: "https://app.fluence.net/ia/image/6412223997a34018b15f8512bee6c04c",
					width: 465,
					scale: false,
					height: 313,
				},
				response_container: { wordwrap: true, width: "130px", height: "55px" },
				metadata: {},
				is_math: true,
				response_id: "8a808081592940240159464a277609e7",
				response_containers: [
					{
						pointer: "undefined",
						wordwrap: true,
						x: 64.3,
						width: "35.70%",
						y: 1.6,
						height: "23.64%",
						aria_label: "",
					},
					{
						pointer: "undefined",
						wordwrap: true,
						x: 64.09,
						width: "35.92%",
						y: 39.62,
						height: "23.32%",
						aria_label: "",
					},
				],
				stimulus:
					"<p>A car manufacturer proposes the development of a car tire disposal area near an important wetland habitat. In this area, tires will be broken into pieces and buried. The manufacturer needs to design this area to address the environmental concerns from the list in the passage. After breaking the tires into pieces, the manufacturer decides to recycle some of the pieces and dispose of the rest in this newly developed area. Drag and drop the data labels into the graph to show how this decision will likely affect the number of tire pieces collected from a sample area of the wetland after many years.</p>\n",
				metadatadistractor_rationale:
					'<p>A correct response is shown below.&#160;This response best shows how this decision will likely affect the number tire pieces collected.<img alt="image 03de38019abe41b1bc95d1199658327f" id="03de38019abe41b1bc95d1199658327f" src="https://localhost:8443/ia/image/03de38019abe41b1bc95d1199658327f" /></p>\n',
				ui_style: { possibility_list_position: "bottom", fontsize: "small" },
				possible_responses: [
					"<img alt='' src='https://app.fluence.net/ia/image/9e5ed1d6762c4dac87b080e190af113d'/>",
					"<img alt='' src='https://app.fluence.net/ia/image/729ca157d04c440ab7ae1c2abfb9c057'/>",
				],
				validation: {
					scoring_type: "exactMatch",
					valid_response: {
						score: 1,
						value: [
							{
								images: [
									"<img alt='' src='https://app.fluence.net/ia/image/729ca157d04c440ab7ae1c2abfb9c057'/>",
								],
							},
							{
								images: [
									"<img alt='' src='https://app.fluence.net/ia/image/9e5ed1d6762c4dac87b080e190af113d'/>",
								],
							},
						],
					},
				},
				showDashedBorder: false,
				partialScoring: true,
				shuffle: true,
				rubricEnabled: false,
			},
		],
		markup:
			"<pp-pie-element-image-cloze-association id='1'></pp-pie-element-image-cloze-association>",
	},
};

export const FRACTION_MODEL_DEMO: Partial<ItemEntity> = {
	id: "fraction_model_demo",
	name: "Fraction Model Demo",
	config: {
		elements: {
			"pp-pie-element-fraction-model": "@pie-element/fraction-model@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-fraction-model",
				title: "Title",
				question: "Custom question",
			},
		],
		markup:
			"<pp-pie-element-fraction-model id='1'></pp-pie-element-fraction-model>",
	},
};

export const GRAPHING_SOLUTION_SET_DEMO: Partial<ItemEntity> = {
	id: "graphing_solution_set_demo",
	name: "Graphing Solution Set Demo",
	config: {
		elements: {
			"pp-pie-element-graphing-solution-set":
				"@pie-element/graphing-solution-set@latest",
		},
		models: [
			{
				id: "1",
				element: "pp-pie-element-graphing-solution-set",
				answers: { correctAnswer: { name: "Correct Answer", marks: [] } },
				arrows: { left: true, right: true, up: true, down: true },
				marks: [],
				defaultGridConfiguration: 0,
				domain: {
					min: -10,
					max: 10,
					padding: 0,
					step: 1,
					labelStep: 1,
					axisLabel: "x",
				},
				graph: { width: 480, height: 480 },
				gssLineData: {
					numberOfLines: 1,
					selectedTool: "lineA",
					sections: [],
					lineA: { lineType: "Solid" },
				},
				includeAxes: true,
				labels: { top: "top", left: "left", bottom: "bottom", right: "right" },
				labelsEnabled: true,
				padding: true,
				prompt: "Prompt goes here",
				range: {
					min: -10,
					max: 10,
					padding: 0,
					step: 1,
					labelStep: 1,
					axisLabel: "y",
				},
				rationale: "Rationale goes here",
				standardGrid: true,
				title: "Graph title",
				coordinatesOnHover: false,
				promptEnabled: true,
				rationaleEnabled: true,
				teacherInstructionsEnabled: true,
				studentInstructionsEnabled: true,
				rubricEnabled: false,
				language: "en_US",
				titleEnabled: true,
				dimensionsEnabled: true,
			},
		],
		markup:
			"<pp-pie-element-graphing-solution-set id='1'></pp-pie-element-graphing-solution-set>",
	},
};

export const CALCULATOR_TOOL_DEMO: Partial<ItemEntity> = {
	id: "calculator_tool_demo",
	name: "Calculator Tool Demo",
	config: {
		elements: { "pp-pie-element-calculator": "@pie-element/calculator@latest" },
		models: [
			{ id: "1", element: "pie-element-calculator", mode: "scientific" },
		],
		markup: "<pp-pie-element-calculator id='1'></pp-pie-element-calculator>",
	},
};

export const PROTRACTOR_TOOL_DEMO: Partial<ItemEntity> = {
	id: "protractor_tool_demo",
	name: "Protractor Tool Demo",
	config: {
		elements: { "pp-pie-element-protractor": "@pie-element/protractor@latest" },
		models: [{ id: "1", element: "protractor-element" }],
		markup: "<pp-pie-element-protractor id='1'></pp-pie-element-protractor>",
	},
};

export const RULER_TOOL_DEMO: Partial<ItemEntity> = {
	id: "ruler_tool_demo",
	name: "Ruler Tool Demo",
	config: {
		elements: { "pp-pie-element-ruler": "@pie-element/ruler@latest" },
		models: [
			{
				id: "1",
				element: "ruler-element",
				mode: "scientific",
				measure: "metric",
				label: "m",
				units: 10,
				width: 500,
			},
		],
		markup: "<pp-pie-element-ruler id='1'></pp-pie-element-ruler>",
	},
};

export const RUBRIC_DEMO: Partial<ItemEntity> = {
	id: "rubric_demo",
	name: "Rubric Demo",
	config: {
		elements: { "pp-pie-element-rubric": "@pie-element/rubric@latest" },
		models: [
			{
				id: "1",
				element: "pp-pie-element-rubric",
				points: [
					"<div>nothing right</div>",
					"<div>a teeny bit right</div>",
					"<div>mostly right</div>",
					"<div>bingo</div>",
				],
				sampleAnswers: [
					null,
					"<div>just right</div>",
					"<div>not left</div>",
					null,
				],
				maxPoints: 3,
				excludeZero: false,
				excludeZeroEnabled: true,
				maxPointsEnabled: true,
			},
		],
		markup: "<pp-pie-element-rubric id='1'></pp-pie-element-rubric>",
	},
};

export const COMPLEX_RUBRIC_DEMO_WITH_TYPE_SIMPLE_RUBRIC: Partial<ItemEntity> =
	{
		id: "complex_rubric_demo_1",
		name: "Complex Rubric Demo With Type Simple Rubric",
		config: {
			elements: {
				"pp-pie-element-complex-rubric": "@pie-element/complex-rubric@latest",
			},
			models: [complexRubricExampleModel],
			markup:
				"<pp-pie-element-complex-rubric id='abc1234'></pp-pie-element-complex-rubric>",
		},
	};

export const COMPLEX_RUBRIC_DEMO_WITH_TYPE_MULTI_TRAIT_RUBRIC: Partial<ItemEntity> =
	{
		id: "complex_rubric_demo_2",
		name: "Complex Rubric Demo With Type Multi Trait Rubric",
		config: {
			elements: {
				"pp-pie-element-complex-rubric": "@pie-element/complex-rubric@latest",
			},
			models: [
				{ ...complexRubricExampleModel, rubricType: "multiTraitRubric" },
			],
			markup:
				"<pp-pie-element-complex-rubric id='abc1234'></pp-pie-element-complex-rubric>",
		},
	};

export const COMPLEX_RUBRIC_DEMO_WITH_TYPE_RUBRICLESS: Partial<ItemEntity> = {
	id: "complex_rubric_demo_3",
	name: "Complex Rubric Demo With Type Rubricless",
	config: {
		elements: {
			"pp-pie-element-complex-rubric": "@pie-element/complex-rubric@latest",
		},
		models: [{ ...complexRubricExampleModel, rubricType: "rubricless" }],
		markup:
			"<pp-pie-element-complex-rubric id='abc1234'></pp-pie-element-complex-rubric>",
	},
};

export const PIE_ELEMENT_GROUPS: PieElementGroup[] = [
	{
		id: "multiple-choice",
		name: "Multiple Choice",
		description: "Questions with single or multiple correct answers",
		examples: [
			{
				id: "mc_basic",
				name: "Basic Single Answer",
				description: "Simple multiple choice with a single correct answer",
				item: MULTIPLE_CHOICE_BASIC,
			},
			{
				id: "mc_multi",
				name: "Multiple Answers",
				description: "Multiple choice that allows selecting multiple answers",
				item: MULTIPLE_CHOICE_MULTI,
			},
			{
				id: "tf_basic",
				name: "True/False Question",
				description: "Multiple choice formatted as a true/false question",
				item: TRUE_FALSE_EXAMPLE,
			},
			{
				id: "ebsr",
				name: "Evidence-Based Selected Response",
				description: "Two-part question format",
				item: EBSR_DEMO,
			},
		],
	},
	{
		id: "extended-text",
		name: "Extended Text",
		description: "Extended text response questions",
		examples: [
			{
				id: "et_basic",
				name: "Extended Text Entry",
				description: "Simple extended text question",
				item: EXTENDED_TEXT_DEMO,
			},
		],
	},
	{
		id: "explicit-constructed-response",
		name: "Explicit Constructed Response",
		description:
			"Students type exact answers that must match predefined responses",
		examples: [
			{
				id: "ecr_basic",
				name: "Fill-in-the-Blank Demo",
				description: "Type exact words to complete the sentence",
				item: EXPLICIT_CONSTRUCTED_RESPONSE_DEMO,
			},
		],
	},
	{
		id: "passage",
		name: "Passage",
		description: "Reading passage with formatted text",
		examples: [
			{
				id: "passage",
				name: "Passage Tool",
				description: "Display formatted reading passages",
				item: PASSAGE_DEMO,
			},
		],
	},

	{
		id: "drag-and-drop-items",
		name: "Drag and Drop",
		description: "Drag and drop items",
		examples: [
			{
				id: "cat_basic",
				name: "Categorize Demo",
				description: "Sort items into correct categories",
				item: CATEGORIZE_DEMO,
			},
			{
				id: "dnd_basic",
				name: "Drag In The Blank Demo",
				description: "Simple drag and drop words into sentence blanks",
				item: DRAG_IN_THE_BLANK_DEMO,
			},
			{
				id: "img_dd",
				name: "Image Drag and Drop",
				description: "Drag images to correct positions",
				item: IMAGE_DRAG_AND_DROP_DEMO,
			},
			{
				id: "placement_order",
				name: "Placement Ordering Demo",
				description: "Order items in correct sequence",
				item: PLACEMENT_ORDERING_DEMO,
			},
		],
	},
	{
		id: "math-items",
		name: "Math Questions",
		description: "Math-related question types",
		examples: [
			{
				id: "eq_response",
				name: "Equation Response",
				description: "Answer with mathematical expressions",
				item: EQUATION_RESPONSE_DEMO,
			},
			{
				id: "math_template",
				name: "Math Template",
				description: "Fill in the blanks with math expressions",
				item: MATH_TEMPLATED_DEMO,
			},
			{
				id: "fraction_model",
				name: "Fraction Model",
				description: "Visual fraction modeling tool",
				item: FRACTION_MODEL_DEMO,
			},
		],
	},
	{
		id: "graphing-tools",
		name: "Graphical data presentation",
		description: "Tools for graphing and charting",
		examples: [
			{
				id: "graphing",
				name: "Graphing",
				description:
					"Students answer question by plotting points, lines, or other objects on a two-dimensional coordinate grid",
				item: GRAPHING_DEMO,
			},
			{
				id: "charting",
				name: "Charting",
				description:
					"Students answer question by manipulating a bar chart, histogram, line chart, or dot plot chart",
				item: CHARTING_DEMO,
			},
			{
				id: "graphing_solution",
				name: "Graphing Solution Set",
				description:
					"Students answer question by plotting one or two lines on a coordinate grid and selecting a resulting region",
				item: GRAPHING_SOLUTION_SET_DEMO,
			},
			{
				id: "number_line",
				name: "Number Line",
				description: "Plot points, segments, or rays",
				item: NUMBER_LINE_DEMO,
			},
		],
	},
	{
		id: "text-selection",
		name: "Selection",
		description: "Select correct elements",
		examples: [
			{
				id: "select_text",
				name: "Select Text Demo",
				description: "Select specific parts of text",
				item: SELECT_TEXT_DEMO,
			},
			{
				id: "hotspot",
				name: "Hotspot Demo",
				description: "Select areas on an image",
				item: HOTSPOT_DEMO,
			},
		],
	},
	{
		id: "matching",
		name: "Matching",
		description: "Match related items",
		examples: [
			{
				id: "match_basic",
				name: "Match Demo",
				description: "Match items across columns",
				item: MATCH_DEMO,
			},
			{
				id: "match_list",
				name: "Match List",
				description: "Match items in lists",
				item: MATCH_LIST,
			},
		],
	},
	{
		id: "drawing-response",
		name: "Drawing Response",
		description: "Draw a response to a question",
		examples: [
			{
				id: "drawing",
				name: "Drawing Response Tool",
				description: "Draw a response to a question",
				item: DRAWING_RESPONSE_DEMO,
			},
		],
	},
	{
		id: "inline-dropdown",
		name: "Inline Dropdown",
		description: "Select answers from dropdowns within text",
		examples: [
			{
				id: "inline_dropdown",
				name: "Inline Dropdown",
				description: "Select answers from dropdowns within text",
				item: INLINE_DROPDOWN_DEMO,
			},
		],
	},
	{
		id: "tools",
		name: "Math Tools",
		description: "Measurement and calculation tools",
		examples: [
			{
				id: "calculator",
				name: "Calculator Tool",
				description: "Scientific calculator for solving problems",
				item: CALCULATOR_TOOL_DEMO,
			},
			{
				id: "protractor",
				name: "Protractor Tool",
				description: "Measure angles on screen",
				item: PROTRACTOR_TOOL_DEMO,
			},
			{
				id: "ruler",
				name: "Ruler Tool",
				description: "Measure distances on screen",
				item: RULER_TOOL_DEMO,
			},
		],
	},
	{
		id: "complex-rubric",
		name: "Complex Rubric",
		description: "Complex rubric with different rubricTypes",
		examples: [
			{
				id: "complex-rubric-with-type-simple-rubric",
				name: "Complex Rubric",
				description: "Complex rubric with rubricType simpleRubric",
				item: COMPLEX_RUBRIC_DEMO_WITH_TYPE_SIMPLE_RUBRIC,
			},
			{
				id: "complex-rubric-with-type-multi-trait-rubric",
				name: "Complex Rubric",
				description: "Complex rubric with rubricType multiTraitRubric",
				item: COMPLEX_RUBRIC_DEMO_WITH_TYPE_MULTI_TRAIT_RUBRIC,
			},
			{
				id: "complex-rubric-with-type-rubricless",
				name: "Complex Rubric",
				description: "Complex rubric with rubricType rubricless",
				item: COMPLEX_RUBRIC_DEMO_WITH_TYPE_RUBRICLESS,
			},
		],
	},
	{
		id: "rubric",
		name: "Rubric",
		description: "Rubric question",
		examples: [
			{
				id: "base_rubric",
				name: "Rubric",
				description: "Simple rubric question",
				item: RUBRIC_DEMO,
			},
		],
	},
];

export const itemCapitalOfNL = JSON.parse(`
{
  "config": {
    "markup": "<pp-pie-element-multiple-choice id='q1'></pp-pie-element-multiple-choice>",
    "elements": {
      "pp-pie-element-multiple-choice": "@pie-element/multiple-choice@latest"
    },
    "models": [
      {
        "id": "q1",
        "prompt": "<div>What is the capital of the Netherlands?</div>",
        "element": "pp-pie-element-multiple-choice",
        "promptEnabled": true,
        "gridColumns": "2",
        "scoringType": "auto",
        "choicesLayout": "vertical",
        "limitChoicesNumber": true,
        "teacherInstructionsEnabled": false,
        "toolbarEditorPosition": "bottom",
        "choiceMode": "radio",
        "studentInstructionsEnabled": false,
        "lockChoiceOrder": true,
        "partialScoring": true,
        "rationaleEnabled": false,
        "choicePrefix": "letters",
        "choices": [
          {
            "feedback": {
              "type": "none",
              "value": ""
            },
            "correct": false,
            "label": "<div>Amsterdam</div>",
            "value": "0"
          },
          {
            "feedback": {
              "type": "none",
              "value": ""
            },
            "correct": true,
            "label": "<div>The Hague</div>",
            "value": "1"
          },
          {
            "feedback": {
              "type": "none",
              "value": ""
            },
            "correct": false,
            "label": "<div>Stockholm</div>",
            "value": "2"
          }
        ],
        "feedbackEnabled": false
      }
    ]
  }
}
`) as ItemEntity;

export const passageCapitalOfNL = JSON.parse(`
{
  "name": "",
  "config": {
    "markup": "<pie-passage id='p1'></pie-passage>",
    "elements": {
      "pie-passage": "@pie-element/passage@latest"
    },
    "models": [
      {
        "passages": [
          {
            "text": "<p>A capital city is like a home base for a country. It's where the country's leader lives and where the government makes important decisions. Think of it as the headquarters for a whole country, just like your classroom is for your class!</p>",
            "title": "The Capital of the Netherlands"
          }
        ],
        "id": "p1",
        "element": "pie-passage"
      }
    ],
    "layout": "layout"
  }
}	
`) as PassageEntity;

export const LSY_E347135 = {
	description: "E347135",
	questions: [
		{
			id: "8a80808161c935340161d5f15e186511",
			data: {
				type: "clozetext",
				case_sensitive: false,
				max_length: 8,
				template:
					'The table below shows the mass of two boxes in kilograms. Complete the table to show the mass of each box in grams.<br />\n&#160;\n<table border="1" cellpadding="2" cellspacing="0" height="115" style="margin-left:15pt;" width="296">\n\t<thead>\n\t\t<tr style="background-color:#cccccc;">\n\t\t\t<th scope="row">&#160;</th>\n\t\t\t<th scope="col">Mass in Kilograms</th>\n\t\t\t<th scope="col">Mass in Grams</th>\n\t\t</tr>\n\t</thead>\n\t<tbody>\n\t\t<tr>\n\t\t\t<th scope="row" style="background-color:#cccccc;">&#160;Box&#160;1&#160;</th>\n\t\t\t<td style="text-align: center;">7</td>\n\t\t\t<td style="text-align: center;">{{response}}</td>\n\t\t</tr>\n\t\t<tr>\n\t\t\t<th scope="row" style="background-color:#cccccc;">&#160;Box&#160;2&#160;</th>\n\t\t\t<td style="text-align: center;">5</td>\n\t\t\t<td style="text-align: center;">{{response}}</td>\n\t\t</tr>\n\t</tbody>\n</table>\n',
				validation: {
					scoring_type: "exactMatch",
					valid_response: {
						score: 1,
						value: ["7000", "5000"],
					},
				},
			},
		},
	],
};

export const PIE_E347135 = {
	name: "E347135",
	published: false,
	config: {
		markup:
			'<explicit-constructed-response id="8a80808161c935340161d5f15e186511"></explicit-constructed-response>',
		elements: {
			"explicit-constructed-response":
				"@pie-element/explicit-constructed-response@latest",
		},
		models: [
			{
				markup:
					'The table below shows the mass of two boxes in kilograms. Complete the table to show the mass of each box in grams.<br />&#160;<table border="1" cellpadding="2" cellspacing="0" height="115" style="margin-left:15pt;" width="296"><thead><tr style="background-color:#cccccc;"><th scope="row">&#160;</th><th scope="col">Mass in Kilograms</th><th scope="col">Mass in Grams</th></tr></thead><tbody><tr><th scope="row" style="background-color:#cccccc;">&#160;Box&#160;1&#160;</th><td style="text-align: center;">7</td><td style="text-align: center;">{{0}}</td></tr><tr><th scope="row" style="background-color:#cccccc;">&#160;Box&#160;2&#160;</th><td style="text-align: center;">5</td><td style="text-align: center;">{{1}}</td></tr></tbody></table>',
				choices: {
					"0": [
						{
							label: "7000",
							value: 1,
						},
					],
					"1": [
						{
							label: "5000",
							value: 1,
						},
					],
				},
				maxLengthPerChoice: [],
				maxLengthPerChoiceEnabled: true,
				id: "8a80808161c935340161d5f15e186511",
				element: "explicit-constructed-response",
			},
		],
	},
	searchMetaData: {},
};
