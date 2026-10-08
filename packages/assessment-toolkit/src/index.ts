/**
 * PIE Assessment Toolkit
 *
 * Independent, composable services for coordinating tools, accommodations,
 * and item players in assessment applications.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Infrastructure
// ============================================================================

export type {
	AssessmentToolkitHostRuntimeContext,
	AssessmentToolkitRegionScopeContext,
	AssessmentToolkitRuntimeContext,
	AssessmentToolkitShellContext,
	ItemPlayerConfig,
	ItemPlayerType,
	ShellContextKind,
} from "./context/assessment-toolkit-context.js";
export type {
	TTSHighlightContext,
	TTSHighlightTargetResolver,
	TTSHighlightTargetResolverProvider,
	TTSHighlightTargetResolverRuntime,
} from "./services/tts/highlight-target-resolver.js";
export {
	assessmentToolkitHostRuntimeContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitRuntimeContext,
	assessmentToolkitShellContext,
} from "./context/assessment-toolkit-context.js";
export {
	connectAssessmentToolkitHostRuntimeContext,
	connectAssessmentToolkitRegionScopeContext,
	connectAssessmentToolkitRuntimeContext,
	connectAssessmentToolkitShellContext,
} from "./context/runtime-context-consumer.js";
export {
	catalogOwnerContextFor,
	catalogSourceSignature,
	type CatalogOwnerContext,
	type CatalogOwnerIdentity,
	type CatalogOwnerKind,
	type CatalogSourceEntity,
} from "./services/catalog-owner.js";
export {
	PIE_INTERNAL_CONTENT_LOADED_EVENT,
	PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
	PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
	PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
	PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT,
	PIE_ITEM_SESSION_CHANGED_EVENT,
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
	type InternalContentLoadedDetail,
	type InternalFormativeActionDetail,
	type InternalItemSessionChangedDetail,
	type InternalItemPlayerErrorDetail,
	type InternalMediaTimeSourceDetail,
	type ItemSessionChangedDetail,
	type RuntimeRegistrationDetail,
	type RuntimeRegistrationKind,
} from "./runtime/registration-events.js";
export {
	createShellScope,
	type ShellScope,
	type ShellScopeState,
} from "./runtime/shell-scope.js";
// A shell's translation of its player's events into the runtime's, shared by the
// section player's passage shell and `<pie-item-scope>`.
export {
	createShellEventBridge,
	type ShellEventBridge,
	type ShellEventBridgeOptions,
} from "./runtime/shell-event-bridge.js";
export {
	connectToolRegionScopeContext,
	connectToolRuntimeContext,
	connectToolShellContext,
	createCrossBoundaryEvent,
	createToolCoordinatorRegistration,
	dispatchCrossBoundaryEvent,
	isContextValueDefined,
	type ToolCoordinatorRegistration,
} from "./runtime/tool-host-contract.js";
// Reading scope for a tool that reads or annotates a shell's content: its content
// region, the language and catalog context of the content at a point in it, and
// the composed-tree helpers that reach content rendered into open shadow roots.
export {
	catalogContextForShell,
	catalogContextHolding,
	type CatalogRuntimeScope,
} from "./runtime/catalog-context.js";
export {
	findShellScopeHost,
	resolveContentRegion,
} from "./runtime/content-region.js";
export {
	type ContentLanguageOptions,
	findContentLanguage,
	resolveContentLanguage,
} from "./runtime/content-language.js";
export {
	composedClosest,
	composedContains,
	flatTextContent,
	isShadowRootNode,
	retargetToTree,
} from "./services/tts/flat-tree.js";

// ============================================================================
// Service Interfaces
// ============================================================================

export type {
	AccessibilityCatalogResolverApi,
	ElementToolStateStoreApi,
	HighlightCoordinatorApi,
	I18nServiceApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	SpeakOptions,
	TtsServiceApi,
	ToolState,
} from "./services/interfaces.js";

// ============================================================================
// Toolkit Services
// ============================================================================

// Accessibility Catalog Resolver (QTI 3.0 Accessibility Catalogs)
export type {
	CatalogCardForm,
	CatalogChangeEvent,
	CatalogChangeListener,
	CatalogChangeReason,
	CatalogLookupContext,
	CatalogLookupOptions,
	CatalogOwnerCard,
	CatalogOwnerRegistration,
	CatalogOwnerSnapshot,
	CatalogOwnerView,
	CatalogStatistics,
	CatalogType,
	ResolvedCatalog,
} from "./services/AccessibilityCatalogResolver.js";
export {
	AccessibilityCatalogResolver,
	catalogCardForm,
	isKnownCatalogType,
	KNOWN_CATALOG_TYPES,
} from "./services/AccessibilityCatalogResolver.js";
// Context Variable Store (QTI 3.0 Context Declarations)
export { ContextVariableStore } from "./services/ContextVariableStore.js";
// Element Tool State Store (Element-level ephemeral tool state)
export { ElementToolStateStore } from "./services/ElementToolStateStore.js";
// Highlight Coordinator
export type { Annotation } from "./services/HighlightCoordinator.js";
export {
	HighlightColor,
	HighlightCoordinator,
	HighlightType,
} from "./services/HighlightCoordinator.js";
// Range Serializer (for annotation persistence)
export type { SerializedRange } from "./services/RangeSerializer.js";
export { RangeSerializer } from "./services/RangeSerializer.js";
// I18n types, re-exported from players-shared. `I18nProvider` is the contract a
// component depends on; the rest is for a host constructing or replacing the
// provider.
export type {
	I18nConfig,
	I18nProvider,
	InterpolationValues,
	LocaleCode,
	MessageCatalog,
	MessageKeyInput,
	PluralOptions,
	TextDirection,
} from "@pie-players/pie-players-shared/i18n";
// Tool Registry (Registry-based tool system)
export type {
	ResolvedToolContext,
	ToolbarContext,
	ToolContextResolver,
	ToolContextResolverContext,
	ToolContextResolverMap,
	ToolContextResolverResult,
	ToolActivation,
	ToolContentDependency,
	ToolContentDependencyContext,
	ToolModuleLoader,
	ToolRegistryChangeEvent,
	ToolRegistryChangeKind,
	ToolRegistryChangeListener,
	ToolSingletonScope,
	ToolSurfaceRenderContext,
	ToolSurfaceRenderResult,
	ToolSurfaceServices,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolWindowShellAction,
	ToolWindowShellAlign,
	ToolWindowShellConfig,
	ToolWindowShellContentConfig,
	ToolRegistration,
} from "./services/ToolRegistry.js";
export { ToolRegistry } from "./services/ToolRegistry.js";
// Tool open requests, and the selection-action contract a gateway renders.
export type {
	ToolOpenRequest,
	ToolRequestTarget,
} from "./services/tool-request.js";
export { DEFAULT_TOOL_REQUEST_LEVEL } from "./services/tool-request.js";
export type {
	ToolSelectionAction,
	ToolSelectionContext,
} from "./services/selection-action.js";
export type {
	AssessmentToolContext,
	BaseToolContext,
	ElementToolContext,
	ItemToolContext,
	PassageToolContext,
	RubricToolContext,
	SectionToolContext,
	ToolContext,
	ToolLevel,
} from "./services/tool-context.js";
export {
	extractTextContent,
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
	isAssessmentContext,
	isElementContext,
	isItemContext,
	isPassageContext,
	isRubricContext,
	isSectionContext,
} from "./services/tool-context.js";
export { DEFAULT_TOOL_PLACEMENT } from "./services/tool-config-defaults.js";
export type { CreateToolsConfigArgs } from "./services/create-tools-config.js";
export { createToolsConfig } from "./services/create-tools-config.js";
export { createEmptyPersonalNeedsProfile } from "./services/defaultPersonalNeedsProfile.js";
export type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolComponentOverrides,
	ToolTagMap,
} from "./tools/tool-tag-map.js";
export {
	createToolElement,
	resolveToolTag,
	toToolIdFromTag,
} from "./tools/tool-tag-map.js";
// Media-bearing catalog cards: the generic half, shared by every card form that
// references a recording rather than carrying text. Owned by
// `@pie-players/pie-players-shared/media`, which an element can import without
// this package; re-exported here for toolkit consumers.
export {
	applyMediaFragment,
	enforceMediaFragment,
	isSafeMediaSrc,
	isUnsupportedMediaAssetVersion,
	normalizeMediaFragment,
	normalizeMediaSources,
	SUPPORTED_MEDIA_ASSET_VERSION,
	trimmedOrUndefined,
} from "@pie-players/pie-players-shared/media";
// Spoken catalog cards carrying recorded audio rather than a reading script
export type { SpokenAudioMedia } from "./services/spoken-audio-cards.js";
export {
	resolveSpokenAudioMedia,
	SPOKEN_CATALOG_TYPE,
} from "./services/spoken-audio-cards.js";
// SSML Extractor (Auto-generates catalogs from embedded SSML)
export type { ExtractionResult } from "./services/SSMLExtractor.js";
export { SSMLExtractor } from "./services/SSMLExtractor.js";
// Tool Coordinator
export { ToolCoordinator, ZIndexLayer } from "./services/ToolCoordinator.js";
// Toolkit Coordinator (Centralized service management)
export type {
	AnswerEliminatorToolConfig,
	ProviderLifecycleContext,
	SectionControllerContext,
	SectionControllerEvent,
	SectionControllerEventType,
	SectionItemEvent,
	SectionItemEventType,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionScopedEvent,
	SectionScopedEventType,
	SectionSessionPersistenceConfig,
	SectionItemEventSubscriptionArgs,
	SectionScopedEventSubscriptionArgs,
	SectionEventSubscriptionArgs,
	SectionSessionPersistenceStrategy,
	SectionControllerLoadedRenderable,
	SectionControllerRuntimeState,
	SectionControllerSessionState,
	SectionPersistenceFactoryDefaults,
	ToolConfig,
	ToolkitCoordinatorConfig,
	ToolkitCoordinatorHooks,
	ToolkitErrorContext,
	ToolkitInitStatus,
	ToolkitServiceBundle,
	ToolkitToolsConfig,
	TTSToolConfig,
} from "./services/ToolkitCoordinator.js";
export { ToolkitCoordinator } from "./services/ToolkitCoordinator.js";
export type {
	CalculatorToolProviderConfig,
	CanonicalToolsConfig,
	ToolPlacementConfig,
	ToolPlacementLevel,
	ToolPolicyConfig,
	ToolProvidersConfig,
	ToolsConfigInput,
} from "./services/tools-config-normalizer.js";
export type {
	FrameworkErrorKind,
	FrameworkErrorModel,
	FrameworkErrorSeverity,
} from "./services/framework-error.js";
export {
	formatFrameworkErrorForConsole,
	frameworkErrorFromToolConfigDiagnostics,
	frameworkErrorFromUnknown,
	toFrameworkErrorModel,
} from "./services/framework-error.js";
export type { FrameworkErrorListener } from "./services/framework-error-bus.js";
export type {
	ToolConfigDiagnostic,
	ToolConfigDiagnosticSeverity,
	ToolConfigStrictness,
	ToolConfigValidationOptions,
	ToolConfigValidationResult,
} from "./services/tool-config-validation.js";
export type {
	ToolbarButtonItem,
	ToolbarItem,
	ToolbarItemBase,
	ToolbarLinkItem,
} from "./services/toolbar-items.js";
export {
	isExternalIconUrl,
	isInlineSvgIcon,
	isToolbarLinkItem,
	isValidToolbarItemShape,
} from "./services/toolbar-items.js";
export {
	normalizeToolsConfig,
	normalizeToolList,
	parseToolList,
} from "./services/tools-config-normalizer.js";
export { isHostDeniedFeature } from "./policy/core/feature-decision.js";
export {
	frameworkErrorFromToolConfigValidation,
	normalizeAndValidateToolsConfig,
} from "./services/tool-config-validation.js";
export type {
	ParsedToolInstanceId,
	ToolScopeLevel,
} from "./services/tool-instance-id.js";
export {
	createScopedToolId,
	parseScopedToolId,
	toOverlayToolId,
} from "./services/tool-instance-id.js";
// Text-to-Speech Service
export type { TTSConfig } from "./services/TTSService.js";
export { PlaybackState, TTSService } from "./services/TTSService.js";
export {
	PIE_TTS_CONTROL_HANDOFF_EVENT,
	type TTSControlHandoffDetail,
} from "./services/tts-control-events.js";
export {
	bindTtsAudioHandoff,
	pauseTtsForMediaAudio,
} from "./services/audio-handoff.js";
export { BrowserTTSProvider } from "./services/tts/browser-provider.js";
export {
	isTTSStartFailure,
	TTS_START_FAILED_CODE,
} from "./services/tts/start-failure.js";
export type { SREMathSpeechOptions } from "./services/tts/math-speech.js";
export type {
	ToolkitTTSConfig,
	ToolkitTTSProviderOptions,
} from "./services/tts/provider-options.js";
export type {
	NormalizedTTSSpeedOption,
	TTSHostToolbarLayout,
	TTSLayoutMode,
	TTSRuntimeSettings,
	TTSSpeedOption,
	TTSSpeedOptionConfig,
} from "./services/tts-runtime-config.js";
export {
	DEFAULT_TTS_SPEED_OPTIONS,
	formatTTSSpeedOptionsAsText,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
	normalizeTTSSpeedOptionConfigs,
	normalizeTTSSpeedOptions,
	parseTTSSpeedOptionsFromText,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSRuntimeSettings,
} from "./services/tts-runtime-config.js";
// TTS Provider System
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSSpeechSegment,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

// ============================================================================
// Item loading (client-resolvable default; optional backend hook)
// ============================================================================

export type {
	CreateLoadItemOptions,
	LoadItem,
	LoadItemOptions,
} from "./item-loader.js";
export {
	createFetchItemLoader,
	createLoadItem,
	ItemLoadError,
} from "./item-loader.js";

// ============================================================================
// Attempt Session
// ============================================================================

export type {
	StorageLike,
	TestAttemptItemSession,
	TestAttemptSession,
	TestAttemptSessionNavigationState,
	TestAttemptSessionRealization,
} from "./attempt/TestSession.js";
export {
	createMemoryStorage,
	createTestAttemptSessionIdentifier,
	createNewTestAttemptSession,
	getBrowserLocalStorage,
	getOrCreateAnonymousDeviceId,
	getTestAttemptSessionStorageKey,
	loadTestAttemptSession,
	saveTestAttemptSession,
	setCurrentPosition,
	upsertItemSessionFromPieSessionChange,
	upsertVisitedItem,
} from "./attempt/TestSession.js";
export type {
	AssessmentSession,
	AssessmentSectionSessionState,
	AssessmentSessionNavigationState,
	AssessmentSessionRealization,
} from "./attempt/AssessmentSession.js";
export {
	createNewAssessmentSession,
	setCurrentSectionPosition,
	upsertSectionSession,
} from "./attempt/AssessmentSession.js";
export type {
	ActivitySessionPatchPayload,
	MapActivityToTestAttemptSessionArgs,
	PieBackendActivityDefinition,
	PieBackendActivityItemRef,
	PieBackendActivitySession,
} from "./attempt/adapters/activity-to-test-attempt-session.js";
export {
	buildActivitySessionItemUpdate,
	buildActivitySessionPatchFromTestAttemptSession,
	mapActivityToTestAttemptSession,
	toItemSessionsRecord,
} from "./attempt/adapters/activity-to-test-attempt-session.js";

// Section Player - Use @pie-players/pie-section-player web component

// ============================================================================
// Shared Components
// ============================================================================

// ItemToolBar custom element registration helper is exported via package.json exports field
// Import using: import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
// PieAssessmentToolkit custom element registration helper is exported via package.json exports field
