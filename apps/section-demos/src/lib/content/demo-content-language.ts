import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Content language: two language variants of one item in one section.
 *
 * Item 1 declares `language: "en"`. Item 2, its Spanish variant, declares
 * `language: "es"` and links its source through `isAdaptationOf`. Neither markup
 * carries `lang`. The section player narrows `env.locale` to each item's
 * declared language, so each player stamps its own `lang`, read-aloud speaks
 * each in its language, and an element scores each under it.
 */

const englishItem = {
	identifier: "content-language-en",
	required: true,
	item: {
		id: "content-language-en",
		name: "Boiling point",
		baseId: "content-language-boiling-point",
		version: { major: 1, minor: 0, patch: 0 },
		language: "en",
		config: {
			markup: "<p>Water boils at 100 degrees Celsius at sea level.</p>",
			elements: {},
			models: [],
		},
	},
};

const spanishItem = {
	identifier: "content-language-es",
	required: true,
	item: {
		id: "content-language-es",
		name: "Punto de ebullición",
		baseId: "content-language-boiling-point-es",
		version: { major: 1, minor: 0, patch: 0 },
		language: "es",
		isAdaptationOf: {
			baseId: "content-language-boiling-point",
			version: { major: 1, minor: 0, patch: 0 },
		},
		config: {
			markup: "<p>El agua hierve a 100 grados Celsius al nivel del mar.</p>",
			elements: {},
			models: [],
		},
	},
};

export const demoContentLanguageSection: AssessmentSection = {
	identifier: "demo-content-language",
	title: "Language variants in one section",
	keepTogether: true,
	assessmentItemRefs: [englishItem, spanishItem],
};
