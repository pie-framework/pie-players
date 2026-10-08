import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Shadow reading: authored content that renders into an open shadow root.
 *
 * Each item's markup holds a `data-demo-shadow-reading` host, which the demo
 * page gives an open shadow root (see `demo-runtime/shadow-reading-roots.ts`):
 *
 *   1. **Reading** — light text around the host, and inside its shadow root
 *      plain text, a span docked to a `spoken` catalog card, native MathML and
 *      a slot holding the host's light child. Read-aloud speaks all of it in
 *      rendering order and highlights the shadow text.
 *   2. **Language** — the host carries `lang="es-MX"`, and its docked span has
 *      an `en-US` and an `es-MX` card. Read-aloud picks the Spanish one, and a
 *      selection read through the annotation toolbar is spoken as `es-MX`.
 *   3. **Math** — native MathML alone in a shadow root. With no docked span in
 *      the item, read-aloud generates the math's speech; item 1's math is read as
 *      its text, because an item with a docked span is composed from its text and
 *      cards.
 */

const readingItem = {
	identifier: "shadow-reading-content",
	required: true,
	item: {
		id: "shadow-reading-content",
		name: "Shadow root content",
		baseId: "shadow-reading-content",
		version: { major: 1, minor: 0, patch: 0 },
		accessibilityCatalogs: [
			{
				identifier: "shadow-reading-span",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "<speak>the catalog alternate</speak>",
					},
				],
			},
		],
		config: {
			markup:
				'<p>Light text before the shadow host.</p><div data-demo-shadow-reading="reading"><em>Slotted light words.</em></div><p>Light text after the shadow host.</p>',
			elements: {},
			models: [],
		},
	},
};

const languageItem = {
	identifier: "shadow-reading-language",
	required: true,
	item: {
		id: "shadow-reading-language",
		name: "Shadow root content in Spanish",
		baseId: "shadow-reading-language",
		version: { major: 1, minor: 0, patch: 0 },
		accessibilityCatalogs: [
			{
				identifier: "shadow-reading-spanish-span",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "<speak>the English alternate</speak>",
					},
					{
						catalog: "spoken",
						language: "es-MX",
						content: "<speak>la alternativa en español</speak>",
					},
				],
			},
		],
		config: {
			markup:
				'<p>The next sentence is in Spanish.</p><div data-demo-shadow-reading="spanish" lang="es-MX"></div>',
			elements: {},
			models: [],
		},
	},
};

const mathItem = {
	identifier: "shadow-reading-math",
	required: true,
	item: {
		id: "shadow-reading-math",
		name: "Shadow root math",
		baseId: "shadow-reading-math",
		version: { major: 1, minor: 0, patch: 0 },
		config: {
			markup:
				'<p>The math below renders in a shadow root.</p><div data-demo-shadow-reading="math"></div>',
			elements: {},
			models: [],
		},
	},
};

export const demoShadowReadingSection: AssessmentSection = {
	identifier: "demo-shadow-reading",
	title: "Read-aloud and annotation in shadow roots",
	keepTogether: true,
	assessmentItemRefs: [readingItem, languageItem, mathItem],
};
