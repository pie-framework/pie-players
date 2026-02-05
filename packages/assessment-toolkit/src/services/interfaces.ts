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
} from "./AccessibilityCatalogResolver";
import type { HighlightColor, HighlightType } from "./HighlightCoordinator";
import type { FontSize, ThemeConfig } from "./ThemeProvider";
import type { ZIndexLayer } from "./ToolCoordinator";
import type { PlaybackState, TTSConfig } from "./TTSService";
import type {
	ITTSProvider,
	TTSProviderCapabilities,
} from "./tts/provider-interface";

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

// II18nService is re-exported from @pie-players/pie-players-shared/i18n
