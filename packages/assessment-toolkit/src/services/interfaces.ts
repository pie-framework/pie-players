/**
 * Service Interfaces
 *
 * Public interfaces for all core assessment toolkit services.
 * These interfaces define the contracts that service implementations must fulfill,
 * enabling dependency injection, testing, and custom implementations.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { I18nServiceApi } from "@pie-players/pie-players-shared/i18n";
import type {
	AccessibilityCatalogResolver,
	CatalogLookupOptions,
	CatalogStatistics,
	CatalogType,
	ResolvedCatalog,
} from "./AccessibilityCatalogResolver.js";
import type { FrameworkErrorListener } from "./framework-error-bus.js";
import type { HighlightColor, HighlightType } from "./HighlightCoordinator.js";
import type {
	SectionControllerHandle,
	SectionItemEventSubscriptionArgs,
	SectionScopedEventSubscriptionArgs,
	SectionEventSubscriptionArgs,
	ToolkitCoordinatorHooks,
	ToolkitInitStatus,
} from "./ToolkitCoordinator.js";
import type { FontSize, ThemeConfig } from "./ThemeProvider.js";
import type { ZIndexLayer } from "./ToolCoordinator.js";
import type { PlaybackState, TTSConfig } from "./TTSService.js";
import type { ToolProviderConfig } from "./tools-config-normalizer.js";
import type { ToolProviderRegistry } from "./tool-providers/ToolProviderRegistry.js";
import type {
	PolicySource,
	QtiEnforcementMode,
	ResolvedEngineInputs,
	ToolPolicyChangeListener,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
} from "../policy/engine.js";
import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";
import type {
	ITTSProvider,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

// Re-export I18nServiceApi from players-shared
export type { I18nServiceApi };

/**
 * Theme provider interface
 *
 * Applies consistent accessibility theming across items and tools.
 */
export interface ThemeProviderApi {
	/**
	 * Apply theme configuration
	 */
	applyTheme(config: ThemeConfig): void;

	/**
	 * Get current theme configuration
	 */
	getCurrentTheme(): Required<ThemeConfig>;

	/**
	 * Reset to default theme
	 */
	reset(): void;

	/**
	 * Clean up and remove theme styles
	 */
	destroy(): void;
}

/**
 * Highlight coordinator interface
 *
 * Manages content highlighting for TTS, annotations, and selections.
 */
export interface HighlightCoordinatorApi {
	/**
	 * Highlight a text range
	 */
	highlightRange(
		range: Range,
		type: HighlightType,
		color: HighlightColor,
	): void;

	/**
	 * Highlight a word for TTS (temporary)
	 */
	highlightTTSWord(
		textNode: Text,
		startOffset: number,
		endOffset: number,
	): void;

	/**
	 * Highlight sentence(s) for TTS (background layer)
	 */
	highlightTTSSentence(ranges: Range[]): void;

	/**
	 * Clear all TTS highlights (word and sentence)
	 */
	clearTTS(): void;

	/**
	 * Clear highlights of a specific type
	 */
	clearHighlights(type: HighlightType): void;

	/**
	 * Clear all highlights
	 */
	clearAll(): void;

	/**
	 * Check if highlighting is supported in current environment
	 */
	isSupported(): boolean;

	/**
	 * Update TTS highlight style dynamically
	 */
	updateTTSHighlightStyle(color: string, opacity: number): void;
}

/**
 * Tool state interface
 */
export interface ToolState {
	id: string;
	name: string;
	isVisible: boolean;
	element: HTMLElement | null;
	layer: ZIndexLayer;
}

/**
 * Tool coordinator interface
 *
 * Manages z-index layering and visibility for floating tools.
 */
export interface ToolCoordinatorApi {
	/**
	 * Register a tool with the coordinator
	 */
	registerTool(
		id: string,
		name: string,
		element?: HTMLElement,
		layer?: ZIndexLayer,
	): void;

	/**
	 * Unregister a tool
	 */
	unregisterTool(id: string): void;

	/**
	 * Show a tool
	 */
	showTool(id: string): void;

	/**
	 * Hide a tool
	 */
	hideTool(id: string): void;

	/**
	 * Toggle tool visibility
	 */
	toggleTool(id: string): void;

	/**
	 * Check if tool is visible
	 */
	isToolVisible(id: string): boolean;

	/**
	 * Bring an element to the front of its layer
	 */
	bringToFront(element: HTMLElement): void;

	/**
	 * Update the element reference for a tool
	 */
	updateToolElement(id: string, element: HTMLElement): void;

	/**
	 * Get state for a specific tool
	 */
	getToolState(id: string): ToolState | undefined;

	/**
	 * Get all visible tools
	 */
	getVisibleTools(): ToolState[];

