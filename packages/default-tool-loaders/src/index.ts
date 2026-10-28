// The packaged capability composition. Every export is a projection of one
// internal definition set, so registration, tag, loader, placement and policy
// cannot drift apart.
export type { PackagedToolRegistryOptions } from "./packaged-capability-composition.js";
export {
	createEmptyPersonalNeedsProfile,
	createPackagedToolRegistry,
	createUniversalPersonalNeedsProfile,
	DEFAULT_TOOL_MODULE_LOADERS,
	PACKAGED_TOOL_REGISTRATIONS,
	PACKAGED_TOOL_TAG_MAP,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "./packaged-capability-composition.js";

// A profile from an AfA PNP 3.0 record, in the packaged set's support ids.
export {
	type AfaFeatureSet,
	type AfaPnpRecord,
	type AfaSpoken,
	type AfaZoomAmount,
	createPersonalNeedsProfileFromAfa,
} from "./afa-profile.js";

// The authored-alternate subset, for a renderer that shows alternates and no
// toolbar — importable without the packaged composition's tool loaders.
export { CONTENT_ALTERNATE_REGISTRATIONS } from "./content-alternates.js";

// Individual registrations, for a host composing a subset rather than the whole
// packaged set.
export {
	annotationToolbarRegistration,
	lineReaderToolRegistration,
	magnificationToolRegistration,
	themeToolRegistration,
} from "./registrations/accessibility-tools.js";
export {
	AUDIO_TRANSCRIPT_FEATURE_ID,
	AUDIO_TRANSCRIPT_REGION_CLASS,
	AUDIO_TRANSCRIPT_REGION_LABEL,
	audioTranscriptRegistration,
	CONTENT_LEAD_SURFACE,
	resolveAudioTranscript,
	type ResolvedAudioTranscript,
} from "./registrations/audio-transcript.js";
export {
	type CalculatorProviderDefinition,
	type CalculatorRegistrationOptions,
	calculatorToolRegistration,
	createCalculatorToolRegistration,
} from "./registrations/calculator.js";
export {
	createDictionaryToolRegistration,
	createPictureDictionaryToolRegistration,
	dictionaryToolRegistration,
	type DictionaryVariantOptions,
	pictureDictionaryToolRegistration,
	spanishDictionaryToolRegistration,
	spanishPictureDictionaryToolRegistration,
} from "./registrations/dictionary-tools.js";
export {
	type AnswerEliminatorToolConfig,
	answerEliminatorToolRegistration,
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
