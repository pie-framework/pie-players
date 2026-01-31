import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

export interface AssessmentExample {
	id: string;
	name: string;
	description: string;
	itemIds: string[];
	estimatedMinutes?: number;
	tags?: string[];
}

/**
 * Curated assessment examples showcasing different assessment patterns
 * and item type combinations.
 */
export const ASSESSMENT_EXAMPLES: AssessmentExample[] = [
	{
		id: "math-quiz",
		name: "Quick Math Quiz",
		description:
			"5-item formative assessment covering basic algebra and graphing concepts. Ideal for checking understanding after a lesson.",
		itemIds: [
			"eq_response", // Equation Response
			"math_template", // Math Template
			"number_line", // Number Line
			"fraction_model", // Fraction Model
			"graphing", // Graphing
		],
		estimatedMinutes: 10,
		tags: ["math", "formative", "quick"],
	},
	{
		id: "reading-comprehension",
		name: "Reading Comprehension Assessment",
		description:
			"8-item passage-based assessment with multiple question types. Demonstrates how to structure questions around a reading passage.",
		itemIds: [
			"passage", // Reading Passage
			"mc_basic", // Multiple Choice about passage
			"select_text", // Select Text from passage
			"ebsr", // Evidence-based question
			"et_basic", // Extended text response
			"mc_multi", // Multiple correct answers
			"inline_dropdown", // Inline dropdowns
			"hotspot", // Hotspot on diagram
		],
		estimatedMinutes: 20,
		tags: ["reading", "ela", "passage-based"],
	},
	{
		id: "practice-test",
		name: "Practice Test - Mixed Subjects",
		description:
			"15-item comprehensive assessment with varied item types across multiple subjects. Good example of a full practice test structure.",
		itemIds: [
			// Multiple Choice Section
			"mc_basic",
			"mc_multi",
			"tf_basic",
			"ebsr",
			// Constructed Response Section
			"et_basic",
			"ecr_basic",
			"drawing",
			// Interactive Tasks Section
			"cat_basic",
			"dnd_basic",
			"placement_order",
			// Math Section
			"eq_response",
			"math_template",
			"graphing",
			"charting",
			"number_line",
		],
		estimatedMinutes: 45,
		tags: ["comprehensive", "practice-test", "mixed"],
	},
	{
		id: "science-lab",
		name: "Science Lab - Data Analysis",
		description:
			"10-item assessment focusing on data interpretation, graphing, and scientific reasoning.",
		itemIds: [
			"passage", // Lab scenario
			"charting", // Create chart from data
			"graphing", // Plot experimental results
			"hotspot", // Identify parts of diagram
			"mc_basic", // Interpret results
			"match_basic", // Match terms to definitions
			"select_text", // Highlight evidence
			"et_basic", // Explain findings
			"ebsr", // Evidence-based conclusion
			"img_dd", // Drag labels onto diagram
		],
		estimatedMinutes: 30,
		tags: ["science", "data-analysis", "graphing"],
	},
	{
		id: "geometry-interactive",
		name: "Geometry - Interactive Tools",
		description:
			"7-item assessment showcasing geometric tools and visual reasoning. Includes calculator, protractor, and ruler tools.",
		itemIds: [
			"calculator", // Calculator tool demo
			"protractor", // Protractor tool
			"ruler", // Ruler tool
			"graphing", // Plot geometric shapes
			"drawing", // Draw constructions
			"hotspot", // Identify angles
			"mc_basic", // Geometry concepts
		],
		estimatedMinutes: 25,
		tags: ["math", "geometry", "tools"],
	},
	{
		id: "vocabulary-matching",
		name: "Vocabulary & Matching",
		description:
			"6-item assessment focusing on vocabulary, definitions, and relationship matching.",
		itemIds: [
			"match_basic", // Match words to definitions
			"match_list", // Match related concepts
			"cat_basic", // Categorize words by type
			"inline_dropdown", // Fill in vocabulary
			"select_text", // Find words in context
			"mc_multi", // Select all synonyms
		],
		estimatedMinutes: 15,
		tags: ["vocabulary", "ela", "matching"],
	},
	{
		id: "drag-drop-showcase",
		name: "Drag & Drop Showcase",
		description:
			"5-item assessment demonstrating various drag-and-drop interaction patterns.",
		itemIds: [
			"cat_basic", // Categorize items
			"dnd_basic", // Drag words into blanks
			"img_dd", // Image drag and drop
			"placement_order", // Order items in sequence
			"match_basic", // Match by dragging
		],
		estimatedMinutes: 12,
		tags: ["drag-drop", "interactive"],
	},
	{
		id: "standardized-test-sections",
		name: "Standardized Test with Sections",
		description:
			"20-item comprehensive test organized into 4 sections: Multiple Choice, Constructed Response, Math, and Extended Response. Demonstrates section-based assessment structure.",
		itemIds: [
			// Section 1: Multiple Choice (5 items)
			"mc_basic",
			"mc_multi",
			"tf_basic",
			"ebsr",
			"inline_dropdown",
			// Section 2: Constructed Response (5 items)
			"et_basic",
			"ecr_basic",
			"select_text",
			"hotspot",
			"cat_basic",
			// Section 3: Math (5 items)
			"eq_response",
			"math_template",
			"graphing",
			"number_line",
			"fraction_model",
			// Section 4: Extended Response (5 items)
			"drawing",
			"dnd_basic",
			"match_basic",
			"charting",
			"img_dd",
		],
		estimatedMinutes: 60,
		tags: ["comprehensive", "sections", "standardized-test"],
	},
	{
		id: "linear-practice-test",
		name: "Linear Practice Test (Sequential)",
		description:
			"10-item linear assessment where students must answer items in order. Demonstrates linear navigation mode with progression through sections.",
		itemIds: [
			// Section 1: Warm-up (3 items)
			"mc_basic",
			"tf_basic",
			"inline_dropdown",
			// Section 2: Core Content (4 items)
			"ebsr",
			"et_basic",
			"math_template",
			"graphing",
			// Section 3: Application (3 items)
			"drawing",
			"cat_basic",
			"match_basic",
		],
		estimatedMinutes: 30,
		tags: ["linear", "sequential", "practice"],
	},
	{
		id: "qti3-accessibility-catalogs",
		name: "QTI 3.0 Accessibility Catalogs Demo",
		description:
			"Demonstrates QTI 3.0 accessibility catalogs with spoken TTS, braille, simplified language, and multi-language support. Shows assessment-level and item-level catalog integration.",
		itemIds: [
			"mc_basic",
			"mc_multi",
			"et_basic",
		],
		estimatedMinutes: 10,
		tags: ["qti3", "accessibility", "catalogs", "demo"],
	},
	{
		id: "qti3-pnp-integration",
		name: "QTI 3.0 Personal Needs Profile Demo",
		description:
			"Shows QTI 3.0 Personal Needs Profile (PNP) integration with automatic tool activation based on student accommodations (IEP/504 support).",
		itemIds: [
			"mc_basic",
			"calculator",
			"graphing",
			"et_basic",
		],
		estimatedMinutes: 12,
		tags: ["qti3", "pnp", "accommodations", "demo"],
	},
];

