import categorizeManifest from "@pie-element/categorize/package.json";
import dragInTheBlankManifest from "@pie-element/drag-in-the-blank/package.json";
import ebsrManifest from "@pie-element/ebsr/package.json";
import hotspotManifest from "@pie-element/hotspot/package.json";
import imageClozeAssociationManifest from "@pie-element/image-cloze-association/package.json";
import mcPopulatedBlankManifest from "@pie-element/mc-populated-blank/package.json";
import multipleChoiceManifest from "@pie-element/multiple-choice/package.json";
import passageManifest from "@pie-element/passage/package.json";
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
/**
 * Models from pie-elements-ng's `apps/element-demo/src/lib/samples/*.json`
 * (f5772f42), with two edits: image-cloze-association's
 * `metadatadistractor_rationale` is dropped, as it points at
 * `https://localhost:8443`, and drag-in-the-blank `math-equations` closes each
 * `\(...\)` before its blank, since a drop zone inside a formula splits the TeX
 * and leaves it untypeset.
 */
import samples from "./demo-preloaded-npm-elements-samples.json";

/**
 * Every element the generated `@pie-players/pie-preloaded-player` builds
 * carried (the union of `configs/preloaded-player/*.json`), under the base tag
 * those configs register it with. Each version is the installed package's, or
 * the local pie-elements-ng checkout's under `dev:cdn`.
 */
export const PRELOADED_NPM_PACKAGES = {
	categorize: {
		package: "@pie-element/categorize",
		tag: "pie-element-categorize",
		version: categorizeManifest.version,
	},
	dragInTheBlank: {
		package: "@pie-element/drag-in-the-blank",
		tag: "drag-in-the-blank",
		version: dragInTheBlankManifest.version,
	},
	hotspot: {
		package: "@pie-element/hotspot",
		tag: "hotspot",
		version: hotspotManifest.version,
	},
	imageClozeAssociation: {
		package: "@pie-element/image-cloze-association",
		tag: "image-cloze-association",
		version: imageClozeAssociationManifest.version,
	},
	multipleChoice: {
		package: "@pie-element/multiple-choice",
		tag: "pie-element-multiple-choice",
		version: multipleChoiceManifest.version,
	},
	mcPopulatedBlank: {
		package: "@pie-element/mc-populated-blank",
		tag: "mc-populated-blank",
		version: mcPopulatedBlankManifest.version,
	},
	passage: {
		package: "@pie-element/passage",
		tag: "pie-element-passage",
		version: passageManifest.version,
	},
	ebsr: {
		package: "@pie-element/ebsr",
		tag: "pie-esbr",
		version: ebsrManifest.version,
	},
} as const;

type PackageKey = keyof typeof PRELOADED_NPM_PACKAGES;

const registeredSpec = (key: PackageKey) =>
	`${PRELOADED_NPM_PACKAGES[key].package}@${PRELOADED_NPM_PACKAGES[key].version}`;

/**
 * Content authored at versions other than the registered one: the
 * knowledge-checks set's (older) and the star-0326 set's (a release above
 * pie-elements-ng's `next` line). The players align both to the registration.
 */
export const OLDER_CATEGORIZE_SPEC = "@pie-element/categorize@11.3.2";
export const NEWER_DRAG_IN_THE_BLANK_SPEC = "@pie-element/drag-in-the-blank@10.2.5";
/** A base tag other than the registered `pie-element-multiple-choice`. */
export const OTHER_MULTIPLE_CHOICE_TAG = "multiple-choice";

type SampleKey = keyof typeof samples;

/** One item holding one element, its model the pie-elements-ng demo sample. */
function sampleItem(args: {
	id: string;
	name: string;
	sample: SampleKey;
	tag: string;
	spec: string;
}): NonNullable<AssessmentSection["assessmentItemRefs"]>[number] {
	const elementId = `${args.id}-element`;
	return {
		identifier: `${args.id}-ref`,
		required: true,
		item: {
			id: args.id,
			name: args.name,
			baseId: args.id,
			version: { major: 1, minor: 0, patch: 0 },
			config: {
				markup: `<${args.tag} id="${elementId}"></${args.tag}>`,
				elements: { [args.tag]: args.spec },
				models: [{ ...samples[args.sample], id: elementId, element: args.tag }],
			},
		},
	};
}

const registered = (key: PackageKey, id: string, name: string, sample: SampleKey) =>
	sampleItem({
		id,
		name,
		sample,
		tag: PRELOADED_NPM_PACKAGES[key].tag,
		spec: registeredSpec(key),
	});

export const demoPreloadedNpmElementsSection: AssessmentSection = {
	identifier: "preloaded-npm-elements",
	title: "Preloaded npm Elements",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "npm-passage-block",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "npm-passage",
				name: "Passage from the installed ng package",
				baseId: "npm-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<${PRELOADED_NPM_PACKAGES.passage.tag} id="npm-passage-element"></${PRELOADED_NPM_PACKAGES.passage.tag}>`,
					elements: {
						[PRELOADED_NPM_PACKAGES.passage.tag]: registeredSpec("passage"),
					},
					models: [
						{
							...samples["passage/default"],
							id: "npm-passage-element",
							element: PRELOADED_NPM_PACKAGES.passage.tag,
						},
					],
				},
			},
		},
	],
	assessmentItemRefs: [
		registered("multipleChoice", "npm-multiple-choice", "Multiple choice with math", "multiple-choice/math-algebra-quadratic"),
		registered("ebsr", "npm-ebsr", "Evidence-based selected response", "ebsr/default"),
		registered("categorize", "npm-categorize", "Categorize with math", "categorize/math-equations"),
		registered("dragInTheBlank", "npm-drag-in-the-blank", "Drag in the blank", "drag-in-the-blank/basic-sentence"),
		registered("hotspot", "npm-hotspot", "Hotspot", "hotspot/default"),
		registered("imageClozeAssociation", "npm-image-cloze-association", "Image cloze association", "image-cloze-association/default"),
		registered("mcPopulatedBlank", "npm-mc-populated-blank", "Populated blank", "mc-populated-blank/variant-sr-vic"),
		sampleItem({
			id: "npm-other-base-tag",
			name: "Multiple choice authored under another base tag",
			sample: "multiple-choice/radio-simple",
			tag: OTHER_MULTIPLE_CHOICE_TAG,
			spec: registeredSpec("multipleChoice"),
		}),
		sampleItem({
			id: "npm-older-version",
			name: "Categorize authored at the knowledge-checks version",
			sample: "categorize/geometry-shapes",
			tag: PRELOADED_NPM_PACKAGES.categorize.tag,
			spec: OLDER_CATEGORIZE_SPEC,
		}),
		sampleItem({
			id: "npm-newer-version",
			name: "Drag in the blank authored at the star-0326 version",
			sample: "drag-in-the-blank/math-equations",
			tag: PRELOADED_NPM_PACKAGES.dragInTheBlank.tag,
			spec: NEWER_DRAG_IN_THE_BLANK_SPEC,
		}),
	],
};

/** The section a host navigates to, on the same section player element. */
export const demoPreloadedNpmElementsNextSection: AssessmentSection = {
	identifier: "preloaded-npm-elements-next",
	title: "Preloaded npm Elements: next section",
	keepTogether: true,
	assessmentItemRefs: [
		registered("multipleChoice", "npm-next-multiple-choice", "Multiple choice", "multiple-choice/radio-simple"),
	],
};

export const PRELOADED_NPM_SECTIONS = [
	demoPreloadedNpmElementsSection,
	demoPreloadedNpmElementsNextSection,
] as const;
