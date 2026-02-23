export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolRegistryLike {
	setToolModuleLoaders(loaders: Partial<Record<string, ToolModuleLoader>>): void;
}

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	calculator: () => import("@pie-players/pie-tool-calculator"),
	textToSpeech: () => import("@pie-players/pie-tool-text-to-speech"),
	answerEliminator: () => import("@pie-players/pie-tool-answer-eliminator"),
	highlighter: () => import("@pie-players/pie-tool-annotation-toolbar"),
	annotationToolbar: () => import("@pie-players/pie-tool-annotation-toolbar"),
	lineReader: () => import("@pie-players/pie-tool-line-reader"),
	magnifier: () => import("@pie-players/pie-tool-magnifier"),
	colorScheme: () => import("@pie-players/pie-tool-color-scheme"),
	graph: () => import("@pie-players/pie-tool-graph"),
	periodicTable: () => import("@pie-players/pie-tool-periodic-table"),
	ruler: () => import("@pie-players/pie-tool-ruler"),
	protractor: () => import("@pie-players/pie-tool-protractor"),
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
