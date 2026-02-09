/**
 * ToolkitCoordinator - Centralized Assessment Toolkit Service Management
 *
 * Orchestrates all toolkit services (TTS, tools, accessibility, state management) from a single entry point.
 * Provides centralized configuration for tool availability and settings.
 *
 * Key features:
 * - Owns all toolkit services (TTSService, ToolCoordinator, HighlightCoordinator, ElementToolStateStore, AccessibilityCatalogResolver)
 * - Single configuration point for tool availability and settings
 * - Sensible defaults for standalone usage
 * - Direct access for settings widgets (no player dependency)
 * - Clean separation: toolkit concerns only (NOT assessment state like navigation, timing, progress)
 *
 * Part of PIE Assessment Toolkit.
 */

import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";
import { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver";
import { ElementToolStateStore } from "./ElementToolStateStore";
import { HighlightCoordinator } from "./HighlightCoordinator";
import { ToolCoordinator } from "./ToolCoordinator";
import { TTSService } from "./TTSService";
import { BrowserTTSProvider } from "./tts/browser-provider";
import {
	ToolProviderRegistry,
	DesmosToolProvider,
	TIToolProvider,
	TTSToolProvider,
} from "./tool-providers";
import type {
	DesmosToolProviderConfig,
	TIToolProviderConfig,
	TTSToolProviderConfig,
} from "./tool-providers";

/**
 * Generic tool configuration
 */
export interface ToolConfig {
	enabled?: boolean;
	[key: string]: any; // Tool-specific settings
}

/**
 * TTS tool configuration
 */
export interface TTSToolConfig extends ToolConfig {
	backend?: "browser" | "polly" | "google" | "server";
	defaultVoice?: string;
	rate?: number;
	pitch?: number;
	apiEndpoint?: string;
	authFetcher?: () => Promise<Partial<TTSToolProviderConfig>>;
}

/**
 * Answer eliminator tool configuration
 */
export interface AnswerEliminatorToolConfig extends ToolConfig {
	strategy?: "strikethrough" | "hide";
}

/**
 * Calculator tool configuration
 */
export interface CalculatorToolConfig extends ToolConfig {
	provider?: "desmos" | "ti" | "mathjs";
	authFetcher?: () => Promise<
		Partial<DesmosToolProviderConfig | TIToolProviderConfig>
	>;
}

/**
 * Floating tools configuration (calculator, graph, etc.)
 */
export interface FloatingToolsConfig extends ToolConfig {
	enabledTools?: string[];
	calculator?: CalculatorToolConfig;
}

/**
 * Configuration for ToolkitCoordinator
 */
export interface ToolkitCoordinatorConfig {
	/**
	 * Unique identifier for the assessment content.
	 * Used for scoping tool state across sections.
	 */
	assessmentId: string;

	/**
	 * Tool availability and configuration.
	 * Defaults: all tools enabled with default settings.
	 */
	tools?: {
		tts?: TTSToolConfig;
		answerEliminator?: AnswerEliminatorToolConfig;
		highlighter?: ToolConfig;
		flagging?: ToolConfig;
		floatingTools?: FloatingToolsConfig;
	};

	/**
	 * Accessibility configuration.
	 * Includes QTI 3.0 accessibility catalogs and language settings.
	 */
	accessibility?: {
		catalogs?: AccessibilityCatalog[];
		language?: string;
	};
}

/**
 * Service bundle returned by getServiceBundle()
 */
export interface ToolkitServiceBundle {
	ttsService: TTSService;
	toolCoordinator: ToolCoordinator;
	highlightCoordinator: HighlightCoordinator;
	elementToolStateStore: ElementToolStateStore;
	catalogResolver: AccessibilityCatalogResolver;
	toolProviderRegistry: ToolProviderRegistry;
}

/**
 * ToolkitCoordinator - Orchestrates all assessment toolkit services
 *
 * @example
 * ```typescript
 * // Create coordinator with configuration
 * const coordinator = new ToolkitCoordinator({
 *   assessmentId: 'demo-three-questions',
 *   tools: {
 *     tts: { enabled: true, defaultVoice: 'en-US' },
 *     answerEliminator: { enabled: true, strategy: 'strikethrough' }
 *   }
 * });
 *
 * // Pass to section player
 * player.toolkitCoordinator = coordinator;
 *
 * // Access services directly
 * const ttsService = coordinator.ttsService;
 * const toolState = coordinator.elementToolStateStore.getAllState();
 * ```
 */
export class ToolkitCoordinator {
	/** Assessment identifier (for scoping tool state) */
	readonly assessmentId: string;

	/** Configuration */
	readonly config: ToolkitCoordinatorConfig;

	/** Managed services (public for direct access) */
	readonly ttsService: TTSService;
	readonly toolCoordinator: ToolCoordinator;
	readonly highlightCoordinator: HighlightCoordinator;
	readonly elementToolStateStore: ElementToolStateStore;
	readonly catalogResolver: AccessibilityCatalogResolver;
	readonly toolProviderRegistry: ToolProviderRegistry;

	/** Track TTS initialization state */
	private ttsInitialized = false;

	constructor(config: ToolkitCoordinatorConfig) {
		if (!config.assessmentId) {
			throw new Error("ToolkitCoordinator requires assessmentId in config");
		}

		this.assessmentId = config.assessmentId;
		this.config = config;

		// Initialize all services
		this.toolCoordinator = new ToolCoordinator();
		this.highlightCoordinator = new HighlightCoordinator();
		this.elementToolStateStore = new ElementToolStateStore();
		this.catalogResolver = new AccessibilityCatalogResolver(
			config.accessibility?.catalogs || [],
			config.accessibility?.language || "en-US",
		);

		// Initialize tool provider registry
		this.toolProviderRegistry = new ToolProviderRegistry();
		this._registerToolProviders();

		// Initialize TTS service based on config
		this.ttsService = new TTSService();
		const ttsConfig = config.tools?.tts;
		if (ttsConfig?.enabled !== false) {
			// Initialize async (fire and forget - service will become available when ready)
			this._initializeTTS(ttsConfig).catch((err) => {
				console.error("[ToolkitCoordinator] Failed to initialize TTS:", err);
			});
		}
	}

	/**
	 * Register tool providers in the registry
	 */
	private _registerToolProviders(): void {
		// Register TTS provider
		const ttsConfig = this.config.tools?.tts;
		if (ttsConfig?.enabled !== false) {
			const backend = ttsConfig?.backend || "browser";
			try {
				this.toolProviderRegistry.register("tts", {
					provider: new TTSToolProvider(backend),
					config: {
						backend,
						apiEndpoint: ttsConfig?.apiEndpoint,
						voice: ttsConfig?.defaultVoice,
						rate: ttsConfig?.rate,
						pitch: ttsConfig?.pitch,
					},
					lazy: true,
					authFetcher: ttsConfig?.authFetcher,
				});
			} catch (error) {
				console.warn(
					"[ToolkitCoordinator] Failed to register TTS provider:",
					error,
				);
			}
		}

		// Register calculator providers
		const floatingTools = this.config.tools?.floatingTools;
		const calculatorConfig = floatingTools?.calculator;
		if (calculatorConfig?.enabled !== false) {
			const provider = calculatorConfig?.provider || "desmos";

			if (provider === "desmos") {
				try {
					this.toolProviderRegistry.register("calculator-desmos", {
						provider: new DesmosToolProvider(),
						config: {},
						lazy: true,
						authFetcher: calculatorConfig?.authFetcher,
					});
				} catch (error) {
					console.warn(
						"[ToolkitCoordinator] Failed to register Desmos calculator provider:",
						error,
					);
				}
			} else if (provider === "ti") {
				try {
					this.toolProviderRegistry.register("calculator-ti", {
						provider: new TIToolProvider(),
						config: {},
						lazy: true,
					});
				} catch (error) {
					console.warn(
						"[ToolkitCoordinator] Failed to register TI calculator provider:",
						error,
					);
				}
			}
		}
	}

	/**
	 * Initialize TTS service with provider
	 */
	private async _initializeTTS(config?: TTSToolConfig): Promise<void> {
		if (this.ttsInitialized) return;

		// Try to use TTS provider from registry if available
		if (this.toolProviderRegistry.has("tts")) {
			try {
				const ttsProvider = await this.toolProviderRegistry.getProvider("tts");
				const providerInstance = await ttsProvider.createInstance();
				await this.ttsService.initialize(providerInstance);
				this.ttsService.setCatalogResolver(this.catalogResolver);
				this.ttsInitialized = true;
				console.log(
					"[ToolkitCoordinator] TTS initialized via ToolProviderRegistry",
				);
				return;
			} catch (error) {
				console.warn(
					"[ToolkitCoordinator] Failed to initialize TTS via registry, falling back to browser provider:",
					error,
				);
			}
		}

		// Fallback to browser provider
		const provider = new BrowserTTSProvider();
		await this.ttsService.initialize(provider);
		this.ttsService.setCatalogResolver(this.catalogResolver);

		// Apply TTS-specific configuration
		if (config) {
			// Future: Apply voice, rate, pitch settings to provider
			// For now, these are hints for UI (voice picker, rate slider)
		}

		this.ttsInitialized = true;
	}

	/**
	 * Get all services as a bundle for section player convenience.
	 * Section player can extract and pass services to child components.
	 */
	getServiceBundle(): ToolkitServiceBundle {
		return {
			ttsService: this.ttsService,
			toolCoordinator: this.toolCoordinator,
			highlightCoordinator: this.highlightCoordinator,
			elementToolStateStore: this.elementToolStateStore,
			catalogResolver: this.catalogResolver,
			toolProviderRegistry: this.toolProviderRegistry,
		};
	}

	/**
	 * Get a tool provider from the registry
	 *
	 * @param providerId Provider identifier
	 * @returns Tool provider instance
	 */
	async getToolProvider(providerId: string) {
		return this.toolProviderRegistry.getProvider(providerId);
	}

	/**
	 * Check if a tool is enabled.
	 * Tools are enabled by default unless explicitly disabled.
	 *
	 * @param toolId Tool identifier (e.g., 'tts', 'answerEliminator')
	 * @returns True if tool is enabled
	 */
	isToolEnabled(toolId: string): boolean {
		const toolConfig = (this.config.tools as any)?.[toolId];
		// Enabled by default unless explicitly set to false
		return toolConfig?.enabled !== false;
	}

	/**
	 * Get tool configuration.
	 *
	 * @param toolId Tool identifier
	 * @returns Tool configuration or null if not configured
	 */
	getToolConfig(toolId: string): ToolConfig | null {
		return (this.config.tools as any)?.[toolId] || null;
	}

	/**
	 * Update tool configuration.
	 * Applies changes to underlying services.
	 *
	 * @param toolId Tool identifier
	 * @param updates Partial configuration updates
	 */
	updateToolConfig(toolId: string, updates: Partial<ToolConfig>): void {
		// Update config
		const current = this.getToolConfig(toolId) || {};
		if (!this.config.tools) {
			this.config.tools = {};
		}
		(this.config.tools as any)[toolId] = { ...current, ...updates };

		// Apply configuration changes to services
		this._applyToolConfigChange(toolId, updates);
	}

	/**
	 * Apply tool configuration changes to underlying services.
	 * Called after updateToolConfig().
	 */
	private _applyToolConfigChange(
		toolId: string,
		updates: Partial<ToolConfig>,
	): void {
		// Apply configuration changes based on tool
		switch (toolId) {
			case "tts":
				// Future: Update TTSService with voice/rate/pitch changes
				// For now, config is used by UI widgets to show current settings
				break;

			case "answerEliminator":
				// Future: Could notify answer eliminator tools of strategy change
				break;

			// Add cases for other tools as needed
		}
	}
}
