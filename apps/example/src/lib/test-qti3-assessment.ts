import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

/**
 * QTI 3.0 Test Assessment
 *
 * Demonstrates QTI 3.0 features:
 * - Context Declarations (global variables)
 * - Accessibility Catalogs (spoken, braille, simplified language)
 * - Personal Needs Profile (PNP) integration
 * - Stimulus References (placeholder for Phase 3)
 */
export const qti3TestAssessment: AssessmentEntity = {
	id: "qti3-test-001",
	name: "QTI 3.0 Feature Demonstration",
	title: "QTI 3.0 Assessment with Full Feature Support",
	identifier: "test-qti3-001",
	qtiVersion: "3.0",

	// ============================================================================
	// ACCESSIBILITY CATALOGS (QTI 3.0 Phase 2)
	// ============================================================================
	accessibilityCatalogs: [
		// Welcome message with multiple languages and formats
		{
			identifier: "welcome-message",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak><prosody rate="medium" pitch="medium">Welcome to the QTI 3.0 test assessment. <break time="500ms"/> This assessment demonstrates context declarations, accessibility catalogs, and personal needs profiles.</prosody></speak>',
				},
				{
					catalog: "spoken",
					language: "es-ES",
					content:
						'<speak><prosody rate="medium">Bienvenido a la evaluación de prueba QTI 3.0.</prosody></speak>',
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠺⠑⠇⠉⠕⠍⠑ ⠞⠕ ⠞⠓⠑ ⠠⠟⠠⠞⠠⠊ ⠼⠉⠲⠚ ⠞⠑⠎⠞ ⠁⠎⠎⠑⠎⠎⠍⠑⠝⠞⠲",
				},
				{
					catalog: "simplified-language",
					language: "en",
					content:
						"<p>Welcome to the test. This test shows new QTI 3.0 features.</p>",
				},
			],
		},

		// Test instructions with accessibility alternatives
		{
			identifier: "test-instructions",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak><prosody rate="slow">Read each question carefully. <break time="800ms"/> Select the best answer from the choices provided. <break time="500ms"/> You may use the available tools to help you answer.</prosody></speak>',
				},
				{
					catalog: "simplified-language",
					language: "en",
					content:
						"<div><p><strong>What to do:</strong></p><ol><li>Read each question</li><li>Pick the best answer</li><li>Use tools if you need help</li></ol></div>",
				},
			],
		},

		// Math-specific catalog with Nemeth braille
		{
			identifier: "math-formula-example",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak><prosody rate="slow">Two x <break time="200ms"/> plus five <break time="300ms"/> equals <break time="200ms"/> seventeen</prosody></speak>',
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠼⠆⠭⠬⠼⠑⠀⠨⠅⠀⠼⠁⠛", // Nemeth: 2x+5 = 17
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Two times x, plus five, equals seventeen",
				},
			],
		},
	],

	// ============================================================================
	// PERSONAL NEEDS PROFILE (QTI 3.0 Phase 1)
	// ============================================================================
	personalNeedsProfile: {
		supports: ["textToSpeech", "calculator", "highlighter", "magnifier"],
		prohibitedSupports: [],
		activateAtInit: ["textToSpeech"],
	},

	// ============================================================================
	// SETTINGS (District Policy & Tool Configuration)
	// ============================================================================
	settings: {
		districtPolicy: {
			blockedTools: [],
			requiredTools: ["textToSpeech"],
			policies: {
				allowCalculatorOnAllItems: false,
				requireReviewBeforeSubmit: true,
			},
		},
		testAdministration: {
			mode: "test",
			toolOverrides: {},
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
			lineHeight: 1.6,
			reducedMotion: false,
		},
	},

	// ============================================================================
	// CONTEXT DECLARATIONS (QTI 3.0 Phase 1)
	// ============================================================================
	contextDeclarations: [
		{
			identifier: "RANDOM_SEED",
			baseType: "integer",
			cardinality: "single",
			defaultValue: 42,
		},
		{
			identifier: "DIFFICULTY_LEVEL",
			baseType: "string",
			cardinality: "single",
			defaultValue: "medium",
		},
		{
			identifier: "CURRENCY_SYMBOL",
			baseType: "string",
			cardinality: "single",
			defaultValue: "$",
		},
		{
			identifier: "SECTION_SCORE",
			baseType: "float",
			cardinality: "single",
			defaultValue: 0.0,
		},
	],

	// ============================================================================
	// STIMULUS REFERENCES (QTI 3.0 Phase 3 - Placeholder)
	// ============================================================================
	stimulusRefs: [],

	// ============================================================================
	// TEST STRUCTURE
	// ============================================================================
	testParts: [
		{
			identifier: "part1",
			navigationMode: "nonlinear",
			submissionMode: "individual",
			sections: [
				{
					identifier: "section1",
					title: "QTI 3.0 Feature Demonstration",
					visible: true,

					// Rubric blocks with catalog references
					rubricBlocks: [
						{
							view: "candidate",
							use: "instructions",
							content:
								'<div data-catalog-id="welcome-message"><h3>Welcome</h3><p>This is a QTI 3.0 compliant assessment demonstrating accessibility catalogs, context declarations, and personal needs profiles.</p></div>',
						},
						{
							view: "candidate",
							use: "instructions",
							content:
								'<div data-catalog-id="test-instructions"><h4>Instructions</h4><p>Read each question carefully and select the best answer.</p></div>',
						},
					],

					questionRefs: [
						{
							identifier: "item1",
							itemVId: "mc_basic",
							required: true,
						},
						{
							identifier: "item2",
							itemVId: "mc_multi",
							required: false,
						},
						{
							identifier: "item3",
							itemVId: "et_basic",
							required: false,
						},
					],
				},
			],
		},
	],
};

// Log QTI 3.0 feature availability
console.log("QTI 3.0 test assessment loaded");
console.log("Features:");
console.log("  - testParts:", qti3TestAssessment.testParts?.length);
console.log(
	"  - contextDeclarations:",
	qti3TestAssessment.contextDeclarations?.length,
);
console.log(
	"  - accessibilityCatalogs:",
	qti3TestAssessment.accessibilityCatalogs?.length,
);
console.log(
	"  - personalNeedsProfile:",
	qti3TestAssessment.personalNeedsProfile ? "enabled" : "not configured",
);
console.log(
	"  - stimulusRefs:",
	qti3TestAssessment.stimulusRefs?.length,
	"(Phase 3 - placeholder)",
);
