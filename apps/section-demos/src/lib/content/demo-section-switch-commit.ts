import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Two single-item sections a host swaps on one section player element, the way
 * a host with its own section navigation does. The element is pinned to a
 * version that defers its `session-changed` behind a debounce and owns a
 * `commitPendingSession()`, which is the window a section switch lands in.
 */
function essaySection(
	identifier: string,
	title: string,
	itemId: string,
	prompt: string,
): AssessmentSection {
	return {
		identifier,
		title,
		keepTogether: true,
		rubricBlocks: [],
		assessmentItemRefs: [
			{
				identifier: `${itemId}-ref`,
				required: true,
				item: {
					id: itemId,
					name: title,
					baseId: itemId,
					version: { major: 1, minor: 0, patch: 0 },
					config: {
						markup: `<extended-text-entry id="${itemId}-ete"></extended-text-entry>`,
						elements: {
							"extended-text-entry": "@pie-element/extended-text-entry@15.2.5",
						},
						models: [
							{
								id: `${itemId}-ete`,
								element: "extended-text-entry",
								prompt: `<p>${prompt}</p>`,
								dimensions: { height: 120, width: 480 },
								equationEditor: "everything",
								mathInput: false,
								playersToolbarPosition: "bottom",
								predefinedAnnotations: [],
								rationaleEnabled: false,
								spellCheckEnabled: true,
								studentInstructionsEnabled: false,
								teacherInstructionsEnabled: false,
							},
						],
					},
				},
			},
		],
	} as unknown as AssessmentSection;
}

export const sectionSwitchCommitSectionOne = essaySection(
	"section-switch-one",
	"Section one",
	"section-switch-item-one",
	"Describe the first thing you noticed.",
);

export const sectionSwitchCommitSectionTwo = essaySection(
	"section-switch-two",
	"Section two",
	"section-switch-item-two",
	"Describe the second thing you noticed.",
);
