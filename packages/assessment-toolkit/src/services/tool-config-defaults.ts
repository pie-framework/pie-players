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
	item: ["textToSpeech", "highlighter", "annotationToolbar", "graph", "periodicTable"],
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