	/**
	 * Subscribe to tool state changes
	 */
	subscribe(listener: () => void): () => void;
}

/**
 * TTS service interface
 *
 * Provides text-to-speech functionality with provider-based architecture.
 * Supports QTI 3.0 accessibility catalogs for pre-authored spoken content.
 */
export interface TtsServiceApi {
	/**
	 * Initialize TTS with a provider
	 */
	initialize(
		provider: ITTSProvider,
		config?: Partial<TTSConfig>,
	): Promise<void>;

	/**
	 * Speak text with optional catalog support
	 */
	speak(
		text: string,
		options?: {
			catalogId?: string;
			language?: string;
			contentElement?: Element;
		},
	): Promise<void>;

	/**
	 * Speak a text range
	 */
	speakRange(
		range: Range,
		options?: { contentRoot?: Element | null },
	): Promise<void>;

	/**
	 * Pause playback
	 */
	pause(): void;

	/**
	 * Resume playback
	 */
	resume(): void;

	/**
	 * Stop playback
	 */
	stop(): void;

	/**
	 * Request active TTS controls to hand off/deactivate their UI state.
	 *
	 * This is an orchestration hint for TTS tool chrome and does not replace
	 * playback controls such as stop/pause/resume.
	 */
	requestControlHandoff(): void;

	/**
	 * Seek forward by sentence units
	 */
	seekForward(units?: number): Promise<void>;

	/**
	 * Seek backward by sentence units
	 */
	seekBackward(units?: number): Promise<void>;

	/**
	 * Check if currently playing
	 */
	isPlaying(): boolean;

	/**
	 * Check if paused
	 */
	isPaused(): boolean;

	/**
	 * Get current playback state
	 */
	getState(): PlaybackState;

	/**
	 * Get currently speaking text
	 */
	getCurrentText(): string | null;

	/**
	 * Subscribe to state changes
	 */
	onStateChange(id: string, callback: (state: PlaybackState) => void): void;

	/**
	 * Unsubscribe from state changes
	 */
	offStateChange(id: string, callback: (state: PlaybackState) => void): void;

	/**
	 * Get capabilities of current provider
	 */
	getCapabilities(): TTSProviderCapabilities | null;

	/**
	 * Update TTS settings dynamically (rate, pitch, voice)
	 */
	updateSettings(settings: Partial<TTSConfig>): Promise<void>;

	/**
	 * Set highlight coordinator for word highlighting
	 */
	setHighlightCoordinator(coordinator: HighlightCoordinatorApi): void;

	/**
	 * Set accessibility catalog resolver for spoken content
	 */
	setCatalogResolver(resolver: AccessibilityCatalogResolver): void;
}

/**
 * Accessibility catalog resolver interface
 *
 * Manages QTI 3.0 accessibility catalogs at assessment and item levels.
 * Provides lookup and resolution services for alternative content representations.
 */
export interface AccessibilityCatalogResolverApi {
	/**
	 * Set the default language for fallback resolution
	 */
	setDefaultLanguage(language: string): void;

	/**
	 * Get the default language
	 */
	getDefaultLanguage(): string;

	/**
	 * Add item-level catalogs (called when rendering a new item)
	 */
	addItemCatalogs(catalogs: any[]): void;

	/**
	 * Clear item-level catalogs (called when leaving an item)
	 */
	clearItemCatalogs(): void;

	/**
	 * Check if a catalog exists
	 */
	hasCatalog(catalogId: string): boolean;

	/**
	 * Get alternative content for a catalog identifier
	 */
	getAlternative(
		catalogId: string,
		options: CatalogLookupOptions,
	): ResolvedCatalog | null;

	/**
	 * Get all available alternatives for a catalog identifier
	 */
	getAllAlternatives(catalogId: string): ResolvedCatalog[];

	/**
	 * Get all catalog identifiers available
	 */
	getAllCatalogIds(): string[];

	/**
	 * Get statistics about available catalogs
	 */
	getStatistics(): CatalogStatistics;

	/**
	 * Check if a specific catalog type is available
	 */
	hasAlternativeType(catalogId: string, type: CatalogType): boolean;

	/**
	 * Get all catalog IDs that have a specific type of alternative
	 */
	getCatalogsByType(type: CatalogType): string[];

	/**
	 * Reset all catalogs
	 */
	reset(): void;

	/**
	 * Destroy and cleanup
	 */
	destroy(): void;
}

/**
 * Element tool state store interface
 *
 * Manages element-level ephemeral tool state using composite keys for global uniqueness.
 * Tool state is client-only and separate from PIE session data (which is sent to server for scoring).
 */
