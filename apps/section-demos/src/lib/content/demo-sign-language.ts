import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Sign Language (ASL) Region
 *
 * Availability has two independent halves and both are required: the item must
 * carry a matching `sign-language` catalog card, *and* policy must grant the
 * `signLanguage` PNP support. The two pages here vary one half each so the
 * difference is visible side by side:
 *
 *   - "Signing granted"  — PNP grants `signLanguage`. The first item carries an
 *     inline signing video and shows the media region; the second carries none
 *     and shows nothing, because an affordance where no content exists is a dead
 *     affordance.
 *   - "Signing not granted" — same content, no grant. Neither item shows the
 *     region, and the signing video is not visible as item content either: in
 *     PIE the video is an accommodation the toolkit gates, not unconditional
 *     item content.
 *
 * The first item authors the video inline via `data-sign-language`, which the
 * runtime extractor lifts into a catalog card (the signing counterpart of
 * `<speak>` SSML). The third item authors the card directly on
 * `accessibilityCatalogs`, the shape an importer writes. Both paths land in the
 * same region.
 *
 * No signing clip is bundled — see
 * `static/demo-assets/sign-language/README.md`. PIE does not own ASL video
 * production or storage, so the demo ships a poster explaining what a host
 * supplies here.
 */

const POSTER = "/demo-assets/sign-language/signing-poster.svg";
const CLIP = "/demo-assets/sign-language/sample-asl.mp4";

const inlineSigningItem = {
	identifier: "asl-q1-inline",
	required: true,
	item: {
		id: "asl-q1-inline",
		name: "Inline signing markup",
		baseId: "asl-q1-inline",
		version: { major: 1, minor: 0, patch: 0 },
		config: {
			markup: '<multiple-choice id="asl-q1"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "asl-q1",
					element: "multiple-choice",
					prompt:
						`<div><p>A plant absorbs carbon dioxide and releases oxygen. What process is this?</p>` +
						`<video data-sign-language="ase" poster="${POSTER}">` +
						`<source src="${CLIP}" type="video/mp4"></video></div>`,
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

const noSigningItem = {
	identifier: "asl-q2-none",
	required: true,
	item: {
		id: "asl-q2-none",
		name: "No signing content",
		baseId: "asl-q2-none",
		version: { major: 1, minor: 0, patch: 0 },
		config: {
			markup: '<multiple-choice id="asl-q2"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "asl-q2",
					element: "multiple-choice",
					prompt: "Which gas do plants take in during photosynthesis?",
					choiceMode: "radio",
					choices: [
						{ value: "a", label: "Carbon dioxide", correct: true },
						{ value: "b", label: "Helium", correct: false },
						{ value: "c", label: "Argon", correct: false },
					],
				},
			],
		},
	},
};

const authoredCardItem = {
	identifier: "asl-q3-authored",
	required: true,
	item: {
		id: "asl-q3-authored",
		name: "Authored catalog card",
		baseId: "asl-q3-authored",
		version: { major: 1, minor: 0, patch: 0 },
		// The shape an importer writes: a typed payload on the item's own
		// catalogs, docked to the prompt via `data-catalog-idref`.
		accessibilityCatalogs: [
			{
				identifier: "asl-q3-prompt",
				cards: [
					{
						catalog: "sign-language",
						language: "ase",
						content: CLIP,
						payload: {
							kind: "sign-language" as const,
							signLang: "ase",
							media: {
								version: 1 as const,
								id: "asl-q3-prompt-media",
								kind: "video" as const,
								sources: [{ src: CLIP, type: "video/mp4" }],
								poster: POSTER,
								label: "Signed prompt",
								lang: "ase",
							},
						},
					},
				],
			},
		],
		config: {
			markup: '<multiple-choice id="asl-q3"></multiple-choice>',
			elements: {
				"multiple-choice": "@pie-element/multiple-choice@latest",
			},
			models: [
				{
					id: "asl-q3",
					element: "multiple-choice",
					prompt:
						'<p data-catalog-idref="asl-q3-prompt">Where in a plant cell does photosynthesis mainly happen?</p>',
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

export const demoSignLanguageGrantedSection: AssessmentSection = {
	identifier: "demo-sign-language-granted",
	title: "Sign Language: signing granted",
	keepTogether: true,
	// Signing is an accommodation, so it is excluded from the computed default
	// profile and has to be granted deliberately — as here.
	personalNeedsProfile: {
		supports: ["signLanguage"],
		prohibitedSupports: [],
		activateAtInit: [],
	},
	assessmentItemRefs: [inlineSigningItem, noSigningItem, authoredCardItem],
};

export const demoSignLanguageNotGrantedSection: AssessmentSection = {
	identifier: "demo-sign-language-not-granted",
	title: "Sign Language: signing not granted",
	keepTogether: true,
	personalNeedsProfile: {
		supports: [],
		prohibitedSupports: [],
		activateAtInit: [],
	},
	assessmentItemRefs: [inlineSigningItem, noSigningItem, authoredCardItem],
};
