/**
 * QTI 3.0 / IMS Access for All (AfA) 3.0 Standard Access Features
 *
 * This file contains standardized accessibility feature identifiers from:
 * - IMS Global Access for All (AfA) 3.0 specification
 * - QTI 3.0 Personal Needs and Preferences (PNP)
 * - Schema.org accessibility features vocabulary
 * - WCAG 2.x accessibility guidelines
 *
 * These are the officially recognized values for QTI 3.0's accessibilityInfo.accessFeature
 * and can be used as a reference for PNP profile configuration and tool mapping.
 *
 * References:
 * - IMS AfA 3.0: https://www.imsglobal.org/spec/afa/v3p0
 * - QTI 3.0: https://www.imsglobal.org/spec/qti/v3p0
 * - Schema.org: https://schema.org/accessibilityFeature
 */

/**
 * Standard QTI 3.0 accessibility features organized by category
 */
export const QTI_STANDARD_ACCESS_FEATURES = {
	/**
	 * Visual accessibility features
	 * For students with low vision, color blindness, or visual processing needs
	 */
	visual: {
		// Magnification and zoom
		magnification: "magnification",
		screenMagnifier: "screenMagnifier",
		zoomable: "zoomable",

		// Color and contrast
		highContrastDisplay: "highContrastDisplay",
		highContrastAudio: "highContrastAudio",
		colorContrast: "colorContrast",
		invertColors: "invertColors",

		// Display customization
		displayTransformability: "displayTransformability",
		largePrint: "largePrint",
		fontEnlargement: "fontEnlargement",
		resizeText: "resizeText",

		// Visual alternatives
		alternativeText: "alternativeText",
		longDescription: "longDescription",
		describedMath: "describedMath",
		tactileGraphic: "tactileGraphic",
		tactileObject: "tactileObject",
	},

	/**
	 * Auditory accessibility features
	 * For students who are deaf, hard of hearing, or benefit from audio
	 */
	auditory: {
		// Audio output
		audioDescription: "audioDescription",
		textToSpeech: "textToSpeech",
		readAloud: "readAloud",
		humanVoice: "humanVoice",
		syntheticVoice: "syntheticVoice",

		// Speech control
		speechRate: "speechRate",
		speechVolume: "speechVolume",
		voicePitch: "voicePitch",

		// Visual alternatives for audio
		captions: "captions",
		closedCaptions: "closedCaptions",
		openCaptions: "openCaptions",
		transcript: "transcript",
		signLanguage: "signLanguage",
		subtitles: "subtitles",

		// Audio adjustments
		audioControl: "audioControl",
		noBackgroundAudio: "noBackgroundAudio",
	},

	/**
	 * Motor/physical accessibility features
	 * For students with limited mobility or motor control
	 */
	motor: {
		// Input alternatives
		keyboardControl: "keyboardControl",
		mouseControl: "mouseControl",
		touchControl: "touchControl",
		voiceControl: "voiceControl",
		switchControl: "switchControl",
		eyeGazeControl: "eyeGazeControl",

		// Keyboard features
		singleSwitchAccess: "singleSwitchAccess",
		stickyKeys: "stickyKeys",
		keyboardShortcuts: "keyboardShortcuts",

		// Timing
		timingControl: "timingControl",
		unlimitedTime: "unlimitedTime",
		extendedTime: "extendedTime",
		pauseControl: "pauseControl",
	},

	/**
	 * Cognitive/learning accessibility features
	 * For students with learning disabilities, ADHD, autism, etc.
	 */
	cognitive: {
		// Content simplification
		simplifiedLanguage: "simplifiedLanguage",
		reducedComplexity: "reducedComplexity",
		structuralNavigation: "structuralNavigation",
		tableOfContents: "tableOfContents",

		// Focus and attention
		reducedDistraction: "reducedDistraction",
		noFlashing: "noFlashing",
		pauseAnimation: "pauseAnimation",

		// Organization and support
		annotations: "annotations",
		bookmarking: "bookmarking",
		highlighting: "highlighting",
		guidedNavigation: "guidedNavigation",

		// Tools
		calculator: "calculator",
		dictionary: "dictionary",
		thesaurus: "thesaurus",
		spellingAssistance: "spellingAssistance",
		grammarAssistance: "grammarAssistance",
	},

	/**
	 * Reading support features
	 * For students with dyslexia or reading challenges
	 */
	reading: {
		// Text presentation
		lineSpacing: "lineSpacing",
		wordSpacing: "wordSpacing",
		letterSpacing: "letterSpacing",
		fontFamily: "fontFamily",
		readingMask: "readingMask",
		readingGuide: "readingGuide",
		readingRuler: "readingRuler",

		// Highlighting and emphasis
		wordHighlighting: "wordHighlighting",
		lineHighlighting: "lineHighlighting",
		focusIndicator: "focusIndicator",

		// Content support
		printableResource: "printableResource",
		braille: "braille",
		nemeth: "nemeth",
		refreshableBraille: "refreshableBraille",
	},

	/**
	 * Navigation features
	 * For efficient content navigation
	 */
	navigation: {
		// Structure
		index: "index",
		pageNavigation: "pageNavigation",
		skipContent: "skipContent",
		breadcrumbs: "breadcrumbs",

		// Search
		searchable: "searchable",
		fullTextSearch: "fullTextSearch",
	},

	/**
	 * Linguistic features
	 * For language support
	 */
	linguistic: {
		// Languages
		multilingualText: "multilingualText",
		translatedText: "translatedText",
		glossary: "glossary",

		// Sign language
		signLanguageInterpretation: "signLanguageInterpretation",
		visualLanguage: "visualLanguage",
	},

	/**
	 * Assessment-specific features
	 * Features specific to test-taking environments
	 */
	assessment: {
		// Tools
		protractor: "protractor",
		ruler: "ruler",
		graph: "graph",
		graphingCalculator: "graphingCalculator",
		periodicTable: "periodicTable",
		formulaSheet: "formulaSheet",

		// Answer support
		answerMasking: "answerMasking",
		answerEliminator: "answerEliminator",
		strikethrough: "strikethrough",

		// Item features
		itemGlossary: "itemGlossary",
		tutorialAvailable: "tutorialAvailable",
	},
} as const;

