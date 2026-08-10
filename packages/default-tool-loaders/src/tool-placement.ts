import type { ToolPlacementConfig } from "@pie-players/pie-assessment-toolkit/tools/internal";

/**
 * Placement presets for the packaged capability set.
 *
 * Composition data for the same reason the tag map and the registrations are:
 * they name capabilities. The toolkit keeps `DEFAULT_TOOL_PLACEMENT`, which is
 * empty at every level and names none.
 */

/**
 * Every packaged capability at every level it supports. Prefer explicit host
 * configuration over adopting this wholesale.
 */
export const PACKAGED_TOOL_PLACEMENT = {
	assessment: ["theme"],
	section: ["theme"],
	item: [
		"textToSpeech",
		"highlighter",
		"annotationToolbar",
		"graph",
		"periodicTable",
	],
	passage: ["textToSpeech", "highlighter", "annotationToolbar", "lineReader"],
	rubric: ["textToSpeech", "highlighter", "annotationToolbar", "lineReader"],
	element: [
		"calculator",
		"answerEliminator",
		"textToSpeech",
		"ruler",
		"protractor",
		"highlighter",
		"annotationToolbar",
		"graph",
		"periodicTable",
	],
} as const;

/**
 * Each packaged capability once, at its usual assessment surface. Not
 * exhaustive: `supportedLevels` still bounds where a capability can run, and a
 * host can place them differently for its own UX.
 */
export const SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT = {
	section: [
		"theme",
		"graph",
		"periodicTable",
		"lineReader",
		"ruler",
		"protractor",
	],
	item: ["calculator", "textToSpeech", "answerEliminator", "annotationToolbar"],
	passage: ["textToSpeech", "annotationToolbar"],
} satisfies ToolPlacementConfig;
