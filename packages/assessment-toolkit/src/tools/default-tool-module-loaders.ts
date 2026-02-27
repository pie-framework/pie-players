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
	textToSpeech: () => importToolModule("@pie-players/pie-tool-tts-inline"),
	answerEliminator: () =>
		importToolModule("@pie-players/pie-tool-answer-eliminator"),
	calculator: async () => {
		await Promise.all([
			importToolModule("@pie-players/pie-tool-calculator-inline"),
			importToolModule("@pie-players/pie-tool-calculator"),
		]);
	},
};

function importToolModule(specifier: string): Promise<unknown> {
	// Keep tool modules optional at toolkit build time; consumers decide which
	// tool packages to install and register.
	return import(/* @vite-ignore */ specifier);
}