export interface ElementToolStateStoreApi {
	/**
	 * Generate a globally unique element ID from components
	 */
	getGlobalElementId(
		assessmentId: string,
		sectionId: string,
		itemId: string,
		elementId: string,
	): string;

	/**
	 * Parse a global element ID into its components
	 */
	parseGlobalElementId(globalElementId: string): {
		assessmentId: string;
		sectionId: string;
		itemId: string;
		elementId: string;
	} | null;

	/**
	 * Set state for a specific tool on an element
	 */
	setState(globalElementId: string, toolId: string, state: any): void;

	/**
	 * Get state for a specific tool on an element
	 */
	getState(globalElementId: string, toolId: string): any | undefined;

	/**
	 * Get all tool states for a specific element
	 */
	getElementState(globalElementId: string): Record<string, any>;

	/**
	 * Get all element states
	 */
	getAllState(): Record<string, Record<string, any>>;

	/**
	 * Subscribe to state changes
	 */
	subscribe(
		callback: (state: Map<string, Map<string, any>>) => void,
	): () => void;

	/**
	 * Set callback for persistence integration
	 */
	setOnStateChange(
		callback: (state: Record<string, Record<string, any>>) => void,
	): void;

	/**
	 * Load state from persistence
	 */
	loadState(state: Record<string, Record<string, any>>): void;

	/**
	 * Clear state for a specific element
	 */
	clearElement(globalElementId: string): void;

	/**
	 * Clear state for a specific tool across all elements
	 */
	clearTool(toolId: string): void;

	/**
	 * Clear all elements in a specific section
	 */
	clearSection(assessmentId: string, sectionId: string): void;

	/**
	 * Clear all state
	 */
	clearAll(): void;
}

/**
 * Toolkit coordinator interface
 *
 * Orchestrates all toolkit services (TTS, tools, accessibility, state management) from a single entry point.
 * Provides centralized configuration for tool availability and settings.
 */
export interface ToolkitCoordinatorApi {
	/**
	 * Assessment identifier
	 */
	readonly assessmentId: string;

	/**
	 * Configuration
	 */
	readonly config: {
		tools?: {
			providers?: Record<string, ToolProviderConfig | undefined>;
		};
	};

	/**
	 * TTS service
	 */
	readonly ttsService: TtsServiceApi;

	/**
	 * Tool coordinator
	 */
	readonly toolCoordinator: ToolCoordinatorApi;

	/**
	 * Highlight coordinator
	 */
	readonly highlightCoordinator: HighlightCoordinatorApi;

	/**
	 * Element tool state store
	 */
	readonly elementToolStateStore: ElementToolStateStoreApi;

	/**
	 * Catalog resolver
	 */
	readonly catalogResolver: AccessibilityCatalogResolverApi;

	/**
	 * Tool provider registry
	 */
	readonly toolProviderRegistry: ToolProviderRegistry;

	/**
	 * Get all services as a bundle
	 */
	getServiceBundle(): {
		ttsService: TtsServiceApi;
		toolCoordinator: ToolCoordinatorApi;
		highlightCoordinator: HighlightCoordinatorApi;
		elementToolStateStore: ElementToolStateStoreApi;
		catalogResolver: AccessibilityCatalogResolverApi;
		toolProviderRegistry: ToolProviderRegistry;
	};

	/**
	 * Ensure TTS service is initialized and ready.
	 */
	ensureTTSReady(config?: Record<string, unknown>): Promise<void>;

	/**
	 * Ensure a provider is initialized and ready.
	 */
	ensureProviderReady(providerId: string): Promise<unknown>;

	/**
	 * Wait until coordinator initialization is complete.
	 */
	waitUntilReady(): Promise<void>;

	/**
	 * Check if coordinator has completed initialization.
	 */
	isReady(): boolean;

	/**
	 * Read current initialization status.
	 */
	getInitStatus(): ToolkitInitStatus;

	/**
	 * Check if a tool is enabled
	 */
	isToolEnabled(toolId: string): boolean;

	/**
	 * Get tool configuration
	 */
	getToolConfig(toolId: string): ToolProviderConfig | null;

	/**
	 * Update tool configuration
	 */
	updateToolConfig(toolId: string, updates: Partial<ToolProviderConfig>): void;

	/**
	 * Register or update lifecycle hooks at runtime.
	 */
	setHooks(hooks: ToolkitCoordinatorHooks): void;

	/**
	 * Return a section controller if already created.
	 */
	getSectionController(args: {
		sectionId: string;
		attemptId?: string;
	}): SectionControllerHandle | undefined;

	/**
	 * Subscribe to section controller events with automatic replacement
	 * for repeated subscriptions using the same listener and section key.
	 */
	subscribeSectionEvents(args: SectionEventSubscriptionArgs): () => void;

