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

export { TypedEventBus } from "./core/TypedEventBus";

// ============================================================================
// Service Interfaces
// ============================================================================

export type {
	IAccessibilityCatalogResolver,
	IHighlightCoordinator,
	II18nService,
	IThemeProvider,
	IToolCoordinator,
	ITTSService,
	ToolState,
} from "./services/interfaces";

// ============================================================================
// Toolkit Services
// ============================================================================

// Accessibility Catalog Resolver (QTI 3.0 Accessibility Catalogs)
export type {
	CatalogLookupOptions,
	CatalogStatistics,
	CatalogType,
	ResolvedCatalog,
} from "./services/AccessibilityCatalogResolver";
export { AccessibilityCatalogResolver } from "./services/AccessibilityCatalogResolver";
export { AssessmentAuthoringService } from "./services/AssessmentAuthoringService";
// Context Variable Store (QTI 3.0 Context Declarations)
export { ContextVariableStore } from "./services/ContextVariableStore";
// Highlight Coordinator
export type { Annotation } from "./services/HighlightCoordinator";
export {
	HighlightColor,
	HighlightCoordinator,
	HighlightType,
} from "./services/HighlightCoordinator";
// I18n Service
export type {
	I18nConfig,
	PluralTranslation,
	TranslationBundle,
} from "./services/I18nService";
export { I18nService } from "./services/I18nService";
// PNP Mapper
export {
	getAllPNPSupports,
	isPNPSupportRegistered,
	mapPNPSupportToToolId,
	mapToolIdToPNPSupport,
	PIE_TOOL_TO_PNP_MAP,
	PNP_TO_PIE_TOOL_MAP,
	registerCustomPNPMapping,
} from "./services/PNPMapper";
// PNP Tool Resolution (QTI 3.0 Native)
export type { ResolvedToolConfig } from "./services/PNPToolResolver";
export { PNPToolResolver } from "./services/PNPToolResolver";
// Theme Provider
export type { FontSize, ThemeConfig } from "./services/ThemeProvider";
export { ThemeProvider } from "./services/ThemeProvider";
// Tool Coordinator
export { ToolCoordinator, ZIndexLayer } from "./services/ToolCoordinator";
// Text-to-Speech Service
export type { TTSConfig } from "./services/TTSService";
export { PlaybackState, TTSService } from "./services/TTSService";
export { BrowserTTSProvider } from "./services/tts/browser-provider";
// TTS Provider System
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSFeature,
	TTSProviderCapabilities,
} from "./services/tts/provider-interface";
// SSML Extractor (Auto-generates catalogs from embedded SSML)
export type { ExtractionResult } from "./services/SSMLExtractor";
export { SSMLExtractor } from "./services/SSMLExtractor";

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
} from "./item-loader";
export {
	createFetchItemLoader,
	createLoadItem,
	ItemLoadError,
} from "./item-loader";

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
} from "./types/events";

// ============================================================================
// Players (Optional Reference Implementations)
// ============================================================================

// Assessment Player - Full assessment with navigation
// Note: Assessment player is optional and not exported by default.
// Products can import from './player/AssessmentPlayer' if desired.

// Section Player - Use @pie-players/pie-section-player web component instead
