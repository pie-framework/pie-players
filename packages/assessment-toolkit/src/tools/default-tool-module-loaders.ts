import type { ToolModuleLoader } from "../services/ToolRegistry.js";

/**
 * Default lazy module loaders for built-in toolbar tools.
 *
 * Keeping this map near tool registrations avoids hard-coding module imports
 * in toolbar components.
 */
export const DEFAULT_TOOL_MODULE_LOADERS: Partial<
	Record<string, ToolModuleLoader>
> = {
	// Keep inline variants for toolbar-first UX in unified toolbars.
	textToSpeech: () => import("@pie-players/pie-tool-tts-inline"),
	answerEliminator: () => import("@pie-players/pie-tool-answer-eliminator"),
	calculator: async () => {
		await Promise.all([
			import("@pie-players/pie-tool-calculator-inline"),
			import("@pie-players/pie-tool-calculator"),
		]);
	},
};
