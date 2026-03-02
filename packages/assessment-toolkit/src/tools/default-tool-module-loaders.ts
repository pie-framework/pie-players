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
	textToSpeech: () => import("@pie-players/pie-tool-text-to-speech"),
	answerEliminator: () => import("@pie-players/pie-tool-answer-eliminator"),
	calculator: () => import("@pie-players/pie-tool-calculator"),
};