/**
 * Flat list of all standard access features for validation
 */
export const ALL_STANDARD_ACCESS_FEATURES = Object.values(
	QTI_STANDARD_ACCESS_FEATURES,
).flatMap((category) => Object.values(category));

/**
 * Example PNP configurations for common accessibility needs
 * These are NOT official profiles but illustrative examples showing
 * how standard features can be combined for different student needs.
 */
export const EXAMPLE_PNP_CONFIGURATIONS = {
	/**
	 * Example: Student with low vision
	 */
	lowVision: {
		label: "Example: Low Vision Support",
		features: [
			"magnification",
			"screenMagnifier",
			"highContrastDisplay",
			"colorContrast",
			"fontEnlargement",
			"textToSpeech",
			"alternativeText",
			"describedMath",
		],
	},

	/**
	 * Example: Student who is blind
	 */
	blind: {
		label: "Example: Blind Student Support",
		features: [
			"textToSpeech",
			"screenReader",
			"alternativeText",
			"longDescription",
			"describedMath",
			"braille",
			"refreshableBraille",
			"keyboardControl",
			"structuralNavigation",
		],
	},

	/**
	 * Example: Student who is deaf or hard of hearing
	 */
	deafHardOfHearing: {
		label: "Example: Deaf/Hard of Hearing Support",
		features: [
			"captions",
			"closedCaptions",
			"signLanguage",
			"transcript",
			"visualLanguage",
			"noBackgroundAudio",
		],
	},

	/**
	 * Example: Student with dyslexia
	 */
	dyslexia: {
		label: "Example: Dyslexia Support",
		features: [
			"textToSpeech",
			"readAloud",
			"highlighting",
			"wordHighlighting",
			"lineHighlighting",
			"readingMask",
			"readingGuide",
			"fontFamily",
			"lineSpacing",
			"wordSpacing",
			"simplifiedLanguage",
			"dictionary",
		],
	},

	/**
	 * Example: Student with ADHD
	 */
	adhd: {
		label: "Example: ADHD Support",
		features: [
			"reducedDistraction",
			"noFlashing",
			"pauseAnimation",
			"timingControl",
			"extendedTime",
			"highlighting",
			"annotations",
			"guidedNavigation",
			"structuralNavigation",
		],
	},

	/**
	 * Example: Student with motor limitations
	 */
	motorLimitations: {
		label: "Example: Motor Limitations Support",
		features: [
			"keyboardControl",
			"stickyKeys",
			"keyboardShortcuts",
			"voiceControl",
			"switchControl",
			"timingControl",
			"extendedTime",
			"unlimitedTime",
		],
	},

	/**
	 * Example: English language learner
	 */
	englishLearner: {
		label: "Example: English Language Learner Support",
		features: [
			"textToSpeech",
			"translatedText",
			"glossary",
			"dictionary",
			"simplifiedLanguage",
			"readAloud",
			"highlighting",
		],
	},
} as const;

/**
 * Helper to validate if a feature ID is a standard QTI 3.0 feature
 */
export function isStandardAccessFeature(featureId: string): boolean {
	return (ALL_STANDARD_ACCESS_FEATURES as readonly string[]).includes(
		featureId,
	);
}

/**
 * Helper to get category for a feature
 */
export function getFeatureCategory(
	featureId: string,
): keyof typeof QTI_STANDARD_ACCESS_FEATURES | null {
	for (const [category, features] of Object.entries(
		QTI_STANDARD_ACCESS_FEATURES,
	)) {
		if ((Object.values(features) as string[]).includes(featureId)) {
			return category as keyof typeof QTI_STANDARD_ACCESS_FEATURES;
		}
	}
	return null;
}

/**
 * Helper to get all features in a category
 */
export function getFeaturesInCategory(
	category: keyof typeof QTI_STANDARD_ACCESS_FEATURES,
): string[] {
	return Object.values(QTI_STANDARD_ACCESS_FEATURES[category]);
}
