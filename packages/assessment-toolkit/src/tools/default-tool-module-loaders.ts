import type { ToolModuleLoader } from "../services/ToolRegistry.js";

const loadSideEffectModule = (
	load: () => Promise<unknown>,
): Promise<void> => load().then(() => undefined);

const CALCULATOR_TOOL_MODULE_ID: string =
	"@pie-players/pie-tool-calculator-desmos";
const TTS_TOOL_MODULE_ID: string = "@pie-players/pie-tool-text-to-speech";
const TTS_INLINE_TOOL_MODULE_ID: string = "@pie-players/pie-tool-tts-inline";

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
	return loadSideEffectModule(() => import(CALCULATOR_TOOL_MODULE_ID));
}

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	// Keep toolkit defaults limited to broadly expected modules.
	// Hosts can register additional optional tool loaders as needed.
	calculator: loadCalculatorModule,
	textToSpeech: () =>
		Promise.all([
			loadSideEffectModule(() => import(TTS_TOOL_MODULE_ID)),
			loadSideEffectModule(() => import(TTS_INLINE_TOOL_MODULE_ID)),
		]).then(() => undefined),
};
