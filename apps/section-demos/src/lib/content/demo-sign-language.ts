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
 * Three authoring paths reach the same region. The first item authors the video
 * inline via `data-sign-language`, which the runtime extractor lifts into a
 * catalog card (the signing counterpart of `<speak>` SSML). The third authors the
 * card directly on `accessibilityCatalogs`, the shape an importer writes. The
 * fourth is not authored at all — it is real importer output, committed verbatim,
 * so the demo shows what an import actually produces rather than what we believe
 * it produces.
 *
 * The bundled clip is a real ASL recording but it does not sign these prompts —
 * it stands in for a translation so playback is exercisable. See
 * `static/demo-assets/sign-language/README.md` for its provenance and why a
 * stand-in is the honest option.
 */

const POSTER = "/demo-assets/sign-language/signing-poster.svg";
const CLIP = "/demo-assets/sign-language/cdc-asl-handwashing.webm";
/**
 * WebM, not MP4, and deliberately: Playwright's bundled Chromium ships without
 * H.264, so an MP4 here would render a `<video>` that never loads in the very
 * test that asserts playback.
 */
const CLIP_TYPE = "video/webm";

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
						`<source src="${CLIP}" type="${CLIP_TYPE}"></video></div>`,
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
						// No `content`: the payload is the content. No `signLang`
						// either — the card's `language` is what resolution selects
						// on, and it already says `ase`.
						payload: {
							media: {
								version: 1 as const,
								id: "asl-q3-prompt-media",
								kind: "video" as const,
								sources: [{ src: CLIP, type: CLIP_TYPE }],
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

// --- PIE-881 integration proof, committed ------------------------------------
// Not authored here: the verbatim output of pie-api-aws' `mapLearnosityItemToPieItem`
// for `packages/transform/test/items/asl-signlanguage-synthetic-ly.json`. Retyping
// it by hand would prove only that we can write the shape we believe the importer
// writes, which is the belief under test.
//
// The source Learnosity item is synthetic — invented question, public-domain
// signing clip — precisely so this fixture can be committed. Its bank-item
// counterpart below cannot be. Regenerate after any transform change:
//
//   node -e 'const{readFileSync,writeFileSync}=require("fs"),{mapLearnosityItemToPieItem}=require("./packages/transform/dist");
//   writeFileSync(process.argv[1],JSON.stringify(mapLearnosityItemToPieItem(JSON.parse(readFileSync(
//   "packages/transform/test/items/asl-signlanguage-synthetic-ly.json","utf8"))),null,2)+"\n")' <path to this file>
import importedDemoItem from "./asl-imported-demo-item.json";

// Cast because a JSON import widens every literal: `catalog: "sign-language"`
// arrives as `string`, `kind: "video"` as `string`, `version: 1` as `number`.
// The values are right — `map-sign-language-synthetic.unit.spec.ts` asserts them
// in the repo that produces the file — so narrowing here would only restate them
// in a second place that could disagree.
const importedDemoItemRef = {
	identifier: "asl-imported-demo",
	required: true,
	item: {
		...importedDemoItem,
		baseId: importedDemoItem.id,
		version: { major: 1, minor: 0, patch: 0 },
	},
} as NonNullable<AssessmentSection["assessmentItemRefs"]>[number];

// --- PIE-881 integration proof against a real bank item, present only locally -
// The unmodified output of pie-api-aws' ly-pie transform for a real ASL item
// (Learnosity reference 88b0df8a-…_v2.0, KAS dbid 46807582): a model-level
// `accessibilityCatalogs` sign-language card, the signing video removed from the
// prompt, and a `data-catalog-idref` docking node in its place. Imported verbatim
// rather than retyped, so what renders is exactly what the importer writes.
//
// That item carries live secure content and its correct answer, so it is
// gitignored and absent from a clean checkout. Hence a glob rather than a static
// import: a missing file yields no refs instead of breaking the build for
// everyone, which is what a static import of an uncommitted file would do to
// `bun run check`, the section-demos build, and every section-player e2e spec.
const importedAslModules = import.meta.glob<{
	default: Record<string, unknown>;
}>("./pie881-imported-asl-item.json", { eager: true });

const importedItemRefs = Object.values(importedAslModules).map(
	({ default: item }) => ({
		identifier: "pie881-imported",
		required: true,
		item: {
			...item,
			baseId: item.id,
			version: { major: 1, minor: 0, patch: 0 },
			name: "PIE-881: imported from Learnosity",
		},
	}),
) as NonNullable<AssessmentSection["assessmentItemRefs"]>;

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
	assessmentItemRefs: [
		inlineSigningItem,
		noSigningItem,
		authoredCardItem,
		importedDemoItemRef,
		...importedItemRefs,
	],
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
	assessmentItemRefs: [
		inlineSigningItem,
		noSigningItem,
		authoredCardItem,
		importedDemoItemRef,
		...importedItemRefs,
	],
};
