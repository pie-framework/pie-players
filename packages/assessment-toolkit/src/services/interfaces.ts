/**
 * Service Interfaces
 *
 * Public interfaces for all core assessment toolkit services.
 * These interfaces define the contracts that service implementations must fulfill,
 * enabling dependency injection, testing, and custom implementations.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { II18nService } from "@pie-players/pie-players-shared/i18n";
import type {
	AccessibilityCatalogResolver,
	CatalogLookupOptions,
	CatalogStatistics,
	CatalogType,
	ResolvedCatalog,
} from "./AccessibilityCatalogResolver.js";
import type { HighlightColor, HighlightType } from "./HighlightCoordinator.js";
import type {
	SectionControllerHandle,
	ToolkitCoordinatorHooks,
	ToolkitInitStatus,
} from "./ToolkitCoordinator.js";
import type { FontSize, ThemeConfig } from "./ThemeProvider.js";
import type { ZIndexLayer } from "./ToolCoordinator.js";
import type { PlaybackState, TTSConfig } from "./TTSService.js";
import type { ToolProviderRegistry } from "./tool-providers/ToolProviderRegistry.js";
import type {
	ITTSProvider,
	TTSProviderCapabilities,
} from "./tts/provider-interface.js";

// Re-export II18nService from players-shared
export type { II18nService };

/**
 * Theme provider interface
 *
 * Applies consistent accessibility theming across items and tools.
 */
export interface IThemeProvider {
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
export interface IHighlightCoordinator {
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
export interface IToolCoordinator {
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
export interface ITTSService {
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
		options?: { catalogId?: string; language?: string },
	): Promise<void>;

	/**
	 * Speak a text range
	 */
	speakRange(range: Range): Promise<void>;

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
	setHighlightCoordinator(coordinator: IHighlightCoordinator): void;

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
export interface IAccessibilityCatalogResolver {
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
export interface IElementToolStateStore {
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
export interface IToolkitCoordinator {
	/**
	 * Assessment identifier
	 */
	readonly assessmentId: string;

	/**
	 * Configuration
	 */
	readonly config: any;

	/**
	 * TTS service
	 */
	readonly ttsService: ITTSService;

	/**
	 * Tool coordinator
	 */
	readonly toolCoordinator: IToolCoordinator;

	/**
	 * Highlight coordinator
	 */
	readonly highlightCoordinator: IHighlightCoordinator;

	/**
	 * Element tool state store
	 */
	readonly elementToolStateStore: IElementToolStateStore;

	/**
	 * Catalog resolver
	 */
	readonly catalogResolver: IAccessibilityCatalogResolver;

	/**
	 * Tool provider registry
	 */
	readonly toolProviderRegistry: ToolProviderRegistry;

	/**
	 * Get all services as a bundle
	 */
	getServiceBundle(): {
		ttsService: ITTSService;
		toolCoordinator: IToolCoordinator;
		highlightCoordinator: IHighlightCoordinator;
		elementToolStateStore: IElementToolStateStore;
		catalogResolver: IAccessibilityCatalogResolver;
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
	getToolConfig(toolId: string): any | null;

	/**
	 * Update tool configuration
	 */
	updateToolConfig(toolId: string, updates: any): void;

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
}

// II18nService is re-exported from @pie-players/pie-players-shared/i18n
