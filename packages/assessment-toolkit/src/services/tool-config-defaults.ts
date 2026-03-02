export const DEFAULT_TOOL_ALIAS_MAP = {
	tts: "textToSpeech",
} as const;

export const DEFAULT_TOOL_PLACEMENT = {
	assessment: ["colorScheme"],
	section: ["colorScheme", "textToSpeech"],
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

export type CanonicalToolIdAlias = keyof typeof DEFAULT_TOOL_ALIAS_MAP;
