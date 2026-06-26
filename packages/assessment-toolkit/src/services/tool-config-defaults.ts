import type { ToolPlacementConfig } from "./tools-config-normalizer.js";

export const DEFAULT_TOOL_PLACEMENT = {
	assessment: [],
	section: [],
	item: [],
	passage: [],
	rubric: [],
	element: [],
} as const;

/**
 * Complete placement preset for hosts that want to enable all packaged tools.
 * Prefer explicit host configuration over implicit defaults.
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
 * Opt-in section-player placement preset for hosts that want to expose every
 * packaged tool once at its normal assessment surface. This is not exhaustive:
 * `supportedLevels` still defines where tools can run, and hosts can still
 * choose different placement for custom UX.
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