/**
 * Convert an AssessmentExample to an AssessmentEntity
 */
export function createAssessmentFromExample(
	example: AssessmentExample,
): AssessmentEntity {
	// QTI 3.0 Accessibility Catalogs Demo
	if (example.id === "qti3-accessibility-catalogs") {
		return {
			id: "qti3-a11y-demo",
			name: example.name,
			title: "QTI 3.0 Accessibility Catalogs",
			identifier: "qti3-accessibility-demo",
			qtiVersion: "3.0",

			// Assessment-level accessibility catalogs (shared across items)
			accessibilityCatalogs: [
				{
					identifier: "welcome-message",
					cards: [
						{
							catalog: "spoken",
							language: "en-US",
							content:
								'<speak><prosody rate="medium">Welcome to the QTI 3.0 accessibility demo. This assessment demonstrates spoken text, braille output, and simplified language alternatives.</prosody></speak>',
						},
						{
							catalog: "simplified-language",
							language: "en",
							content: "Welcome! This test shows different ways to read questions.",
						},
						{
							catalog: "spoken",
							language: "es-ES",
							content:
								'<speak><prosody rate="medium">Bienvenido a la demostración de accesibilidad QTI 3.0.</prosody></speak>',
						},
					],
				},
				{
					identifier: "shared-instructions",
					cards: [
						{
							catalog: "spoken",
							language: "en-US",
							content:
								'<speak>Read each question carefully. <break time="500ms"/> Select the best answer. <break time="500ms"/> You may use the text-to-speech tool to hear the questions.</speak>',
						},
						{
							catalog: "simplified-language",
							language: "en",
							content: "Read each question. Pick the best answer. Use the speaker button to hear questions.",
						},
					],
				},
			],

			// Personal Needs Profile (auto-activate TTS)
			personalNeedsProfile: {
				supports: ["textToSpeech", "highlighter"],
				activateAtInit: ["textToSpeech"],
			},

			testParts: [
				{
					identifier: "part-1",
					navigationMode: "nonlinear",
					submissionMode: "individual",
					sections: [
						{
							identifier: "section-1",
							title: "Accessibility Features Demo",
							rubricBlocks: [
								{
									view: "candidate",
									use: "instructions",
									content:
										'<div data-catalog-id="welcome-message"><h3>Welcome</h3><p>This assessment demonstrates QTI 3.0 accessibility catalogs with multiple alternative formats.</p></div>',
								},
							],
							assessmentItemRefs: example.itemIds.map((itemVId, idx) => ({
								identifier: `q-${idx + 1}`,
								itemVId,
							})),
						},
					],
				},
			],
		};
	}

	// QTI 3.0 Personal Needs Profile Demo
	if (example.id === "qti3-pnp-integration") {
		return {
			id: "qti3-pnp-demo",
			name: example.name,
			title: "QTI 3.0 Personal Needs Profile",
			identifier: "qti3-pnp-demo",
			qtiVersion: "3.0",

			// Personal Needs Profile with multiple accommodations
			personalNeedsProfile: {
				supports: [
					"textToSpeech",
					"calculator",
					"highlighter",
					"magnifier",
					"colorContrast",
				],
				activateAtInit: ["textToSpeech", "calculator"],
				prohibitedSupports: [], // Nothing explicitly prohibited
			},

			// District policy and settings
			settings: {
				districtPolicy: {
					blockedTools: [], // No district blocks
					requiredTools: ["textToSpeech"], // District requires TTS
				},
				toolConfigs: {
					calculator: {
						type: "scientific",
						provider: "desmos",
					},
				},
				themeConfig: {
					colorScheme: "default",
					fontSize: 16,
					reducedMotion: false,
				},
			},

			testParts: [
				{
					identifier: "part-1",
					navigationMode: "nonlinear",
					submissionMode: "individual",
					sections: [
						{
							identifier: "section-1",
							title: "Accommodations Demo",
							rubricBlocks: [
								{
									view: "candidate",
									use: "instructions",
									content:
										"<h3>Personal Needs Profile Demo</h3><p>This assessment demonstrates automatic tool activation based on student accommodations (IEP/504 support). Notice that TTS and calculator tools are automatically activated based on your profile.</p>",
								},
							],
							assessmentItemRefs: example.itemIds.map((itemVId, idx) => ({
								identifier: `q-${idx + 1}`,
								itemVId,
							})),
						},
					],
				},
			],
		};
	}

	// Demonstrate QTI-like passage sharing: a section-level passage (rubricBlock)
	// shared across multiple assessment items.
	if (
		example.tags?.includes("passage-based") ||
		example.id === "reading-comprehension"
	) {
		const passageContent =
			"<h2>Reading Passage</h2><p>This passage is shared across the items in this section (modeled as a QTI rubric block on the section).</p>";

		const itemIds = example.itemIds.filter((id) => id !== "passage");

		return {
			name: example.name,
			testParts: [
				{
					identifier: "part-1",
					navigationMode: "nonlinear",
					submissionMode: "individual",
					sections: [
						{
							identifier: "section-1",
							title: "Passage Set",
							rubricBlocks: [
								{
									view: "candidate",
									use: "passage",
									content: passageContent,
								},
							],
							assessmentItemRefs: itemIds.map((itemVId, idx) => ({
								identifier: `q-${idx + 1}`,
								itemVId,
							})),
						},
					],
				},
			],
		};
	}

	return {
		name: example.name,
		questions: example.itemIds.map((itemVId, idx) => ({
			id: `q-${idx + 1}`,
			itemVId,
		})),
	};
}

/**
 * Get an assessment example by ID
 */
export function getAssessmentExampleById(
	id: string,
): AssessmentExample | undefined {
	return ASSESSMENT_EXAMPLES.find((example) => example.id === id);
}
