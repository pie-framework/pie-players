export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolRegistryLike {
	setToolModuleLoaders(loaders: Partial<Record<string, ToolModuleLoader>>): void;
}

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

export const SECTION_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	calculator: loadCalculatorModule,
	graph: () => import("@pie-players/pie-tool-graph"),
	periodicTable: () => import("@pie-players/pie-tool-periodic-table"),
	ruler: () => import("@pie-players/pie-tool-ruler"),
	protractor: () => import("@pie-players/pie-tool-protractor"),
	lineReader: () => import("@pie-players/pie-tool-line-reader"),
};

export const ITEM_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	calculator: loadCalculatorModule,
	textToSpeech: () => import("@pie-players/pie-tool-text-to-speech"),
	answerEliminator: () => import("@pie-players/pie-tool-answer-eliminator"),
	highlighter: () => import("@pie-players/pie-tool-annotation-toolbar"),
	annotationToolbar: () => import("@pie-players/pie-tool-annotation-toolbar"),
	colorScheme: () => import("@pie-players/pie-tool-color-scheme"),
};

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	...ITEM_TOOL_MODULE_LOADERS,
	...SECTION_TOOL_MODULE_LOADERS,
};

export type RegisterDefaultToolModuleLoadersOptions = {
	loaders?: Partial<Record<string, ToolModuleLoader>>;
};

/**
 * Register built-in lazy module loaders on a registry.
 * Hosts can override or extend the defaults via options.loaders.
 */
export function registerDefaultToolModuleLoaders(
	registry: ToolRegistryLike,
	options: RegisterDefaultToolModuleLoadersOptions = {},
): void {
	registry.setToolModuleLoaders({
		...DEFAULT_TOOL_MODULE_LOADERS,
		...(options.loaders || {}),
	});
}

export function registerSectionToolModuleLoaders(
	registry: ToolRegistryLike,
	options: RegisterDefaultToolModuleLoadersOptions = {},
): void {
	registry.setToolModuleLoaders({
		...SECTION_TOOL_MODULE_LOADERS,
		...(options.loaders || {}),
	});
}
