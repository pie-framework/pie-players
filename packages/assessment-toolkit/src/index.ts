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

export { TypedEventBus } from "./core/TypedEventBus.js";
export type {
	AssessmentToolkitHostRuntimeContext,
	AssessmentToolkitRegionScopeContext,
	AssessmentToolkitRuntimeContext,
	AssessmentToolkitShellContext,
	ItemPlayerConfig,
	ItemPlayerType,
	ShellContextKind,
} from "./context/assessment-toolkit-context.js";
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
	PIE_ITEM_SESSION_CHANGED_EVENT,
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
	type ItemSessionChangedDetail,
	type RuntimeRegistrationDetail,
	type RuntimeRegistrationKind,
} from "./runtime/registration-events.js";
export {
	connectToolRegionScopeContext,
	connectToolRuntimeContext,
	connectToolShellContext,
	createCrossBoundaryEvent,
	dispatchCrossBoundaryEvent,
	isContextValueDefined,
} from "./runtime/tool-host-contract.js";

// ============================================================================
// Service Interfaces
// ============================================================================

export type {
	IAccessibilityCatalogResolver,
	IElementToolStateStore,
	IHighlightCoordinator,
	II18nService,
	IThemeProvider,
	IToolCoordinator,
	IToolkitCoordinator,
	ITTSService,
	ToolState,
} from "./services/interfaces.js";

// ============================================================================
// Toolkit Services
// ============================================================================

// Accessibility Catalog Resolver (QTI 3.0 Accessibility Catalogs)
export type {
	CatalogLookupOptions,
	CatalogStatistics,
	CatalogType,
	ResolvedCatalog,
} from "./services/AccessibilityCatalogResolver.js";
export { AccessibilityCatalogResolver } from "./services/AccessibilityCatalogResolver.js";
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
// I18n Service
export type {
	I18nConfig,
	PluralTranslation,
	TranslationBundle,
} from "./services/I18nService.js";
export { I18nService } from "./services/I18nService.js";
// Tool Registry (Registry-based tool system)
export type {
	ToolbarContext,
	ToolModuleLoader,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolRegistration,
} from "./services/ToolRegistry.js";
export { ToolRegistry } from "./services/ToolRegistry.js";
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
export {
	createDefaultToolRegistry,
	DEFAULT_TOOL_PLACEMENT,
	DEFAULT_TOOL_ORDER,
} from "./services/createDefaultToolRegistry.js";
export type { DefaultToolRegistryOptions } from "./services/createDefaultToolRegistry.js";
export {
	DEFAULT_PERSONAL_NEEDS_PROFILE,
	createDefaultPersonalNeedsProfile,
} from "./services/defaultPersonalNeedsProfile.js";
export type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolComponentOverrides,
	ToolTagMap,
} from "./tools/tool-tag-map.js";
export {
	createToolElement,
	DEFAULT_TOOL_TAG_MAP,
	resolveToolTag,
	toToolIdFromTag,
} from "./tools/tool-tag-map.js";
// PNP Tool Resolution (QTI 3.0 Native)
export type {
	ResolvedToolConfig,
	ToolResolutionResult,
} from "./services/PNPToolResolver.js";
export { PNPToolResolver } from "./services/PNPToolResolver.js";
// PNP Provenance Tracking
export type {
	FeatureResolutionTrail,
	PNPResolutionProvenance,
	ResolutionDecision,
} from "./services/pnp-provenance.js";
export {
	formatProvenanceAsJSON,
	formatProvenanceAsMarkdown,
	getFeatureExplanation,
	PNPProvenanceBuilder,
} from "./services/pnp-provenance.js";
// QTI 3.0 Standard Access Features
export {
	ALL_STANDARD_ACCESS_FEATURES,
	EXAMPLE_PNP_CONFIGURATIONS,
	getFeatureCategory,
	getFeaturesInCategory,
	isStandardAccessFeature,
	QTI_STANDARD_ACCESS_FEATURES,
} from "./services/pnp-standard-features.js";
// SSML Extractor (Auto-generates catalogs from embedded SSML)
export type { ExtractionResult } from "./services/SSMLExtractor.js";
export { SSMLExtractor } from "./services/SSMLExtractor.js";
// Theme Provider
export type { FontSize, ThemeConfig } from "./services/ThemeProvider.js";
export { ThemeProvider } from "./services/ThemeProvider.js";
// Tool Coordinator
export { ToolCoordinator, ZIndexLayer } from "./services/ToolCoordinator.js";
// Toolkit Coordinator (Centralized service management)
export type {
	AnswerEliminatorToolConfig,
	ProviderLifecycleContext,
	SectionControllerContext,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionControllerPersistenceStrategy,
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
	CanonicalToolsConfig,
	ToolPlacementConfig,
	ToolPlacementLevel,
	ToolPolicyConfig,
	ToolProvidersConfig,
} from "./services/tools-config-normalizer.js";
export {
	normalizeToolsConfig,
	normalizeToolAlias,
	normalizeToolList,
	parseToolList,
	resolveToolsForLevel,
} from "./services/tools-config-normalizer.js";
export type {
	ParsedToolInstanceId,
	ToolInstanceRole,
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
export { BrowserTTSProvider } from "./services/tts/browser-provider.js";
// TTS Provider System
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSFeature,
	TTSProviderCapabilities,
} from "./services/tts/provider-interface.js";

// Note: Removed deprecated exports:
// - ttsService singleton (use: const service = new TTSService())
// - IToolCoordinator (now in ./services/interfaces)
// - ITTSProvider from TTSService (now in ./services/tts/provider-interface)
// - TTSProvider string type (use ITTSProvider instances instead)

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

// ============================================================================
// Event Types (Standard Contracts)
// ============================================================================

export type {
	AssessmentCompletedEvent,
	AssessmentPausedEvent,
	AssessmentResumedEvent,
	AssessmentStartedEvent,
	// Event map
	AssessmentToolkitEvents,
	CanNavigateChangedEvent,
	InteractionEvent,
	InteractionType,
	ItemChangedEvent,
	ItemMetadata,
	LoadCompleteEvent,
	LocaleChangedEvent,
	LocaleLoadingCompleteEvent,
	LocaleLoadingErrorEvent,
	LocaleLoadingStartEvent,
	NavigationRequestEvent,
	PlayerErrorEvent,
	// Event interfaces
	SessionChangedEvent,
	StateRestoredEvent,
	StateSavedEvent,
	SyncFailedEvent,
	ToolActivatedEvent,
	ToolDeactivatedEvent,
	ToolStateChangedEvent,
} from "./types/events.js";

// Section Player - Use @pie-players/pie-section-player web component

// ============================================================================
// Shared Components
// ============================================================================

// ItemToolBar custom element registration helper is exported via package.json exports field
// Import using: import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
// PieAssessmentToolkit custom element registration helper is exported via package.json exports field
