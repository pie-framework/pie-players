// The packaged capability composition. These stable exports are all projections
// of one internal definition set; hosts keep the existing API while additions
// cannot drift between registration, tag, loader, placement and policy lists.
export type {
	PackagedToolRegistryOptions,
	RegisterDefaultToolModuleLoadersOptions,
	RegisterPackagedToolsOptions,
	ToolModuleLoader,
	ToolRegistryLike,
} from "./packaged-capability-composition.js";
export {
	createPackagedToolRegistry,
	createUniversalPersonalNeedsProfile,
	DEFAULT_TOOL_MODULE_LOADERS,
	ITEM_TOOL_MODULE_LOADERS,
	PACKAGED_TOOL_ORDER,
	PACKAGED_TOOL_PLACEMENT,
	PACKAGED_TOOL_REGISTRATIONS,
	PACKAGED_TOOL_TAG_MAP,
	registerDefaultToolModuleLoaders,
	registerPackagedTools,
	registerSectionToolModuleLoaders,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
	SECTION_TOOL_MODULE_LOADERS,
	UNIVERSAL_SUPPORTS_PRESET,
} from "./packaged-capability-composition.js";

// The authored-alternate subset, for a renderer that shows alternates and no
// toolbar — importable without the packaged composition's tool loaders.
export { CONTENT_ALTERNATE_REGISTRATIONS } from "./content-alternates.js";

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
