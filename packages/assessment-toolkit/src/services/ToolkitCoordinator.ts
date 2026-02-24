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
import { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import { ElementToolStateStore } from "./ElementToolStateStore.js";
import { HighlightCoordinator } from "./HighlightCoordinator.js";
import { ToolCoordinator } from "./ToolCoordinator.js";
import { TTSService } from "./TTSService.js";
import { BrowserTTSProvider } from "./tts/browser-provider.js";
import {
	ToolProviderRegistry,
	DesmosToolProvider,
	MathJsToolProvider,
	TIToolProvider,
	TTSToolProvider,
} from "./tool-providers/index.js";
import type { IToolProvider } from "./tool-providers/IToolProvider.js";
import type {
	DesmosToolProviderConfig,
	MathJsToolProviderConfig,
	TIToolProviderConfig,
	TTSToolProviderConfig,
} from "./tool-providers/index.js";

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
		Partial<
			DesmosToolProviderConfig | TIToolProviderConfig | MathJsToolProviderConfig
		>
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

	/**
	 * Optional lifecycle and extension hooks for runtime customization.
	 */
	hooks?: ToolkitCoordinatorHooks;

	/**
	 * Lazy initialization mode.
	 * When true, async service/provider initialization is deferred until ensure methods are called.
	 *
	 * @default false
	 */
	lazyInit?: boolean;
}

const DEFAULT_FLOATING_TOOLS: string[] = [
	"calculator",
	"calculatorScientific",
	"calculatorGraphing",
	"graph",
	"periodicTable",
	"protractor",
	"ruler",
	"lineReader",
	"magnifier",
	"screenMagnifier",
	"textToSpeech",
	"answerEliminator",
];

export interface ToolkitErrorContext {
	phase:
		| "coordinator-ready"
		| "state-load"
		| "state-save"
		| "provider-register"
		| "provider-init"
		| "tts-init";
	providerId?: string;
	details?: Record<string, unknown>;
}

export interface ProviderLifecycleContext {
	providerId: string;
	providerName?: string;
}

export interface ToolkitInitStatus {
	tts: boolean;
	stateLoaded: boolean;
	coordinator: boolean;
	providers: Record<string, boolean>;
}

export interface ToolkitCoordinatorHooks {
	onError?: (error: Error, context: ToolkitErrorContext) => void;
	onTTSError?: (error: Error, context: ToolkitErrorContext) => void;
	onProviderError?: (
		providerId: string,
		error: Error,
		context: ToolkitErrorContext,
	) => void;

	onBeforeTTSInit?: (context: ToolkitErrorContext) => void | Promise<void>;
	onTTSReady?: () => void | Promise<void>;
	onCoordinatorReady?: (
		coordinator: ToolkitCoordinator,
	) => void | Promise<void>;

	onProviderRegistered?: (
		providerId: string,
		meta: ProviderLifecycleContext,
	) => void | Promise<void>;
	onProviderInitStart?: (
		providerId: string,
		meta: ProviderLifecycleContext,
	) => void | Promise<void>;
	onProviderReady?: (
		providerId: string,
		meta: ProviderLifecycleContext,
	) => void | Promise<void>;

	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;

	loadToolState?: () =>
		| Record<string, Record<string, unknown>>
		| Promise<Record<string, Record<string, unknown>> | null | undefined>
		| null
		| undefined;
	saveToolState?: (
		state: Record<string, Record<string, unknown>>,
	) => void | Promise<void>;
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
	readonly hooks: ToolkitCoordinatorHooks;
	readonly lazyInit: boolean;

	/** Track TTS initialization state */
	private ttsInitialized = false;
	private ttsInitPromise?: Promise<void>;
	private stateLoaded = false;
	private stateLoadPromise?: Promise<void>;
	private coordinatorReadyPromise?: Promise<void>;
	private coordinatorReadyNotified = false;
	private readonly providerInitPromises = new Map<string, Promise<IToolProvider>>();

	/** Callback for floating tools changes */
	private floatingToolsChangeCallback: ((toolIds: string[]) => void) | null =
		null;

