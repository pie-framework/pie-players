export {
	UNIVERSAL_SUPPORTS_PRESET,
	createUniversalPersonalNeedsProfile,
} from "./universal-supports.js";

// The packaged capability set: which capabilities exist in a deployment.
export type {
	PackagedToolRegistryOptions,
	RegisterPackagedToolsOptions,
} from "./packaged-tool-registry.js";
export {
	createPackagedToolRegistry,
	PACKAGED_TOOL_ORDER,
	PACKAGED_TOOL_REGISTRATIONS,
	registerPackagedTools,
} from "./packaged-tool-registry.js";
export { PACKAGED_TOOL_TAG_MAP } from "./tool-tag-map.js";
export {
	PACKAGED_TOOL_PLACEMENT,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "./tool-placement.js";

// Individual registrations, for a host composing a subset rather than the whole
// packaged set.
export {
	annotationToolbarRegistration,
	lineReaderToolRegistration,
	themeToolRegistration,
} from "./registrations/accessibility-tools.js";
export {
	AUDIO_TRANSCRIPT_FEATURE_ID,
	AUDIO_TRANSCRIPT_REGION_CLASS,
	AUDIO_TRANSCRIPT_REGION_LABEL,
	audioTranscriptRegistration,
	resolveAudioTranscript,
	type ResolvedAudioTranscript,
} from "./registrations/audio-transcript.js";
export { calculatorToolRegistration } from "./registrations/calculator.js";
export {
	answerEliminatorToolRegistration,
	highlighterToolRegistration,
} from "./registrations/interaction-tools.js";
export {
	protractorToolRegistration,
	rulerToolRegistration,
} from "./registrations/measurement-tools.js";
export {
	graphToolRegistration,
	periodicTableToolRegistration,
} from "./registrations/subject-specific-tools.js";
export { ttsToolRegistration } from "./registrations/tts.js";

export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolRegistryLike {
	setToolModuleLoaders(
		loaders: Partial<Record<string, ToolModuleLoader>>,
	): void;
}

const loadSideEffectModule = (load: () => Promise<unknown>): Promise<void> =>
	load().then(() => undefined);

function loadCalculatorModule(): Promise<unknown> {
	if (
		typeof globalThis !== "undefined" &&
		"customElements" in globalThis &&
		globalThis.customElements?.get("pie-tool-calculator")
	) {
		return Promise.resolve();
	}
	return loadSideEffectModule(
		() => import("@pie-players/pie-tool-calculator-desmos"),
	);
}

export const SECTION_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	calculator: loadCalculatorModule,
	graph: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-graph")),
	periodicTable: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-periodic-table")),
	ruler: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-ruler")),
	protractor: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-protractor")),
	lineReader: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-line-reader")),
};

export const ITEM_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	calculator: loadCalculatorModule,
	textToSpeech: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-tts-inline")),
	answerEliminator: () =>
		loadSideEffectModule(
			() => import("@pie-players/pie-tool-answer-eliminator"),
		),
	highlighter: () =>
		loadSideEffectModule(
			() => import("@pie-players/pie-tool-annotation-toolbar"),
		),
	annotationToolbar: () =>
		loadSideEffectModule(
			() => import("@pie-players/pie-tool-annotation-toolbar"),
		),
	theme: () =>
		loadSideEffectModule(() => import("@pie-players/pie-tool-theme")),
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