	/**
	 * Subscribe to item-scoped section controller events.
	 */
	subscribeItemEvents(args: SectionItemEventSubscriptionArgs): () => void;

	/**
	 * Subscribe to section-scoped lifecycle/loading/completion/error events.
	 */
	subscribeSectionLifecycleEvents(
		args: SectionScopedEventSubscriptionArgs,
	): () => void;

	/**
	 * Create or reuse a section controller with single-flight deduplication.
	 */
	getOrCreateSectionController(args: {
		sectionId: string;
		attemptId?: string;
		input?: unknown;
		updateExisting?: boolean;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle>;

	/**
	 * Dispose an existing section controller.
	 */
	disposeSectionController(args: {
		sectionId: string;
		attemptId?: string;
		persistBeforeDispose?: boolean;
		clearPersistence?: boolean;
	}): Promise<void>;

	/**
	 * Subscribe to framework-error events emitted by the coordinator.
	 *
	 * Mirrors the shape of {@link subscribeTelemetry} (see
	 * `ToolkitCoordinator.subscribeTelemetry`): a synchronous,
	 * multi-subscriber stream where each call to the internal bus's
	 * `reportFrameworkError` fans out to every active listener exactly once.
	 *
	 * The returned function detaches the listener; calling it twice is a
	 * no-op. A listener that throws is caught and logged; the throw does
	 * not break fan-out to the remaining listeners.
	 *
	 * Use this to wire framework errors into Sentry / Datadog / a custom
	 * banner without listening on a DOM event. The DOM event
	 * (`framework-error`) and the canonical `onFrameworkError` prop on
	 * `<pie-assessment-toolkit>` consume the same bus.
	 */
	subscribeFrameworkErrors(listener: FrameworkErrorListener): () => void;

	// ----------------------------------------------------------------
	// Tool Policy Engine — public surface (M8 PR 2 / PR 3).
	//
	// The coordinator owns a single `ToolPolicyEngine` instance and
	// exposes its decision and subscription surface through the API
	// so that toolbar custom elements (`pie-item-toolbar`,
	// `pie-section-toolbar`), the base section player, and bespoke
	// host instrumentation (PNP debugger, etc.) all flow through the
	// same engine. Hosts that want to drive QTI inputs imperatively
	// (instead of binding props on `<pie-assessment-toolkit>`) call
	// `updateAssessment` / `updateCurrentItemRef` /
	// `setQtiEnforcement` directly.
	// ----------------------------------------------------------------

	/**
	 * Resolve the visible tool set for a given placement level + scope.
	 * Returns the engine's full decision (visible tools, diagnostics,
	 * provenance). Hosts that only need the IDs may map
	 * `decision.visibleTools` themselves.
	 */
	decideToolPolicy(request: ToolPolicyDecisionRequest): ToolPolicyDecision;

	/**
	 * Subscribe to policy-engine change events. Fires whenever the
	 * coordinator's bound policy inputs change (`updateToolConfig`,
	 * `updateFloatingTools`, `updateAssessment`, `updateCurrentItemRef`,
	 * `setQtiEnforcement`) or a custom `PolicySource` is registered /
	 * removed. Listeners that need the new visible tool set should
	 * call `decideToolPolicy(...)` with their level / scope.
	 */
	onPolicyChange(listener: ToolPolicyChangeListener): () => void;

	/**
	 * Bind (or clear) the active QTI assessment for policy decisions.
	 * Calling with a non-null assessment auto-promotes the engine to
	 * `qtiEnforcement: "on"` unless a host has previously called
	 * {@link setQtiEnforcement} (the override is sticky).
	 */
	updateAssessment(assessment: AssessmentEntity | null): void;

	/**
	 * Bind (or clear) the current item reference for policy decisions.
	 * Used by item-level QTI gates (item `requiredTools` /
	 * `restrictedTools`).
	 */
	updateCurrentItemRef(itemRef: AssessmentItemRef | null): void;

	/**
	 * Override the auto-mode QTI enforcement decision. Pass `"on"` /
	 * `"off"` to pin the mode, or `null` to clear the override and
	 * return to auto-mode.
	 */
	setQtiEnforcement(mode: QtiEnforcementMode | null): void;

	/**
	 * Read the engine inputs currently driving decisions. Useful for
	 * debugging / instrumentation; do not mutate.
	 */
	getPolicyInputs(): Readonly<ResolvedEngineInputs>;

	/**
	 * Register a custom `PolicySource`. The source participates in
	 * every subsequent `decideToolPolicy(...)` call until disposed
	 * (the returned function detaches).
	 */
	registerPolicySource(source: PolicySource): () => void;
}

// I18nServiceApi is re-exported from @pie-players/pie-players-shared/i18n
