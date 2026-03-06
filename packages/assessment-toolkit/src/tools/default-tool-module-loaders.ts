import type { ToolModuleLoader } from "../services/ToolRegistry.js";

/**
 * Default lazy module loaders for built-in tools.
 *
 * Keeping this map near tool registrations avoids hard-coding module imports
 * in runtime components.
 */
function loadCalculatorModule(): Promise<unknown> {
	if (
		typeof globalThis !== "undefined" &&
		"customElements" in globalThis &&
		globalThis.customElements?.get("pie-tool-calculator")
	) {
		return Promise.resolve();
	}
	return import("@pie-players/pie-tool-calculator");
}

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	// Common tools
	calculator: loadCalculatorModule,
	textToSpeech: () => import("@pie-players/pie-tool-text-to-speech"),
	answerEliminator: () => import("@pie-players/pie-tool-answer-eliminator"),
	highlighter: () => import("@pie-players/pie-tool-annotation-toolbar"),
	annotationToolbar: () => import("@pie-players/pie-tool-annotation-toolbar"),
	theme: () => import("@pie-players/pie-tool-theme"),
	colorScheme: () => import("@pie-players/pie-tool-theme"),
	// Section/floating tools
	graph: () => import("@pie-players/pie-tool-graph"),
	periodicTable: () => import("@pie-players/pie-tool-periodic-table"),
	ruler: () => import("@pie-players/pie-tool-ruler"),
	protractor: () => import("@pie-players/pie-tool-protractor"),
	lineReader: () => import("@pie-players/pie-tool-line-reader"),
};
