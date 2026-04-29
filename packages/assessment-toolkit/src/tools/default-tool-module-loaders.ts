import type { ToolModuleLoader } from "../services/ToolRegistry.js";

const loadSideEffectModule = (
	load: () => Promise<unknown>,
): Promise<void> => load().then(() => undefined);

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
	return loadSideEffectModule(
		() =>
			// biome-ignore lint/suspicious/noTsIgnore: module is optional; @ts-expect-error would fail in workspace builds where the symlink resolves
			// @ts-ignore Optional host module may be absent from toolkit package deps.
			import("@pie-players/pie-tool-calculator-desmos"),
	);
}

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	// Keep toolkit defaults limited to broadly expected modules.
	// Hosts can register additional optional tool loaders as needed.
	calculator: loadCalculatorModule,
	textToSpeech: () =>
		loadSideEffectModule(
			() =>
				// biome-ignore lint/suspicious/noTsIgnore: module is optional; @ts-expect-error would fail in workspace builds where the symlink resolves
				// @ts-ignore Optional host module may be absent from toolkit package deps.
				import("@pie-players/pie-tool-tts-inline"),
		),
};
