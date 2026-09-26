import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

export const MC_POPULATED_BLANK_PACKAGE = "@pie-element/mc-populated-blank";
/**
 * The route registers the installed package under this version, so it equals
 * the exact version section-demos depends on.
 */
export const MC_POPULATED_BLANK_VERSION = "0.3.0-next.16";

export const demoPreloadedBundledElementsSection: AssessmentSection = {
	identifier: "preloaded-bundled-elements",
	title: "Preloaded Bundled Elements",
	keepTogether: true,
	assessmentItemRefs: [
		{
			identifier: "bundled-populated-blank-ref",
			required: true,
			item: {
				id: "bundled-populated-blank",
				name: "Populated blank from a bundled ng element",
				baseId: "bundled-populated-blank",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<mc-populated-blank id="populated-blank"></mc-populated-blank>',
					elements: {
						"mc-populated-blank": `${MC_POPULATED_BLANK_PACKAGE}@${MC_POPULATED_BLANK_VERSION}`,
					},
					models: [
						{
							id: "populated-blank",
							element: "mc-populated-blank",
							prompt: "<p>Choose the word that completes the sentence.</p>",
							promptEnabled: true,
							interactionMode: "populate_blank",
							layoutProfile: "inline_sentence",
							choiceLayout: "vertical",
							template: "<p>He will heat up the water in the {{blank}}.</p>",
							choiceMode: "text",
							choices: [
								{ id: "teapot", labelHtml: "teapot" },
								{ id: "flytrap", labelHtml: "flytrap" },
								{ id: "coffee", labelHtml: "coffee" },
								{ id: "freezer", labelHtml: "freezer" },
							],
							correctChoiceId: "teapot",
							hasAudio: false,
							lockChoiceOrder: true,
						},
					],
				},
			},
		},
	],
};