	private static resolveConfig(
		config: ToolkitCoordinatorConfig,
	): ToolkitCoordinatorConfig {
		const defaultTools = {
			tts: {
				enabled: true,
				backend: "browser" as const,
			},
			answerEliminator: {
				enabled: true,
			},
			highlighter: {
				enabled: true,
			},
			flagging: {
				enabled: true,
			},
			floatingTools: {
				enabledTools: [...DEFAULT_FLOATING_TOOLS],
				calculator: {
					enabled: true,
					provider: "desmos" as const,
				},
			},
		};

		return {
			...config,
			tools: {
				...defaultTools,
				...config.tools,
				tts: {
					...defaultTools.tts,
					...config.tools?.tts,
				},
				answerEliminator: {
					...defaultTools.answerEliminator,
					...config.tools?.answerEliminator,
				},
				highlighter: {
					...defaultTools.highlighter,
					...config.tools?.highlighter,
				},
				flagging: {
					...defaultTools.flagging,
					...config.tools?.flagging,
				},
				floatingTools: {
					...defaultTools.floatingTools,
					...config.tools?.floatingTools,
					calculator: {
						...defaultTools.floatingTools.calculator,
						...config.tools?.floatingTools?.calculator,
					},
				},
			},
			accessibility: {
				language: "en-US",
				...(config.accessibility ?? {}),
				catalogs: config.accessibility?.catalogs ?? [],
			},
		};
	}

