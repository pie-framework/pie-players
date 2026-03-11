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
import {
	normalizeToolsConfig,
	type CanonicalToolsConfig,
	type ToolPlacementConfig,
	type ToolPolicyConfig,
	type ToolProviderConfig,
	type ToolProvidersConfig,
	resolveToolsForLevel,
} from "./tools-config-normalizer.js";
import { DEFAULT_TOOL_ALIAS_MAP } from "./tool-config-defaults.js";
import { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import { ElementToolStateStore } from "./ElementToolStateStore.js";
import { HighlightCoordinator } from "./HighlightCoordinator.js";
import { ToolCoordinator } from "./ToolCoordinator.js";
import { TTSService, type ITTSProvider, type TTSConfig } from "./TTSService.js";
import { BrowserTTSProvider } from "./tts/browser-provider.js";
import {
	buildRuntimeTTSConfig,
	resolveTTSBackend,
} from "./tts-runtime-config.js";
import { ToolProviderRegistry } from "./tool-providers/index.js";
import type { IToolProvider } from "./tool-providers/IToolProvider.js";
import type {
	TTSToolProviderConfig,
} from "./tool-providers/index.js";
import { createPackagedToolRegistry } from "./createDefaultToolRegistry.js";
import type { ToolRegistration } from "./ToolRegistry.js";
import type {
	SectionControllerContext,
	SectionControllerEvent,
	SectionControllerEventType,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionSessionPersistenceStrategy,
	SectionPersistenceFactoryDefaults,
} from "./section-controller-types.js";
export type {
	SectionControllerContext,
	SectionControllerEvent,
	SectionControllerEventType,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionSessionPersistenceConfig,
	SectionSessionPersistenceStrategy,
	SectionControllerRuntimeState,
	SectionControllerSessionState,
	SectionPersistenceFactoryDefaults,
} from "./section-controller-types.js";

/**
 * Generic tool configuration
 */
export interface ToolConfig {
	enabled?: boolean;
	provider?: unknown;
	settings?: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * TTS tool configuration
 */
export interface TTSToolConfig extends ToolConfig {
	backend?: "browser" | "polly" | "google" | "server";
	provider?: "polly" | "google" | "custom";
	serverProvider?: "polly" | "google" | "custom";
	engine?: "standard" | "neural";
	sampleRate?: number;
	format?: "mp3" | "ogg" | "pcm";
	speechMarksMode?: "word" | "word+sentence";
	defaultVoice?: string;
	rate?: number;
	pitch?: number;
	apiEndpoint?: string;
	language?: string;
	transportMode?: "pie" | "custom";
	endpointMode?: "synthesizePath" | "rootPost";
	endpointValidationMode?: "voices" | "endpoint" | "none";
	includeAuthOnAssetFetch?: boolean;
	validateEndpoint?: boolean;
	cache?: boolean;
	speedRate?: "slow" | "medium" | "fast";
	lang_id?: string;
	speedOptions?: number[];
	authFetcher?: () => Promise<Partial<TTSToolProviderConfig>>;
}

/**
 * Answer eliminator tool configuration
 */
export interface AnswerEliminatorToolConfig extends ToolConfig {
	strategy?: "strikethrough" | "hide";
}

export interface ToolkitToolsConfig extends CanonicalToolsConfig {
	policy: ToolPolicyConfig;
	placement: Required<ToolPlacementConfig>;
	providers: ToolProvidersConfig;
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
		policy?: ToolPolicyConfig;
		placement?: ToolPlacementConfig;
		providers?: ToolProvidersConfig;
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

export interface ToolkitErrorContext {
	phase:
		| "coordinator-ready"
		| "state-load"
		| "state-save"
		| "provider-register"
		| "provider-init"
		| "tts-init"
		| "section-controller-init"
		| "section-controller-dispose";
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

export interface SectionControllerLifecycleEvent {
	type: "ready" | "disposed";
	key: SectionControllerKey;
	controller?: SectionControllerHandle;
}

export interface SectionEventSubscriptionArgs {
	sectionId?: string;
	attemptId?: string;
	listener: (event: SectionControllerEvent) => void;
	eventTypes?: readonly SectionControllerEventType[];
	itemIds?: readonly string[];
}

export type SectionItemEventType = Exclude<
	SectionControllerEventType,
	| "section-navigation-change"
	| "section-loading-complete"
	| "section-items-complete-changed"
	| "section-error"
>;

export type SectionScopedEventType = Extract<
	SectionControllerEventType,
	| "section-navigation-change"
	| "section-loading-complete"
	| "section-items-complete-changed"
	| "section-error"
>;

export type SectionItemEvent = Extract<
	SectionControllerEvent,
	{ type: SectionItemEventType }
>;

export type SectionScopedEvent = Extract<
	SectionControllerEvent,
	{ type: SectionScopedEventType }
>;

export interface SectionItemEventSubscriptionArgs {
	sectionId?: string;
	attemptId?: string;
	listener: (event: SectionItemEvent) => void;
	eventTypes?: readonly SectionItemEventType[];
	itemIds?: readonly string[];
}

export interface SectionScopedEventSubscriptionArgs {
	sectionId?: string;
	attemptId?: string;
	listener: (event: SectionScopedEvent) => void;
	eventTypes?: readonly SectionScopedEventType[];
}

const SECTION_ITEM_EVENT_TYPES: readonly SectionItemEventType[] = [
	"item-selected",
	"item-session-data-changed",
	"item-session-meta-changed",
	"item-complete-changed",
	"content-loaded",
	"item-player-error",
];

const SECTION_SCOPED_EVENT_TYPES: readonly SectionScopedEventType[] = [
	"section-navigation-change",
	"section-loading-complete",
	"section-items-complete-changed",
	"section-error",
];

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

	/**
	 * Provide section-level controller overrides only.
	 * Avoid instantiating per-item controller graphs here unless item lifecycle
	 * requirements explicitly demand it.
	 */
	createSectionController?: (
		context: SectionControllerContext,
		defaults: SectionControllerFactoryDefaults,
	) => SectionControllerHandle | Promise<SectionControllerHandle>;

	createSectionSessionPersistence?: (
		context: SectionControllerContext,
		defaults: SectionPersistenceFactoryDefaults,
	) =>
		| SectionSessionPersistenceStrategy
		| Promise<SectionSessionPersistenceStrategy>;

	onSectionControllerReady?: (
		context: SectionControllerContext,
		controller: SectionControllerHandle,
	) => void | Promise<void>;

	onSectionControllerDispose?: (
		context: SectionControllerContext,
		controller: SectionControllerHandle,
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
	private readonly packagedToolRegistry = createPackagedToolRegistry();
	private readonly sectionControllers = new Map<string, SectionControllerHandle>();
	private readonly sectionControllerKeys = new Map<string, SectionControllerKey>();
	private readonly sectionControllerInitPromises = new Map<
		string,
		Promise<SectionControllerHandle>
	>();
	private readonly sectionPersistenceStrategies = new Map<
		string,
		SectionSessionPersistenceStrategy
	>();
	private readonly sectionControllerLifecycleListeners = new Set<
		(event: SectionControllerLifecycleEvent) => void
	>();
	private readonly sectionEventListenerIds = new WeakMap<
		(event: SectionControllerEvent) => void,
		number
	>();
	private readonly sectionEventSubscriptions = new Map<string, () => void>();
	private nextSectionEventListenerId = 1;

	/** Callback for floating tools changes */
	private floatingToolsChangeCallback: ((toolIds: string[]) => void) | null =
		null;

	private static resolveConfig(
		config: ToolkitCoordinatorConfig,
	): ToolkitCoordinatorConfig {
		const normalized = normalizeToolsConfig(config.tools as any);
		const defaultProviders: ToolkitToolsConfig["providers"] = {
			tts: {
				enabled: true,
				backend: "browser",
			},
			annotationToolbar: {
				enabled: true,
			},
		};

		return {
			...config,
			tools: {
				...normalized,
				providers: {
					...defaultProviders,
					...normalized.providers,
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

	private emitSectionControllerLifecycle(event: SectionControllerLifecycleEvent): void {
		for (const listener of this.sectionControllerLifecycleListeners) {
			try {
				listener(event);
			} catch (error) {
				console.warn(
					"[ToolkitCoordinator] section controller lifecycle listener failed:",
					error,
				);
			}
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

	private getSectionControllerMapKey(key: SectionControllerKey): string {
		return `${key.assessmentId}::${key.sectionId}::${key.attemptId || ""}`;
	}

	private createDefaultSectionPersistence(): SectionSessionPersistenceStrategy {
		const storage = (() => {
			try {
				if (typeof window === "undefined") return null;
				return window.localStorage;
			} catch {
				return null;
			}
		})();
		const getStorageKey = (context: SectionControllerContext): string => {
			const { assessmentId, sectionId, attemptId } = context.key;
			return `pie:section-controller:v1:${assessmentId}:${sectionId}:${attemptId || "default"}`;
		};
		return {
			async loadSession(context) {
				if (!storage) return null;
				const value = storage.getItem(getStorageKey(context));
				if (!value) return null;
				try {
					return JSON.parse(value);
				} catch {
					return null;
				}
			},
			async saveSession(context, session) {
				if (!storage) return;
				storage.setItem(getStorageKey(context), JSON.stringify(session));
			},
			async clearSession(context) {
				if (!storage) return;
				storage.removeItem(getStorageKey(context));
			},
		};
	}

	private async resolveSectionPersistence(
		context: SectionControllerContext,
	): Promise<SectionSessionPersistenceStrategy> {
		const cacheKey = this.getSectionControllerMapKey(context.key);
		const existing = this.sectionPersistenceStrategies.get(cacheKey);
		if (existing) return existing;

		const defaults: SectionPersistenceFactoryDefaults = {
			createDefaultPersistence: () => this.createDefaultSectionPersistence(),
		};
		const strategy =
			(await this.hooks.createSectionSessionPersistence?.(context, defaults)) ??
			(await defaults.createDefaultPersistence());
		this.sectionPersistenceStrategies.set(cacheKey, strategy);
		return strategy;
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
		const descriptorTools = this.getProviderDescriptorTools();
		for (const tool of descriptorTools) {
			void this.registerProviderFromTool(tool);
		}
	}

	private getProviderDescriptorTools(): ToolRegistration[] {
		return this.packagedToolRegistry
			.getAllTools()
			.filter((tool) => !!tool.provider);
	}

	private async registerProviderFromTool(tool: ToolRegistration): Promise<void> {
		const descriptor = tool.provider;
		if (!descriptor) return;
		const toolConfig = this.getToolConfig(tool.toolId) || undefined;
		if (toolConfig?.enabled === false) return;
		const providerId =
			descriptor.getProviderId?.(toolConfig) ??
			toolConfig?.provider?.id ??
			tool.toolId;
		if (this.toolProviderRegistry.has(providerId)) return;
		const provider = descriptor.createProvider(toolConfig);
		const initConfig =
			descriptor.getInitConfig?.(toolConfig) ?? toolConfig?.provider?.init ?? {};
		const authFetcher =
			descriptor.getAuthFetcher?.(toolConfig) ??
			toolConfig?.provider?.runtime?.authFetcher;
		await this.registerProvider(providerId, {
			provider,
			config: initConfig,
			lazy: descriptor.lazy ?? true,
			authFetcher,
		});
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

	public getSectionController(args: {
		sectionId: string;
		attemptId?: string;
	}): SectionControllerHandle | undefined {
		const key: SectionControllerKey = {
			assessmentId: this.assessmentId,
			sectionId: args.sectionId,
			attemptId: args.attemptId,
		};
		return this.sectionControllers.get(this.getSectionControllerMapKey(key));
	}

	public subscribeSectionEvents(args: SectionEventSubscriptionArgs): () => void {
		const controllerEntry = this.resolveSectionSubscriptionEntry(args);
		if (!controllerEntry) return () => {};
		const { mapKey, controller } = controllerEntry;
		const subscribe = controller.subscribe;
		if (!subscribe) {
			const resolvedKey = this.sectionControllerKeys.get(mapKey);
			const sectionLabel = resolvedKey?.sectionId || args.sectionId || "<unknown>";
			const attemptLabel = resolvedKey?.attemptId || args.attemptId || "<default>";
			throw new Error(
				`[ToolkitCoordinator] subscribeSectionEvents could not subscribe: resolved controller for section "${sectionLabel}" attempt "${attemptLabel}" does not expose subscribe().`,
			);
		}
		const listenerId = this.getOrCreateSectionEventListenerId(args.listener);
		const subscriptionKey = `${mapKey}::${listenerId}`;
		const previousSubscription = this.sectionEventSubscriptions.get(
			subscriptionKey,
		);
		previousSubscription?.();

		const shouldDeliverEvent = this.buildSectionEventPredicate(args);
		const unsubscribeController = subscribe.call(controller, (event) => {
			if (!shouldDeliverEvent(event)) return;
			args.listener(event);
		});

		const replayEvent = this.buildLoadingCompleteReplayEvent(controller);
		if (replayEvent && shouldDeliverEvent(replayEvent)) {
			args.listener(replayEvent);
		}

		const detach = this.createSectionEventDetachHandler(
			subscriptionKey,
			unsubscribeController,
		);

		this.sectionEventSubscriptions.set(subscriptionKey, detach);
		return detach;
	}

	private resolveSectionSubscriptionEntry(
		args: Pick<SectionEventSubscriptionArgs, "sectionId" | "attemptId">,
	): { mapKey: string; controller: SectionControllerHandle } | null {
		try {
			return this.resolveSectionControllerForSubscription({
				sectionId: args.sectionId,
				attemptId: args.attemptId,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const isAmbiguousSectionWithoutAttempt =
				args.sectionId !== undefined &&
				args.attemptId === undefined &&
				message.includes("subscribeSectionEvents is ambiguous for section");
			if (isAmbiguousSectionWithoutAttempt) {
				console.warn(message);
				return null;
			}
			throw error;
		}
	}

	private getOrCreateSectionEventListenerId(
		listener: (event: SectionControllerEvent) => void,
	): number {
		let listenerId = this.sectionEventListenerIds.get(listener);
		if (!listenerId) {
			listenerId = this.nextSectionEventListenerId++;
			this.sectionEventListenerIds.set(listener, listenerId);
		}
		return listenerId;
	}

	private buildSectionEventPredicate(
		args: Pick<SectionEventSubscriptionArgs, "eventTypes" | "itemIds">,
	): (event: SectionControllerEvent) => boolean {
		const eventTypeFilter = args.eventTypes ? new Set(args.eventTypes) : null;
		const itemIdFilter = args.itemIds ? new Set(args.itemIds) : null;
		return (event: SectionControllerEvent): boolean => {
			if (eventTypeFilter || itemIdFilter) {
				const eventType = event?.type || null;
				if (eventTypeFilter && (!eventType || !eventTypeFilter.has(eventType))) {
					return false;
				}
				if (itemIdFilter) {
					const hasMatchingItem = Array.from(
						this.collectEventItemIds(event),
					).some((itemId) => itemIdFilter.has(itemId));
					if (!hasMatchingItem) {
						return false;
					}
				}
			}
			return true;
		};
	}

	private collectEventItemIds(event: SectionControllerEvent): Set<string> {
		const itemIds = new Set<string>();
		if ("itemId" in event && typeof event.itemId === "string") {
			itemIds.add(event.itemId);
		}
		if ("canonicalItemId" in event && typeof event.canonicalItemId === "string") {
			itemIds.add(event.canonicalItemId);
		}
		if ("currentItemId" in event && typeof event.currentItemId === "string") {
			itemIds.add(event.currentItemId);
		}
		if ("previousItemId" in event && typeof event.previousItemId === "string") {
			itemIds.add(event.previousItemId);
		}
		return itemIds;
	}

	private buildLoadingCompleteReplayEvent(
		controller: SectionControllerHandle,
	): SectionControllerEvent | null {
		const runtimeState = controller.getRuntimeState?.();
		if (runtimeState?.loadingComplete !== true) return null;
		const totalRegistered =
			typeof runtimeState.totalRegistered === "number" &&
			Number.isFinite(runtimeState.totalRegistered)
				? Math.max(0, runtimeState.totalRegistered)
				: 0;
		const totalLoaded =
			typeof runtimeState.totalLoaded === "number" &&
			Number.isFinite(runtimeState.totalLoaded)
				? Math.max(0, runtimeState.totalLoaded)
				: totalRegistered;
		return {
			type: "section-loading-complete",
			totalRegistered,
			totalLoaded,
			currentItemIndex: runtimeState.currentItemIndex,
			timestamp: Date.now(),
		};
	}

	private createSectionEventDetachHandler(
		subscriptionKey: string,
		unsubscribeController: () => void,
	): () => void {
		const detach = () => {
			const current = this.sectionEventSubscriptions.get(subscriptionKey);
			if (current !== detach) {
				return;
			}
			this.sectionEventSubscriptions.delete(subscriptionKey);
			unsubscribeController();
		};
		return detach;
	}

	/**
	 * Subscribe to item-scoped controller events.
	 *
	 * Prefer this helper for answer/session/navigation events tied to item IDs.
	 * Use `subscribeSectionEvents` directly only when you need mixed item+section
	 * filtering behavior.
	 */
	public subscribeItemEvents(args: SectionItemEventSubscriptionArgs): () => void {
		return this.subscribeSectionEvents({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			eventTypes: args.eventTypes || SECTION_ITEM_EVENT_TYPES,
			itemIds: args.itemIds,
			listener: args.listener as (event: SectionControllerEvent) => void,
		});
	}

	/**
	 * Subscribe to section-scoped controller events.
	 *
	 * Prefer this helper for section lifecycle/loading/completion/error state.
	 * Section-scoped events do not carry item identifiers, so this helper
	 * intentionally does not expose `itemIds` filtering.
	 */
	public subscribeSectionLifecycleEvents(
		args: SectionScopedEventSubscriptionArgs,
	): () => void {
		return this.subscribeSectionEvents({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			eventTypes: args.eventTypes || SECTION_SCOPED_EVENT_TYPES,
			listener: args.listener as (event: SectionControllerEvent) => void,
		});
	}

	private resolveSectionControllerForSubscription(args: {
		sectionId?: string;
		attemptId?: string;
	}): { mapKey: string; controller: SectionControllerHandle } {
		if (args.sectionId) {
			const explicitKey: SectionControllerKey = {
				assessmentId: this.assessmentId,
				sectionId: args.sectionId,
				attemptId: args.attemptId,
			};
			const explicitMapKey = this.getSectionControllerMapKey(explicitKey);
			const explicitController = this.sectionControllers.get(explicitMapKey);
			if (explicitController) {
				return { mapKey: explicitMapKey, controller: explicitController };
			}

			if (args.attemptId !== undefined) {
				throw new Error(
					`[ToolkitCoordinator] subscribeSectionEvents could not resolve controller for section "${args.sectionId}" and attempt "${args.attemptId}".`,
				);
			}

			const sectionMatches: Array<{
				mapKey: string;
				controller: SectionControllerHandle;
			}> = [];
			for (const [mapKey, key] of this.sectionControllerKeys.entries()) {
				if (key.assessmentId !== this.assessmentId || key.sectionId !== args.sectionId) {
					continue;
				}
				const controller = this.sectionControllers.get(mapKey);
				if (!controller) continue;
				sectionMatches.push({ mapKey, controller });
			}
			if (sectionMatches.length === 1) {
				return sectionMatches[0];
			}
			if (sectionMatches.length === 0) {
				throw new Error(
					`[ToolkitCoordinator] subscribeSectionEvents found no active controller for section "${args.sectionId}".`,
				);
			}
			throw new Error(
				`[ToolkitCoordinator] subscribeSectionEvents is ambiguous for section "${args.sectionId}" without attemptId; ${sectionMatches.length} controllers are active.`,
			);
		}

		if (args.attemptId !== undefined) {
			throw new Error(
				`[ToolkitCoordinator] subscribeSectionEvents requires sectionId when attemptId is provided ("${args.attemptId}").`,
			);
		}

		const allMatches: Array<{ mapKey: string; controller: SectionControllerHandle }> = [];
		for (const [mapKey, key] of this.sectionControllerKeys.entries()) {
			if (key.assessmentId !== this.assessmentId) continue;
			const controller = this.sectionControllers.get(mapKey);
			if (!controller) continue;
			allMatches.push({ mapKey, controller });
		}
		if (allMatches.length === 1) {
			return allMatches[0];
		}
		if (allMatches.length === 0) {
			throw new Error(
				"[ToolkitCoordinator] subscribeSectionEvents found no active controllers; provide sectionId or initialize a section controller first.",
			);
		}
		throw new Error(
			`[ToolkitCoordinator] subscribeSectionEvents is ambiguous without sectionId; ${allMatches.length} active controllers are registered.`,
		);
	}

	public onSectionControllerLifecycle(
		listener: (event: SectionControllerLifecycleEvent) => void,
	): () => void {
		this.sectionControllerLifecycleListeners.add(listener);
		return () => {
			this.sectionControllerLifecycleListeners.delete(listener);
		};
	}

	public async getOrCreateSectionController(args: {
		sectionId: string;
		attemptId?: string;
		input?: unknown;
		updateExisting?: boolean;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle> {
		const key: SectionControllerKey = {
			assessmentId: this.assessmentId,
			sectionId: args.sectionId,
			attemptId: args.attemptId,
		};
		const mapKey = this.getSectionControllerMapKey(key);
		const existingController = await this.resolveExistingSectionController({
			mapKey,
			key,
			input: args.input,
			updateExisting: args.updateExisting,
		});
		if (existingController) return existingController;

		const existingPromise = this.sectionControllerInitPromises.get(mapKey);
		if (existingPromise) return existingPromise;

		const initPromise = this.initializeNewSectionController({
			args,
			key,
			mapKey,
		})
			.catch((err) => {
				this.handleSectionControllerInitError(err, args);
				throw err;
			})
			.finally(() => {
				this.sectionControllerInitPromises.delete(mapKey);
			});

		this.sectionControllerInitPromises.set(mapKey, initPromise);
		return initPromise;
	}

	private async resolveExistingSectionController(args: {
		mapKey: string;
		key: SectionControllerKey;
		input: unknown;
		updateExisting?: boolean;
	}): Promise<SectionControllerHandle | undefined> {
		const existingController = this.sectionControllers.get(args.mapKey);
		if (!existingController) return undefined;
		this.sectionControllerKeys.set(args.mapKey, args.key);
		if (args.updateExisting !== false) {
			// Existing controllers keep their in-memory session state across
			// input refresh; updateInput should rebuild composition/runtime view
			// without resetting responses.
			await existingController.updateInput?.(args.input);
		}
		return existingController;
	}

	private createSectionControllerContext(args: {
		key: SectionControllerKey;
		input: unknown;
	}): SectionControllerContext {
		return {
			key: args.key,
			coordinator: this,
			input: args.input,
		};
	}

	private async initializeNewSectionController(args: {
		args: {
			sectionId: string;
			attemptId?: string;
			input?: unknown;
			createDefaultController: () =>
				| SectionControllerHandle
				| Promise<SectionControllerHandle>;
		};
		key: SectionControllerKey;
		mapKey: string;
	}): Promise<SectionControllerHandle> {
		const context = this.createSectionControllerContext({
			key: args.key,
			input: args.args.input,
		});
		const persistence = await this.resolveSectionPersistence(context);
		const defaults: SectionControllerFactoryDefaults = {
			createDefaultController: args.args.createDefaultController,
		};
		const controller =
			(await this.hooks.createSectionController?.(context, defaults)) ??
			(await defaults.createDefaultController());
		await controller.configureSessionPersistence?.({
			strategy: persistence,
			context,
		});
		await controller.initialize?.(args.args.input);
		await controller.hydrate?.();
		await this.finalizeSectionControllerReady({
			mapKey: args.mapKey,
			key: args.key,
			context,
			controller,
		});
		return controller;
	}

	private async finalizeSectionControllerReady(args: {
		mapKey: string;
		key: SectionControllerKey;
		context: SectionControllerContext;
		controller: SectionControllerHandle;
	}): Promise<void> {
		this.sectionControllers.set(args.mapKey, args.controller);
		this.sectionControllerKeys.set(args.mapKey, args.key);
		this.emitSectionControllerLifecycle({
			type: "ready",
			key: args.key,
			controller: args.controller,
		});
		await this.hooks.onSectionControllerReady?.(args.context, args.controller);
		await this.emitTelemetry("section-controller-ready", {
			assessmentId: args.key.assessmentId,
			sectionId: args.key.sectionId,
			attemptId: args.key.attemptId,
		});
	}

	private handleSectionControllerInitError(
		err: unknown,
		args: { sectionId: string; attemptId?: string },
	): void {
		this.handleError(err, {
			phase: "section-controller-init",
			details: {
				sectionId: args.sectionId,
				attemptId: args.attemptId,
			},
		});
	}

	public async disposeSectionController(args: {
		sectionId: string;
		attemptId?: string;
		persistBeforeDispose?: boolean;
		clearPersistence?: boolean;
	}): Promise<void> {
		const key: SectionControllerKey = {
			assessmentId: this.assessmentId,
			sectionId: args.sectionId,
			attemptId: args.attemptId,
		};
		const mapKey = this.getSectionControllerMapKey(key);
		const controller = this.sectionControllers.get(mapKey);
		if (!controller) return;
		this.detachSectionEventSubscriptionsForMapKey(mapKey);

		const context = this.createSectionControllerContext({
			key,
			input: undefined,
		});

		try {
			await this.runSectionControllerDisposePipeline({
				key,
				context,
				controller,
				persistBeforeDispose: args.persistBeforeDispose,
			});
		} catch (err) {
			this.handleError(err, {
				phase: "section-controller-dispose",
				details: {
					sectionId: args.sectionId,
					attemptId: args.attemptId,
				},
			});
		} finally {
			await this.finalizeSectionControllerDispose({
				mapKey,
				key,
				context,
				clearPersistence: args.clearPersistence,
			});
		}
	}

	private detachSectionEventSubscriptionsForMapKey(mapKey: string): void {
		const subscriptionPrefix = `${mapKey}::`;
		for (const subscriptionKey of Array.from(
			this.sectionEventSubscriptions.keys(),
		)) {
			if (!subscriptionKey.startsWith(subscriptionPrefix)) continue;
			this.sectionEventSubscriptions.get(subscriptionKey)?.();
		}
	}

	private async runSectionControllerDisposePipeline(args: {
		key: SectionControllerKey;
		context: SectionControllerContext;
		controller: SectionControllerHandle;
		persistBeforeDispose?: boolean;
	}): Promise<void> {
		if (args.persistBeforeDispose !== false) {
			await args.controller.persist?.();
		}
		await args.controller.dispose?.();
		await this.hooks.onSectionControllerDispose?.(args.context, args.controller);
		await this.emitTelemetry("section-controller-disposed", {
			assessmentId: args.key.assessmentId,
			sectionId: args.key.sectionId,
			attemptId: args.key.attemptId,
		});
	}

	private async finalizeSectionControllerDispose(args: {
		mapKey: string;
		key: SectionControllerKey;
		context: SectionControllerContext;
		clearPersistence?: boolean;
	}): Promise<void> {
		this.sectionControllers.delete(args.mapKey);
		this.sectionControllerKeys.delete(args.mapKey);
		this.emitSectionControllerLifecycle({
			type: "disposed",
			key: args.key,
		});
		if (args.clearPersistence) {
			const strategy = this.sectionPersistenceStrategies.get(args.mapKey);
			await strategy?.clearSession?.(args.context);
		}
		this.sectionPersistenceStrategies.delete(args.mapKey);
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
		const resolvedToolConfig = this.resolveTTSToolConfig(config);
		const resolvedBackend = resolveTTSBackend(resolvedToolConfig);
		const runtimeTTSConfig = buildRuntimeTTSConfig(resolvedToolConfig);
		await this.hooks.onBeforeTTSInit?.({
			phase: "tts-init",
			details: {
				backend: resolvedBackend,
			},
		});
		await this.emitTelemetry("tts-init-start", {
			backend: resolvedBackend,
		});

		// Try to use TTS provider from registry if available
		if (this.toolProviderRegistry.has("tts")) {
			try {
				const ttsProvider = await this.ensureProviderReady("tts");
				const providerInstance = await ttsProvider.createInstance();
				await this.initializeTTSService(providerInstance, runtimeTTSConfig);
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
			await this.initializeTTSService(provider, runtimeTTSConfig);
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

	private resolveTTSToolConfig(config?: TTSToolConfig): TTSToolConfig {
		return (
			config ||
			((this.config.tools?.providers?.tts as TTSToolConfig | undefined) || {})
		);
	}

	private async initializeTTSService(
		provider: ITTSProvider,
		config: Partial<TTSConfig>,
	): Promise<void> {
		await this.ttsService.initialize(provider, config);
		this.ttsService.setCatalogResolver(this.catalogResolver);
		this.ttsInitialized = true;
		await this.hooks.onTTSReady?.();
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
			const ttsConfig = this.config.tools?.providers?.tts as
				| TTSToolConfig
				| undefined;
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
				(this.ttsInitialized ||
					(this.config.tools?.providers?.tts as TTSToolConfig | undefined)
						?.enabled === false),
			providers,
		};
	}

	private resolveProviderConfigKey(toolId: string): string {
		const providers =
			(this.config.tools as { providers?: Record<string, ToolProviderConfig | undefined> })
				?.providers || {};
		if (toolId in providers) return toolId;
		for (const [alias, canonical] of Object.entries(DEFAULT_TOOL_ALIAS_MAP)) {
			if (canonical === toolId && alias in providers) {
				return alias;
			}
		}
		return toolId;
	}

	/**
	 * Check if a tool is enabled.
	 * Tools are enabled by default unless explicitly disabled.
	 *
	 * @param toolId Tool identifier (e.g., 'tts', 'answerEliminator')
	 * @returns True if tool is enabled
	 */
	isToolEnabled(toolId: string): boolean {
		const configKey = this.resolveProviderConfigKey(toolId);
		const toolConfig = (this.config.tools as any)?.providers?.[configKey];
		// Enabled by default unless explicitly set to false
		return toolConfig?.enabled !== false;
	}

	/**
	 * Get tool configuration.
	 *
	 * @param toolId Tool identifier
	 * @returns Tool configuration or null if not configured
	 */
	getToolConfig(toolId: string): ToolProviderConfig | null {
		const configKey = this.resolveProviderConfigKey(toolId);
		return (
			((this.config.tools as { providers?: Record<string, ToolProviderConfig | undefined> })
				?.providers?.[configKey] as ToolProviderConfig | undefined) || null
		);
	}

	/**
	 * Update tool configuration.
	 * Applies changes to underlying services.
	 *
	 * @param toolId Tool identifier
	 * @param updates Partial configuration updates
	 */
	updateToolConfig(toolId: string, updates: Partial<ToolProviderConfig>): void {
		// Update config
		const configKey = this.resolveProviderConfigKey(toolId);
		const current = this.getToolConfig(toolId) || {};
		if (!this.config.tools) {
			this.config.tools = normalizeToolsConfig();
		}
		if (!(this.config.tools as any).providers) {
			(this.config.tools as any).providers = {};
		}
		(this.config.tools as any).providers[configKey] = { ...current, ...updates };

		// Apply configuration changes to services
		this._applyToolConfigChange(configKey, updates);
	}

	/**
	 * Update the enabled tools list for floating tools (calculator, graph, etc.).
	 * Used for PNP profile changes or dynamic tool configuration.
	 *
	 * @param toolIds Array of tool IDs to enable
	 */
	updateFloatingTools(toolIds: string[]): void {
		if (!this.config.tools) {
			this.config.tools = normalizeToolsConfig();
		}
		if (!this.config.tools.placement) {
			this.config.tools.placement = normalizeToolsConfig().placement;
		}
		this.config.tools.placement.section = [...toolIds];

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
		if (!this.config.tools) return [];
		return resolveToolsForLevel(this.config.tools as unknown as CanonicalToolsConfig, "section");
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
		_updates: Partial<ToolProviderConfig>,
	): void {
		// Apply configuration changes based on tool
		switch (toolId) {
			case "tts":
				void this._reconfigureTTSProvider().then(async () => {
					const ttsConfig = this.config.tools?.providers?.tts as
						| TTSToolConfig
						| undefined;
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
		const ttsRegistration = this
			.getProviderDescriptorTools()
			.find((tool) => tool.toolId === "textToSpeech");
		if (!ttsRegistration) return;
		await this.registerProviderFromTool(ttsRegistration);
	}
}
