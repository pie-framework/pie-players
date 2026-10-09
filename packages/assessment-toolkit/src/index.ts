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
	AssessmentToolkitRuntimeContext,
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
	catalogOwnerContextFor,
	type CatalogOwnerContext,
	type CatalogOwnerIdentity,
	type CatalogSourceEntity,
} from "./services/catalog-owner.js";
export {
	PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
	PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
	PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT,
	PIE_ITEM_SESSION_CHANGED_EVENT,
	type InternalFormativeActionDetail,
	type InternalMediaTimeSourceDetail,
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
	connectToolRuntimeContext,
	dispatchCrossBoundaryEvent,
} from "./runtime/tool-host-contract.js";

// ============================================================================
// Service Interfaces
// ============================================================================

export type {
	AccessibilityCatalogResolverApi,
	ElementToolStateStoreApi,
	HighlightCoordinatorApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	SpeakOptions,
	TtsServiceApi,
	ToolState,
	ToolStateFilter,
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
export { AccessibilityCatalogResolver } from "./services/AccessibilityCatalogResolver.js";
// Element Tool State Store (Element-level ephemeral tool state)
export { ElementToolStateStore } from "./services/ElementToolStateStore.js";
// Highlight Coordinator
export type { Annotation } from "./services/HighlightCoordinator.js";
export {
	HighlightColor,
	HighlightCoordinator,
	HighlightType,
} from "./services/HighlightCoordinator.js";
// Serialized annotation ranges
export type { SerializedRange } from "./services/RangeSerializer.js";
// I18n types, re-exported from players-shared: the `I18nProvider` contract a
// component depends on, and the types its methods take.
export type {
	I18nProvider,
	InterpolationValues,
	LocaleCode,
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
	ToolRegistration,
} from "./services/ToolRegistry.js";
export { ToolRegistry } from "./services/ToolRegistry.js";
// Tool open requests
export type {
	ToolOpenRequest,
	ToolRequestTarget,
} from "./services/tool-request.js";
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
	hasReadableText,
	hasSpokenContent,
} from "./services/tool-context.js";
export type { CreateToolsConfigArgs } from "./services/create-tools-config.js";
export { createToolsConfig } from "./services/create-tools-config.js";
export type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolComponentOverrides,
	ToolTagMap,
} from "./tools/tool-tag-map.js";
// SSML Extractor (Auto-generates catalogs from embedded SSML)
export type { ExtractionResult } from "./services/SSMLExtractor.js";
export { SSMLExtractor } from "./services/SSMLExtractor.js";
// Tool Coordinator
export { ToolCoordinator, ZIndexLayer } from "./services/ToolCoordinator.js";
// Toolkit Coordinator (Centralized service management)
export type {
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
	ToolkitCoordinatorConfig,
	ToolkitCoordinatorHooks,
	ToolkitErrorContext,
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
	TextToSpeechToolProviderConfig,
} from "./services/tools-config-normalizer.js";
export type {
	FrameworkErrorKind,
	FrameworkErrorModel,
	FrameworkErrorScope,
	FrameworkErrorSeverity,
} from "./services/framework-error.js";
export {
	frameworkErrorFromUnknown,
	toFrameworkErrorModel,
} from "./services/framework-error.js";
export type { FrameworkErrorListener } from "./services/framework-error-bus.js";
export type {
	ToolConfigDiagnostic,
	ToolConfigDiagnosticSeverity,
	ToolConfigStrictness,
	ToolConfigValidationResult,
} from "./services/tool-config-validation.js";
export type {
	ToolbarButtonItem,
	ToolbarItem,
	ToolbarItemBase,
	ToolbarLinkItem,
} from "./services/toolbar-items.js";
export type { ToolScopeLevel } from "./services/tool-instance-id.js";
export { createScopedToolId } from "./services/tool-instance-id.js";
// Text-to-Speech Service
export type { TTSConfig } from "./services/TTSService.js";
export { PlaybackState, TTSService } from "./services/TTSService.js";
export { BrowserTTSProvider } from "./services/tts/browser-provider.js";
export type { SREMathSpeechOptions } from "./services/tts/math-speech.js";
export type {
	TTSLayoutMode,
	TTSRuntimeSettings,
	TTSSpeedOption,
	TTSSpeedOptionConfig,
} from "./services/tts-runtime-config.js";
// TTS Provider System
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSSpeechSegment,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

// ============================================================================
// Attempt Session
// ============================================================================

export type {
	TestAttemptItemSession,
	TestAttemptSession,
	TestAttemptSessionNavigationState,
	TestAttemptSessionRealization,
} from "./attempt/TestSession.js";
export {
	createNewTestAttemptSession,
	setCurrentPosition,
	toItemSessionsRecord,
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

// Section Player - Use @pie-players/pie-section-player web component

// ============================================================================
// Shared Components
// ============================================================================

// ItemToolBar custom element registration helper is exported via package.json exports field
// Import using: import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
// PieAssessmentToolkit custom element registration helper is exported via package.json exports field
