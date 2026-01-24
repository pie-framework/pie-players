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

export { AssessmentAuthoringService } from "./services/AssessmentAuthoringService";

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
// Theme Provider
export type { FontSize, ThemeConfig } from "./services/ThemeProvider";
export { ThemeProvider } from "./services/ThemeProvider";
// Tool Configuration
export type {
	ItemToolConfig,
	ResolvedToolConfig,
	RosterToolConfig,
	StudentAccommodations,
	ToolAllowance,
	ToolConfigInput,
} from "./services/ToolConfigResolver";
export { ToolConfigResolver } from "./services/ToolConfigResolver";
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
// Profile-Based Configuration System
// ============================================================================

export type {
	AdministrationInput,
	AssessmentContextProfile,
	// Input types
	AssessmentInput,
	DistrictInput,
	IEPInput,
	ItemInput,
	OrganizationInput,
	ProfileMetadata,
	ProfileResolver,
	RegionSize,
	ResolutionContext,
	ResolutionExplanation,
	ResolvedAccessibilitySettings,
	ResolvedLayoutPreferences,
	ResolvedThemeConfig,
	ResolvedToolSet,
	Section504Input,
	StudentInput,
	StudentPreferences,
	ToolAvailability,
	ToolResolution,
	ToolSpecificConfig,
} from "./profile";

export { DefaultProfileResolver } from "./profile";

// ============================================================================
// Assessment Player (Optional Reference Implementation)
// ============================================================================

// Note: Assessment player is optional and not exported by default.
// Products can import from './assessment-player' if desired.
