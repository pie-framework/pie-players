import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Read-Aloud Accommodations: suppression and recorded audio
 *
 * Four items, each showing one thing read-aloud does beyond synthesizing the
 * visible text:
 *
 *   1. **Suppressed word** — `data-tts-suppress="all"` on one word. Read-aloud
 *      speaks the rest of the prompt and withholds that word, because the item
 *      measures whether the candidate can read it. Say it and the item is
 *      answered for them.
 *   2. **Recorded prompt** — a `spoken` card whose payload is an audio file
 *      instead of a script. The clip plays and the prompt highlights as a block,
 *      since a recording emits no word boundaries.
 *   3. **Recording plus script** — both cards on one node, in one language.
 *      APIP's pattern, which QTI's migration guidance keeps. The recording wins;
 *      the script is what the recording was made from and its fallback.
 *   4. **Recording that will not load** — item 3's shape with a URL that 404s,
 *      so the fallback is observable rather than theoretical. Read-aloud speaks
 *      the script.
 *
 * Two things worth trying by hand, because neither is visible from the page:
 *
 *   - Select the suppressed word and use the annotation toolbar's read-aloud.
 *     It refuses. That path hands `range.toString()` straight to the provider
 *     and consults no catalog, so a filter applied only to the DOM walk would
 *     have left selecting the word as a two-click way around the guard.
 *   - Watch the console on item 4. The fallback says why it fell back.
 *
 * The narration clips are macOS `say` output, not human recordings — see
 * `static/demo-assets/read-aloud/README.md`. They prove the file-playback path,
 * not the fidelity of anyone's narration.
 */

const NARRATION_PHOTOSYNTHESIS =
	"/demo-assets/read-aloud/photosynthesis-prompt.wav";
const NARRATION_CHLOROPLAST = "/demo-assets/read-aloud/chloroplast-prompt.wav";
/** Deliberately absent, so item 4 exercises the fallback rather than describing it. */
const NARRATION_MISSING = "/demo-assets/read-aloud/missing-on-purpose.wav";
const NARRATION_TYPE = "audio/wav";

/**
 * WAV, and deliberately: Playwright's bundled Chromium ships without the
 * proprietary codecs, so an MP3 or AAC clip here would be a file the very test
 * that asserts playback could never decode. The same reason the signing demo
 * bundles WebM rather than MP4.
 */
const audioCard = (src: string) => ({
	catalog: "spoken",
	language: "en-US",
	// No `content`: on this card the payload *is* the content.
	payload: {
		media: {
			version: 1 as const,
			id: `${src}-media`,
			kind: "audio" as const,
			sources: [{ src, type: NARRATION_TYPE }],
			label: "Recorded prompt",
			lang: "en-US",
		},
	},
});

const suppressedWordItem = {
	identifier: "read-aloud-suppressed",
	required: true,
	item: {
		id: "read-aloud-suppressed",
		name: "Suppressed word",
		baseId: "read-aloud-suppressed",
		version: { major: 1, minor: 0, patch: 0 },
		config: {
			markup: '<multiple-choice id="ra-q1"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "ra-q1",
					element: "multiple-choice",
					// The candidate hears "Which word rhymes with ?" and has to read the
					// one word that decides the answer. Read-aloud still carries the
					// directions and the options, which is the part suppression must not
					// take away — an item-level read-aloud switch would have.
					prompt:
						'<p>Which word rhymes with <strong data-tts-suppress="all">cake</strong>?</p>',
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "bake", correct: true },
						{ value: "b", label: "cat", correct: false },
						{ value: "c", label: "sun", correct: false },
					],
				},
			],
		},
	},
};

const recordedPromptItem = {
	identifier: "read-aloud-recorded",
	required: true,
	item: {
		id: "read-aloud-recorded",
		name: "Recorded prompt",
		baseId: "read-aloud-recorded",
		version: { major: 1, minor: 0, patch: 0 },
		accessibilityCatalogs: [
			{
				identifier: "ra-q2-prompt",
				cards: [audioCard(NARRATION_PHOTOSYNTHESIS)],
			},
		],
		config: {
			markup: '<multiple-choice id="ra-q2"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "ra-q2",
					element: "multiple-choice",
					prompt:
						'<p data-catalog-idref="ra-q2-prompt">A plant absorbs carbon dioxide and releases oxygen. What is this process called?</p>',
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "Respiration", correct: false },
						{ value: "b", label: "Photosynthesis", correct: true },
						{ value: "c", label: "Transpiration", correct: false },
					],
				},
			],
		},
	},
};

const recordingAndScriptItem = {
	identifier: "read-aloud-recorded-and-script",
	required: true,
	item: {
		id: "read-aloud-recorded-and-script",
		name: "Recording plus script",
		baseId: "read-aloud-recorded-and-script",
		version: { major: 1, minor: 0, patch: 0 },
		accessibilityCatalogs: [
			{
				identifier: "ra-q3-prompt",
				// Two cards, same type, same language. Distinguished only by which slot
				// each fills, which is enough — a card carries exactly one of `content`
				// or `payload`. Resolution prefers the recording; nothing here has to
				// say so.
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content:
							"<speak>Where in a plant cell does photosynthesis mainly happen?</speak>",
					},
					audioCard(NARRATION_CHLOROPLAST),
				],
			},
		],
		config: {
			markup: '<multiple-choice id="ra-q3"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "ra-q3",
					element: "multiple-choice",
					prompt:
						'<p data-catalog-idref="ra-q3-prompt">Where in a plant cell does photosynthesis mainly happen?</p>',
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "Chloroplast", correct: true },
						{ value: "b", label: "Nucleus", correct: false },
						{ value: "c", label: "Ribosome", correct: false },
					],
				},
			],
		},
	},
};

const failingRecordingItem = {
	identifier: "read-aloud-recorded-fallback",
	required: true,
	item: {
		id: "read-aloud-recorded-fallback",
		name: "Recording that will not load",
		baseId: "read-aloud-recorded-fallback",
		version: { major: 1, minor: 0, patch: 0 },
		accessibilityCatalogs: [
			{
				identifier: "ra-q4-prompt",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content:
							"<speak>Which part of a plant takes in water from the soil?</speak>",
					},
					// A URL that is not there on purpose. This is the case the script
					// exists for: silence on a read-aloud node is the one outcome a
					// candidate cannot report and nobody else can see.
					audioCard(NARRATION_MISSING),
				],
			},
		],
		config: {
			markup: '<multiple-choice id="ra-q4"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "ra-q4",
					element: "multiple-choice",
					prompt:
						'<p data-catalog-idref="ra-q4-prompt">Which part of a plant takes in water from the soil?</p>',
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "Roots", correct: true },
						{ value: "b", label: "Petals", correct: false },
						{ value: "c", label: "Stem", correct: false },
					],
				},
			],
		},
	},
};

export const demoReadAloudAccommodationsSection: AssessmentSection = {
	identifier: "demo-read-aloud-accommodations",
	title: "Read-Aloud: suppression and recorded audio",
	keepTogether: true,
	assessmentItemRefs: [
		suppressedWordItem,
		recordedPromptItem,
		recordingAndScriptItem,
		failingRecordingItem,
	],
};