	constructor(config: ToolkitCoordinatorConfig) {
		if (!config.assessmentId) {
			throw new Error("ToolkitCoordinator requires assessmentId in config");
		}

		const resolvedConfig = ToolkitCoordinator.resolveConfig(config);

		this.assessmentId = resolvedConfig.assessmentId;
		this.config = resolvedConfig;
		this.hooks = resolvedConfig.hooks ?? {};
		this.lazyInit = config.lazyInit === true;

		// Initialize all services
		this.toolCoordinator = new ToolCoordinator();
		this.highlightCoordinator = new HighlightCoordinator();
		this.elementToolStateStore = new ElementToolStateStore();
		this.catalogResolver = new AccessibilityCatalogResolver(
			resolvedConfig.accessibility?.catalogs || [],
			resolvedConfig.accessibility?.language || "en-US",
		);

		// Initialize tool provider registry
		this.toolProviderRegistry = new ToolProviderRegistry();
		this._registerToolProviders();

		// Initialize TTS service based on config
		this.ttsService = new TTSService();
		this.setupStatePersistenceHooks();

		if (!this.lazyInit) {
			void this.waitUntilReady().catch((err) => {
				console.error(
					"[ToolkitCoordinator] Failed eager initialization:",
					err,
				);
				this.handleError(err, { phase: "coordinator-ready" });
			});
		}
	}

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.hooks.onTelemetry?.(eventName, payload);
		} catch (err) {
			console.warn("[ToolkitCoordinator] telemetry hook failed:", err);
		}
	}

	private handleError(error: unknown, context: ToolkitErrorContext): void {
		const normalized = error instanceof Error ? error : new Error(String(error));
		try {
			this.hooks.onError?.(normalized, context);
		} catch (hookError) {
			console.warn("[ToolkitCoordinator] onError hook failed:", hookError);
		}
	}

	private setupStatePersistenceHooks(): void {
		this.elementToolStateStore.setOnStateChange((state) => {
			if (!this.hooks.saveToolState) return;
			void Promise.resolve(this.hooks.saveToolState(state)).catch((err) => {
				this.handleError(err, { phase: "state-save" });
			});
		});
	}

	private async ensureStateLoaded(): Promise<void> {
		if (this.stateLoaded) return;
		if (this.stateLoadPromise) return this.stateLoadPromise;
		this.stateLoadPromise = (async () => {
			const loader = this.hooks.loadToolState;
			if (!loader) {
				return;
			}
			try {
				const state = await loader();
				if (state && typeof state === "object") {
					this.elementToolStateStore.loadState(state);
				}
				this.stateLoaded = true;
				await this.emitTelemetry("tool-state-loaded", {
					hasState: Boolean(state),
				});
			} catch (err) {
				this.handleError(err, { phase: "state-load" });
			}
		})().finally(() => {
			this.stateLoadPromise = undefined;
		});
		return this.stateLoadPromise;
	}

	/**
	 * Register tool providers in the registry
	 */
	private _registerToolProviders(): void {
		// Register TTS provider
		const ttsConfig = this.config.tools?.tts;
		if (ttsConfig?.enabled !== false) {
			const backend = ttsConfig?.backend || "browser";
			void this.registerProvider("tts", {
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
		}

		// Register calculator providers
		const floatingTools = this.config.tools?.floatingTools;
		const calculatorConfig = floatingTools?.calculator;
		if (calculatorConfig?.enabled !== false) {
			const provider = calculatorConfig?.provider || "desmos";

			if (provider === "desmos") {
				void this.registerProvider("calculator-desmos", {
					provider: new DesmosToolProvider(),
					config: {},
					lazy: true,
					authFetcher: calculatorConfig?.authFetcher,
				});
			} else if (provider === "ti") {
				void this.registerProvider("calculator-ti", {
					provider: new TIToolProvider(),
					config: {},
					lazy: true,
				});
			} else if (provider === "mathjs") {
				void this.registerProvider("calculator-mathjs", {
					provider: new MathJsToolProvider(),
					config: {},
					lazy: true,
				});
			}
		}
	}

	private async registerProvider(
		providerId: string,
		config: Parameters<ToolProviderRegistry["register"]>[1],
	): Promise<void> {
		try {
			this.toolProviderRegistry.register(providerId, config);
			const meta: ProviderLifecycleContext = {
				providerId,
				providerName: config.provider.providerName,
			};
			await this.hooks.onProviderRegistered?.(providerId, meta);
			await this.emitTelemetry("provider-registered", {
				providerId,
				providerName: config.provider.providerName,
			});
		} catch (err) {
			console.warn(
				`[ToolkitCoordinator] Failed to register provider "${providerId}":`,
				err,
			);
			this.handleError(err, { phase: "provider-register", providerId });
			this.hooks.onProviderError?.(providerId, err as Error, {
				phase: "provider-register",
				providerId,
			});
		}
	}

	public async ensureProviderReady(providerId: string): Promise<IToolProvider> {
		const existing = this.providerInitPromises.get(providerId);
		if (existing) return existing;
		const promise = (async () => {
			const provider = await this.toolProviderRegistry.getProvider(providerId, false);
			const meta: ProviderLifecycleContext = {
				providerId,
				providerName: provider.providerName,
			};
			try {
				await this.hooks.onProviderInitStart?.(providerId, meta);
				await this.toolProviderRegistry.initialize(providerId);
				await this.hooks.onProviderReady?.(providerId, meta);
				await this.emitTelemetry("provider-ready", { providerId });
				return provider;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				this.hooks.onProviderError?.(providerId, error, {
					phase: "provider-init",
					providerId,
				});
				this.handleError(error, { phase: "provider-init", providerId });
				throw error;
			}
		})().finally(() => {
			this.providerInitPromises.delete(providerId);
		});
		this.providerInitPromises.set(providerId, promise);
		return promise;
	}

	public setHooks(hooks: ToolkitCoordinatorHooks): void {
		Object.assign(this.hooks, hooks);
		this.setupStatePersistenceHooks();

		if (hooks.onCoordinatorReady && this.isReady()) {
			void Promise.resolve(hooks.onCoordinatorReady(this)).catch((err) => {
				this.handleError(err, { phase: "coordinator-ready" });
			});
		}
	}

	/**
	 * Initialize TTS service with provider
	 */
	public async ensureTTSReady(config?: TTSToolConfig): Promise<void> {
		if (this.ttsInitialized) return;
		if (this.ttsInitPromise) return this.ttsInitPromise;
		this.ttsInitPromise = this._initializeTTS(config).finally(() => {
			this.ttsInitPromise = undefined;
		});
		return this.ttsInitPromise;
	}

	private async _initializeTTS(config?: TTSToolConfig): Promise<void> {
		if (this.ttsInitialized) return;
		await this.hooks.onBeforeTTSInit?.({
			phase: "tts-init",
			details: {
				backend: config?.backend,
			},
		});
		await this.emitTelemetry("tts-init-start", {
			backend: config?.backend ?? this.config.tools?.tts?.backend ?? "browser",
		});

		// Try to use TTS provider from registry if available
		if (this.toolProviderRegistry.has("tts")) {
			try {
				const ttsProvider = await this.ensureProviderReady("tts");
				const providerInstance = await ttsProvider.createInstance();
				await this.ttsService.initialize(providerInstance);
				this.ttsService.setCatalogResolver(this.catalogResolver);
				this.ttsInitialized = true;
				await this.hooks.onTTSReady?.();
				await this.emitTelemetry("tts-init-success", {
					provider: "registry",
				});
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
		try {
			await this.ttsService.initialize(provider, config);
			this.ttsService.setCatalogResolver(this.catalogResolver);
			this.ttsInitialized = true;
			await this.hooks.onTTSReady?.();
			await this.emitTelemetry("tts-init-success", {
				provider: "browser-fallback",
			});
		} catch (error) {
			const normalized =
				error instanceof Error ? error : new Error(String(error));
			this.hooks.onTTSError?.(normalized, { phase: "tts-init" });
			this.handleError(normalized, { phase: "tts-init" });
			await this.emitTelemetry("tts-init-error", {
				message: normalized.message,
			});
			throw normalized;
		}
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
		return this.ensureProviderReady(providerId);
	}

	async waitUntilReady(): Promise<void> {
		if (this.isReady()) return;
		if (this.coordinatorReadyPromise) return this.coordinatorReadyPromise;
		this.coordinatorReadyPromise = (async () => {
			await this.ensureStateLoaded();
			const ttsConfig = this.config.tools?.tts;
			if (ttsConfig?.enabled !== false) {
				await this.ensureTTSReady(ttsConfig);
			}
			if (!this.coordinatorReadyNotified) {
				this.coordinatorReadyNotified = true;
				await this.hooks.onCoordinatorReady?.(this);
				await this.emitTelemetry("coordinator-ready", {
					assessmentId: this.assessmentId,
				});
			}
		})().finally(() => {
			this.coordinatorReadyPromise = undefined;
		});
		return this.coordinatorReadyPromise;
	}

	isReady(): boolean {
		return this.getInitStatus().coordinator;
	}

	getInitStatus(): ToolkitInitStatus {
		const providers: Record<string, boolean> = {};
		for (const providerId of this.toolProviderRegistry.getProviderIds()) {
			providers[providerId] = this.toolProviderRegistry.isInitialized(providerId);
		}
		return {
			tts: this.ttsInitialized,
			stateLoaded: this.stateLoaded || !this.hooks.loadToolState,
			coordinator:
				(this.stateLoaded || !this.hooks.loadToolState) &&
				(this.ttsInitialized || this.config.tools?.tts?.enabled === false),
			providers,
		};
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
	 * Update the enabled tools list for floating tools (calculator, graph, etc.).
	 * Used for PNP profile changes or dynamic tool configuration.
	 *
	 * @param toolIds Array of tool IDs to enable
	 */
	updateFloatingTools(toolIds: string[]): void {
		if (!this.config.tools) {
			this.config.tools = {};
		}
		if (!this.config.tools.floatingTools) {
			this.config.tools.floatingTools = {};
		}
		this.config.tools.floatingTools.enabledTools = toolIds;

		// Notify listener of change
		if (this.floatingToolsChangeCallback) {
			this.floatingToolsChangeCallback(toolIds);
		}
	}

	/**
	 * Get currently enabled floating tools.
	 *
	 * @returns Array of enabled tool IDs
	 */
	getFloatingTools(): string[] {
		return this.config.tools?.floatingTools?.enabledTools || [];
	}

	/**
	 * Set a callback to be notified when floating tools change.
	 *
	 * @param callback Function to call when floating tools are updated
	 * @returns Unsubscribe function
	 */
	onFloatingToolsChange(callback: (toolIds: string[]) => void): () => void {
		this.floatingToolsChangeCallback = callback;
		// Call immediately with current value
		callback(this.getFloatingTools());
		// Return unsubscribe function
		return () => {
			this.floatingToolsChangeCallback = null;
		};
	}

	/**
	 * Apply tool configuration changes to underlying services.
	 * Called after updateToolConfig().
	 */
	private _applyToolConfigChange(
		toolId: string,
		_updates: Partial<ToolConfig>,
	): void {
		// Apply configuration changes based on tool
		switch (toolId) {
			case "tts":
				void this._reconfigureTTSProvider().then(async () => {
					const ttsConfig = this.config.tools?.tts;
					if (!this.lazyInit && ttsConfig?.enabled !== false) {
						await this.ensureTTSReady(ttsConfig);
					}
				});
				break;

			case "answerEliminator":
				// Future: Could notify answer eliminator tools of strategy change
				break;

			// Add cases for other tools as needed
		}
	}

	private async _reconfigureTTSProvider(): Promise<void> {
		this.ttsInitialized = false;
		this.ttsInitPromise = undefined;
		try {
			this.ttsService.stop();
		} catch {
			// noop: stop best effort
		}

		if (this.toolProviderRegistry.has("tts")) {
			await this.toolProviderRegistry.unregister("tts");
		}

		const ttsConfig = this.config.tools?.tts;
		if (ttsConfig?.enabled === false) return;

		const backend = ttsConfig?.backend || "browser";
		await this.registerProvider("tts", {
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
	}
}
