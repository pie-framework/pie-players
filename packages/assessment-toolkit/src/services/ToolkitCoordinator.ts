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

import type {
	AccessibilityCatalog,
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";
import {
	type CanonicalToolsConfig,
	type ToolPlacementConfig,
	type ToolPolicyConfig,
	type ToolProviderConfig,
	type ToolProvidersConfig,
	normalizeToolsConfig,
} from "./tools-config-normalizer.js";
import {
	normalizeAndValidateToolsConfig,
	normalizeToolConfigStrictness,
	type ToolConfigStrictness,
} from "./tool-config-validation.js";
import { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import { ElementToolStateStore } from "./ElementToolStateStore.js";
import { warnDeprecatedOnce } from "./deprecation-warnings.js";
import {
	frameworkErrorFromCoordinatorContext,
	type FrameworkErrorModel,
} from "./framework-error.js";
import {
	FrameworkErrorBus,
	type FrameworkErrorListener,
} from "./framework-error-bus.js";
import { HighlightCoordinator } from "./HighlightCoordinator.js";
import { ToolCoordinator } from "./ToolCoordinator.js";
import { TTSService, type ITTSProvider, type TTSConfig } from "./TTSService.js";
import { BrowserTTSProvider } from "./tts/browser-provider.js";
import {
	buildRuntimeTTSConfig,
	resolveTTSBackend,
	type TTSLayoutMode,
} from "./tts-runtime-config.js";
import { ToolProviderRegistry } from "./tool-providers/index.js";
import type { ToolProviderApi } from "./tool-providers/ToolProviderApi.js";
import type {
	TTSToolProviderConfig,
} from "./tool-providers/index.js";
import { createPackagedToolRegistry } from "./createDefaultToolRegistry.js";
import type { ToolRegistration, ToolRegistry } from "./ToolRegistry.js";
import {
	ToolPolicyEngine,
	type PolicySource,
	type QtiEnforcementMode,
	type ResolvedEngineInputs,
	type ToolPolicyChangeListener,
	type ToolPolicyDecision,
	type ToolPolicyDecisionRequest,
} from "../policy/engine.js";
import { resolveDefaultQtiEnforcement } from "../policy/internal.js";
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
export type {
	QtiEnforcementMode,
	ResolvedEngineInputs,
	ToolPolicyChangeListener,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
} from "../policy/engine.js";

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
	/**
	 * Optional inline TTS speed buttons.
	 * - Omitted/non-array: default speed buttons are shown.
	 * - Empty array: hide speed buttons.
	 * - Arrays that sanitize to no valid values: default speed buttons are shown.
	 */
	speedOptions?: number[];
	layoutMode?: TTSLayoutMode;
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
	 * Validation strictness for tool config contracts.
	 * - off: keep diagnostics internal (no warnings or throws)
	 * - warn: log diagnostics and continue
	 * - error: throw on diagnostics
	 *
	 * @default "error"
	 */
	toolConfigStrictness?: ToolConfigStrictness;

	/**
	 * Optional registry used for tool-config validation and provider descriptor resolution.
	 * Defaults to packaged PIE tools when omitted.
	 */
	toolRegistry?: ToolRegistry | null;

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

	/**
	 * Internal bootstrap escape hatch used by framework-owned hosts.
	 * When true, constructor skips throwing validation and expects caller
	 * to pass a pre-validated tools config.
	 *
	 * @internal
	 */
	deferToolConfigValidation?: boolean;

	/**
	 * Optional pre-constructed framework-error bus.
	 *
	 * Pass a bus owned by the embedding host (typically
	 * `<pie-assessment-toolkit>`) when the host wants pre-coordinator
	 * failures (e.g. `coordinator-init` itself) to flow through the same
	 * fan-out as post-coordinator failures. When omitted, the coordinator
	 * constructs its own private bus, which is what standalone embeds get.
	 *
	 * @internal
	 */
	frameworkErrorBus?: FrameworkErrorBus;
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
	| "section-session-applied"
	| "section-loading-complete"
	| "section-items-complete-changed"
	| "section-error"
>;

export type SectionScopedEventType = Extract<
	SectionControllerEventType,
	| "section-navigation-change"
	| "section-session-applied"
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
	"section-session-applied",
	"section-loading-complete",
	"section-items-complete-changed",
	"section-error",
];

export interface ToolkitCoordinatorHooks {
	/**
	 * Canonical framework-error hook.
	 *
	 * Called once per framework-level failure (tool-config validation,
	 * provider register / init, TTS bring-up, state load / save, section
	 * controller init / dispose, coordinator init). The model carries the
	 * canonical {@link FrameworkErrorModel} shape — `kind`, `severity`,
	 * `source`, `message`, `details`, `recoverable`, and the original
	 * thrown value as `cause`.
	 *
	 * Listeners should return synchronously and avoid throwing; a thrown
	 * hook is caught and logged but does not stop fan-out to the other
	 * subscribers (DOM event, prop callback, deprecated alias hooks,
	 * `subscribeFrameworkErrors` listeners).
	 */
	onFrameworkError?: (model: FrameworkErrorModel) => void;

	/**
	 * @deprecated Use {@link onFrameworkError}. Kept for the M3
	 * deprecation window; will be removed in the next major release of
	 * `@pie-players/*`. The legacy `(Error, context)` shape is mapped to
	 * the canonical `FrameworkErrorModel` internally and dispatched in
	 * parallel with `onFrameworkError`.
	 */
	onError?: (error: Error, context: ToolkitErrorContext) => void;

	/**
	 * @deprecated Use {@link onFrameworkError}. Kept for the M3
	 * deprecation window. Filters to `tts-init` failures only; the
	 * canonical hook receives the same model with `kind: "tts-init"`.
	 */
	onTTSError?: (error: Error, context: ToolkitErrorContext) => void;

	/**
	 * @deprecated Use {@link onFrameworkError}. Kept for the M3
	 * deprecation window. Filters to `provider-register` and
	 * `provider-init` failures; the canonical hook receives the same
	 * model with `kind: "provider-register"` or `kind: "provider-init"`
	 * and `source: "pie-toolkit-coordinator/<providerId>"`.
	 */
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

export type ToolkitTelemetryListener = (args: {
	eventName: string;
	payload?: Record<string, unknown>;
}) => void;

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
 *     providers: {
 *       textToSpeech: { enabled: true, defaultVoice: 'en-US' },
 *       answerEliminator: { enabled: true, strategy: 'strikethrough' }
 *     },
 *     placement: {
 *       item: ['textToSpeech', 'answerEliminator']
 *     }
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
	private ttsReconfigurePromise?: Promise<void>;
	private stateLoaded = false;
	private stateLoadPromise?: Promise<void>;
	private coordinatorReadyPromise?: Promise<void>;
	private coordinatorReadyNotified = false;
	private readonly providerInitPromises = new Map<string, Promise<ToolProviderApi>>();
	private readonly toolRegistry: ToolRegistry;
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
	private readonly telemetryListeners = new Set<ToolkitTelemetryListener>();
	private readonly frameworkErrorBus: FrameworkErrorBus;
	private readonly ownsFrameworkErrorBus: boolean;
	private nextSectionEventListenerId = 1;

	/**
	 * Unified Tool Policy Engine. Owned by the coordinator and lives
	 * for the lifetime of the coordinator instance — there is no
	 * explicit teardown path today; the engine and its listener set
	 * are reclaimed by GC when the coordinator becomes unreachable.
	 * Subscribers attached via {@link onPolicyChange} must therefore
	 * detach via the unsubscribe function the engine returns; do not
	 * rely on a `disposed` event being emitted on coordinator teardown.
	 *
	 * Hosts read decisions via {@link decideToolPolicy} or subscribe
	 * to changes via {@link onPolicyChange}. The legacy
	 * `resolveToolsForLevel` / `PnpToolResolver` paths still coexist
	 * until the upcoming compat-removal sweep deletes them.
	 */
	private readonly policyEngine: ToolPolicyEngine;

	/**
	 * Host-set override for QTI enforcement. `null` (the default) means
	 * "auto" — the coordinator infers the effective mode from the
	 * QTI inputs the bound `AssessmentEntity` and `AssessmentItemRef`
	 * actually carry (see {@link resolveEffectiveQtiEnforcement}).
	 * `"on"` / `"off"` are explicit host opt-in / opt-out and stick
	 * across subsequent assessment / item swaps until the host clears
	 * the override by calling `setQtiEnforcement(null)`.
	 */
	private qtiEnforcementOverride: QtiEnforcementMode | null = null;

	/**
	 * Last assessment passed to {@link updateAssessment}. Read by
	 * {@link resolveEffectiveQtiEnforcement} to compute auto-mode.
	 * The engine's own copy is the canonical record for decisions;
	 * this mirror exists only so the auto-mode helper does not need
	 * to round-trip through {@link policyEngine}'s frozen snapshot.
	 */
	private boundAssessment: AssessmentEntity | null = null;

	/**
	 * Last item reference passed to {@link updateCurrentItemRef}.
	 * Mirrored alongside {@link boundAssessment} so
	 * {@link resolveEffectiveQtiEnforcement} can detect item-level
	 * QTI inputs (`requiredTools` / `restrictedTools` /
	 * `toolParameters`) without round-tripping through the engine's
	 * frozen snapshot.
	 */
	private boundCurrentItemRef: AssessmentItemRef | null = null;

	/** Callback for floating tools changes */
	private floatingToolsChangeCallback: ((toolIds: string[]) => void) | null =
		null;

	private static resolveConfig(
		config: ToolkitCoordinatorConfig,
	): ToolkitCoordinatorConfig {
		const strictness = normalizeToolConfigStrictness(
			config.toolConfigStrictness,
		);
		const toolRegistry = config.toolRegistry ?? createPackagedToolRegistry();
		const normalized =
			config.deferToolConfigValidation === true
				? normalizeToolsConfig(config.tools as any)
				: normalizeAndValidateToolsConfig(config.tools as any, {
						strictness,
						source: "ToolkitCoordinator.init",
						toolRegistry,
					}).config;
		const defaultProviders: ToolkitToolsConfig["providers"] = {
			textToSpeech: {
				enabled: true,
				backend: "browser",
			},
			annotationToolbar: {
				enabled: true,
			},
		};

		return {
			...config,
			toolConfigStrictness: strictness,
			toolRegistry,
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
		this.toolRegistry = resolvedConfig.toolRegistry ?? createPackagedToolRegistry();
		this.hooks = resolvedConfig.hooks ?? {};
		this.lazyInit = config.lazyInit === true;

		// Use the host-provided framework-error bus if one was passed
		// (typical when embedded inside <pie-assessment-toolkit>, so
		// pre-coordinator failures from the CE flow through the same
		// fan-out as coordinator failures). Otherwise own a private one.
		this.frameworkErrorBus = config.frameworkErrorBus ?? new FrameworkErrorBus();
		this.ownsFrameworkErrorBus = !config.frameworkErrorBus;
		this.subscribeFrameworkErrorHookAdapters();

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

		// M8 PR 2 — construct the unified ToolPolicyEngine seeded with
		// the validated tools config. QTI inputs (`assessment`,
		// `currentItemRef`) start `null`; `qtiEnforcement` is resolved
		// through {@link resolveEffectiveQtiEnforcement}, which flips
		// to `"on"` only once the bound assessment or item carries
		// actual QTI material (PR 4). Hosts that only consume the
		// engine for placement/policy gating get the pre-PR-2 behavior
		// bit-for-bit.
		this.policyEngine = new ToolPolicyEngine({
			toolRegistry: this.toolRegistry,
			contextId: `toolkit-coordinator:${this.assessmentId}`,
			inputs: {
				tools: this.config.tools as CanonicalToolsConfig,
				assessment: null,
				currentItemRef: null,
				qtiEnforcement: this.resolveEffectiveQtiEnforcement(),
			},
		});

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

	/**
	 * Subscribe the canonical-hook adapter and the deprecated alias-hook
	 * adapters to the framework-error bus.
	 *
	 * Called once from the constructor. Each adapter inspects the model
	 * and the live `this.hooks` reference, so hooks added later via
	 * {@link setHooks} are picked up automatically without re-subscribing.
	 */
	private subscribeFrameworkErrorHookAdapters(): void {
		this.frameworkErrorBus.subscribeFrameworkErrors((model) => {
			const hook = this.hooks.onFrameworkError;
			if (!hook) return;
			try {
				hook(model);
			} catch (hookError) {
				console.warn(
					"[ToolkitCoordinator] onFrameworkError hook failed:",
					hookError,
				);
			}
		});

		this.frameworkErrorBus.subscribeFrameworkErrors((model) => {
			if (!this.hooks.onError) return;
			warnDeprecatedOnce(
				"toolkit-coordinator-hook:onError",
				"ToolkitCoordinatorHooks.onError is deprecated; use onFrameworkError(model) instead.",
			);
			try {
				const error = this.toCauseError(model);
				this.hooks.onError(error, this.legacyContextFromModel(model));
			} catch (hookError) {
				console.warn(
					"[ToolkitCoordinator] onError hook failed:",
					hookError,
				);
			}
		});

		this.frameworkErrorBus.subscribeFrameworkErrors((model) => {
			if (model.kind !== "tts-init") return;
			if (!this.hooks.onTTSError) return;
			warnDeprecatedOnce(
				"toolkit-coordinator-hook:onTTSError",
				"ToolkitCoordinatorHooks.onTTSError is deprecated; use onFrameworkError(model) and filter on model.kind === 'tts-init'.",
			);
			try {
				const error = this.toCauseError(model);
				this.hooks.onTTSError(error, { phase: "tts-init" });
			} catch (hookError) {
				console.warn(
					"[ToolkitCoordinator] onTTSError hook failed:",
					hookError,
				);
			}
		});

		this.frameworkErrorBus.subscribeFrameworkErrors((model) => {
			if (model.kind !== "provider-register" && model.kind !== "provider-init") {
				return;
			}
			if (!this.hooks.onProviderError) return;
			const providerId = ToolkitCoordinator.providerIdFromSource(model.source);
			if (!providerId) return;
			warnDeprecatedOnce(
				"toolkit-coordinator-hook:onProviderError",
				"ToolkitCoordinatorHooks.onProviderError is deprecated; use onFrameworkError(model) and filter on model.kind === 'provider-init'/'provider-register'.",
			);
			try {
				const error = this.toCauseError(model);
				this.hooks.onProviderError(providerId, error, {
					phase: model.kind,
					providerId,
				});
			} catch (hookError) {
				console.warn(
					"[ToolkitCoordinator] onProviderError hook failed:",
					hookError,
				);
			}
		});
	}

	private toCauseError(model: FrameworkErrorModel): Error {
		if (model.cause instanceof Error) return model.cause;
		return new Error(model.message);
	}

	private legacyContextFromModel(model: FrameworkErrorModel): ToolkitErrorContext {
		const providerId = ToolkitCoordinator.providerIdFromSource(model.source);
		switch (model.kind) {
			case "tts-init":
				return { phase: "tts-init" };
			case "tool-state-load":
				return { phase: "state-load" };
			case "tool-state-save":
				return { phase: "state-save" };
			case "section-controller-init":
				return { phase: "section-controller-init" };
			case "section-controller-dispose":
				return { phase: "section-controller-dispose" };
			case "provider-init":
				return providerId
					? { phase: "provider-init", providerId }
					: { phase: "provider-init" };
			case "provider-register":
				return providerId
					? { phase: "provider-register", providerId }
					: { phase: "provider-register" };
			case "coordinator-init":
				return { phase: "coordinator-ready" };
			default:
				// `tool-config`, `runtime-init`, `runtime-dispose`, and
				// `unknown` do not have a 1:1 legacy phase. Map to
				// `coordinator-ready` so the deprecated `onError` hook
				// keeps receiving them, with a coarse phase tag, until
				// callers migrate to `onFrameworkError`.
				return { phase: "coordinator-ready" };
		}
	}

	private static providerIdFromSource(source: string): string | undefined {
		const prefix = "pie-toolkit-coordinator/";
		if (!source.startsWith(prefix)) return undefined;
		const candidate = source.slice(prefix.length);
		return candidate.length > 0 ? candidate : undefined;
	}

	/**
	 * Emit a telemetry event to `onTelemetry` hook + all `subscribeTelemetry`
	 * listeners.
	 *
	 * **Naming convention.** Event names MUST be prefixed at the call site,
	 * not auto-decorated here. The convention is:
	 *
	 * - `pie-toolkit-*` for toolkit lifecycle (state load, providers,
	 *   coordinator readiness, section-controller register/dispose, TTS
	 *   bring-up, tool-config updates, etc.).
	 * - `pie-tool-*` for individual tool events (provider init lifecycle,
	 *   provider backend calls, tool-specific telemetry forwarded from
	 *   `__pieTelemetry`).
	 * - `pie-section-*` is reserved for section-player layout events
	 *   surfaced via `attachInstrumentationEventBridge` and is not emitted
	 *   from this method directly.
	 *
	 * Anything that does not fit a documented prefix is a deliberate decision
	 * to be raised in code review, not a fallback. There is no "auto prefix"
	 * here on purpose: it keeps every emit-site honest about which namespace
	 * it owns, and lets `subscribeTelemetry` consumers compare against
	 * documented strings without per-consumer normalization.
	 */
	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.hooks.onTelemetry?.(eventName, payload);
		} catch (err) {
			console.warn("[ToolkitCoordinator] telemetry hook failed:", err);
		}
		const nextPayload = payload ? { ...payload } : undefined;
		for (const listener of this.telemetryListeners) {
			try {
				listener({
					eventName,
					payload: nextPayload ? { ...nextPayload } : undefined,
				});
			} catch (err) {
				console.warn("[ToolkitCoordinator] telemetry listener failed:", err);
			}
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
		const model = frameworkErrorFromCoordinatorContext({
			error,
			context,
		});
		this.frameworkErrorBus.reportFrameworkError(model);
	}

	/**
	 * Subscribe to framework-error events emitted by this coordinator.
	 *
	 * See `ToolkitCoordinatorApi.subscribeFrameworkErrors` for the
	 * contract. The bus is shared with the canonical / deprecated
	 * lifecycle hooks (`onFrameworkError`, `onError`, `onTTSError`,
	 * `onProviderError`), so a listener registered here sees the same
	 * fan-out the hooks see.
	 */
	public subscribeFrameworkErrors(listener: FrameworkErrorListener): () => void {
		return this.frameworkErrorBus.subscribeFrameworkErrors(listener);
	}

	/**
	 * Report a framework-error model directly into this coordinator's bus.
	 *
	 * Used by embedding hosts (e.g. `<pie-assessment-toolkit>`) that
	 * pre-construct their own framework-error model in a path that does
	 * not go through `handleError` — for example, `runtime-init` failures
	 * raised before any coordinator phase, or `tool-config` failures
	 * synthesized from validation diagnostics.
	 *
	 * Hosts that already share their bus via the constructor's
	 * `frameworkErrorBus` config field do not need to call this; their
	 * own `bus.reportFrameworkError(model)` is observed here.
	 *
	 * @internal
	 */
	public reportFrameworkError(model: FrameworkErrorModel): void {
		this.frameworkErrorBus.reportFrameworkError(model);
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
				await this.emitTelemetry("pie-toolkit-tool-state-loaded", {
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
		return this.toolRegistry
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
		const initConfigWithTelemetry = this.addToolTelemetryReporter({
			toolId: tool.toolId,
			providerId,
			initConfig,
		});
		const registryTelemetry = this.createToolTelemetryForwarder({
			toolId: tool.toolId,
			providerId,
		});
		const authFetcher =
			descriptor.getAuthFetcher?.(toolConfig) ??
			toolConfig?.provider?.runtime?.authFetcher;
		await this.registerProvider(providerId, {
			provider,
			config: initConfigWithTelemetry,
			lazy: descriptor.lazy ?? true,
			authFetcher,
			onTelemetry: registryTelemetry,
		});
	}

	private createToolTelemetryForwarder(args: {
		toolId: string;
		providerId: string;
	}): (eventName: string, payload?: Record<string, unknown>) => Promise<void> {
		return async (eventName: string, payload?: Record<string, unknown>) => {
			await this.emitTelemetry(eventName, {
				...(payload || {}),
				toolId: args.toolId,
				providerId: args.providerId,
			});
		};
	}

	private addToolTelemetryReporter(args: {
		toolId: string;
		providerId: string;
		initConfig: unknown;
	}): Record<string, unknown> {
		const configObject =
			args.initConfig && typeof args.initConfig === "object"
				? { ...(args.initConfig as Record<string, unknown>) }
				: {};
		const existingReporter =
			typeof configObject.onTelemetry === "function"
				? (configObject.onTelemetry as (
						eventName: string,
						payload?: Record<string, unknown>,
				  ) => void | Promise<void>)
				: null;
		const forwardTelemetry = this.createToolTelemetryForwarder({
			toolId: args.toolId,
			providerId: args.providerId,
		});
		configObject.onTelemetry = async (eventName: string, payload?: Record<string, unknown>) => {
			if (existingReporter) {
				await existingReporter(eventName, payload);
			}
			await forwardTelemetry(eventName, payload);
		};
		return configObject;
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
			await this.emitTelemetry("pie-toolkit-provider-registered", {
				providerId,
				providerName: config.provider.providerName,
			});
		} catch (err) {
			console.warn(
				`[ToolkitCoordinator] Failed to register provider "${providerId}":`,
				err,
			);
			// `handleError` publishes through the framework-error bus, which
			// fans out to `onFrameworkError` and the deprecated alias hook
			// `onProviderError`. No direct alias-hook call here — that would
			// double-fire under the new bus model.
			this.handleError(err, { phase: "provider-register", providerId });
		}
	}

	public async ensureProviderReady(providerId: string): Promise<ToolProviderApi> {
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
				await this.emitTelemetry("pie-toolkit-provider-ready", { providerId });
				return provider;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				// `handleError` publishes through the framework-error bus,
				// which fans out to `onFrameworkError` and the deprecated
				// alias hook `onProviderError`. No direct alias-hook call
				// here — that would double-fire under the new bus model.
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

	public subscribeTelemetry(listener: ToolkitTelemetryListener): () => void {
		this.telemetryListeners.add(listener);
		return () => {
			this.telemetryListeners.delete(listener);
		};
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
		await this.emitTelemetry("pie-toolkit-section-controller-ready", {
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
		await this.emitTelemetry("pie-toolkit-section-controller-disposed", {
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
		await this.waitForPendingTTSReconfigure();
		if (this.ttsInitialized) return;
		if (this.ttsInitPromise) return this.ttsInitPromise;
		this.ttsInitPromise = this._initializeTTS(config).finally(() => {
			this.ttsInitPromise = undefined;
		});
		return this.ttsInitPromise;
	}

	private async waitForPendingTTSReconfigure(): Promise<void> {
		let pending = this.ttsReconfigurePromise;
		while (pending) {
			await pending;
			pending = this.ttsReconfigurePromise;
		}
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
		await this.emitTelemetry("pie-toolkit-tts-init-start", {
			backend: resolvedBackend,
		});
		await this.emitTelemetry("pie-tool-init-start", {
			toolId: "tts",
			operation: "tts-init",
			backend: resolvedBackend,
		});

		// Try to use TTS provider from registry if available
		if (this.toolProviderRegistry.has("tts")) {
			try {
				const ttsProvider = await this.ensureProviderReady("tts");
				const providerInstance = await ttsProvider.createInstance();
				await this.initializeTTSService(providerInstance, runtimeTTSConfig);
				await this.emitTelemetry("pie-toolkit-tts-init-success", {
					provider: "registry",
				});
				await this.emitTelemetry("pie-tool-init-success", {
					toolId: "tts",
					operation: "tts-init",
					backend: resolvedBackend,
					provider: "registry",
				});
				console.log(
					"[ToolkitCoordinator] TTS initialized via ToolProviderRegistry",
				);
				return;
			} catch (error) {
				const normalized =
					error instanceof Error ? error : new Error(String(error));
				await this.emitTelemetry("pie-tool-init-error", {
					toolId: "textToSpeech",
					providerId: "tts",
					operation: "tts-init",
					backend: resolvedBackend,
					errorType: "TTSRegistryInitError",
					message: normalized.message,
					recovered: true,
				});
				await this.emitTelemetry("pie-tool-init-fallback", {
					toolId: "textToSpeech",
					providerId: "tts",
					operation: "tts-init",
					backend: resolvedBackend,
					fromProvider: "registry",
					toProvider: "browser",
					reason: normalized.message,
				});
				console.warn(
					"[ToolkitCoordinator] Failed to initialize TTS via registry, falling back to browser provider:",
					normalized,
				);
			}
		}

		// Fallback to browser provider
		const provider = new BrowserTTSProvider();
		try {
			await this.initializeTTSService(provider, runtimeTTSConfig);
			await this.emitTelemetry("pie-toolkit-tts-init-success", {
				provider: "browser-fallback",
			});
			await this.emitTelemetry("pie-tool-init-success", {
				toolId: "tts",
				operation: "tts-init",
				backend: resolvedBackend,
				provider: "browser-fallback",
			});
		} catch (error) {
			const normalized =
				error instanceof Error ? error : new Error(String(error));
			// `handleError` publishes through the framework-error bus, which
			// fans out to `onFrameworkError` and the deprecated alias hook
			// `onTTSError`. No direct alias-hook call here — that would
			// double-fire under the new bus model.
			this.handleError(normalized, { phase: "tts-init" });
			await this.emitTelemetry("pie-toolkit-tts-init-error", {
				message: normalized.message,
			});
			await this.emitTelemetry("pie-tool-init-error", {
				toolId: "tts",
				operation: "tts-init",
				backend: resolvedBackend,
				errorType: "TTSInitError",
				message: normalized.message,
			});
			throw normalized;
		}
	}

	private resolveTTSToolConfig(config?: TTSToolConfig): TTSToolConfig {
		return config || this.getTTSConfigFromProviders() || {};
	}

	private async initializeTTSService(
		provider: ITTSProvider,
		config: Partial<TTSConfig>,
	): Promise<void> {
		const nextProviderOptions = {
			...(((config.providerOptions || {}) as Record<string, unknown>) || {}),
			__pieTelemetry: async (
				eventName: string,
				payload?: Record<string, unknown>,
			) => {
				await this.emitTelemetry(eventName, {
					toolId: "tts",
					...(payload || {}),
				});
			},
		};
		const nextConfig = {
			...config,
			providerOptions: nextProviderOptions,
		} as Partial<TTSConfig>;
		await this.ttsService.initialize(provider, nextConfig);
		await this.ensureBrowserVoicesReady(provider);
		this.ttsService.setCatalogResolver(this.catalogResolver);
		this.ttsInitialized = true;
		await this.hooks.onTTSReady?.();
	}

	private async ensureBrowserVoicesReady(
		provider: ITTSProvider,
		timeoutMs = 1200,
	): Promise<void> {
		if (provider.providerId !== "browser") return;
		if (typeof window === "undefined") return;
		if (!("speechSynthesis" in window)) return;
		const synth = window.speechSynthesis;
		const voices = synth.getVoices();
		if (voices.length > 0) return;
		await new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				resolve();
			};
			const timeoutId = window.setTimeout(() => {
				synth.removeEventListener("voiceschanged", onVoicesChanged);
				finish();
			}, timeoutMs);
			const onVoicesChanged = () => {
				window.clearTimeout(timeoutId);
				if (
					typeof synth.removeEventListener === "function" &&
					typeof synth.addEventListener === "function"
				) {
					synth.removeEventListener("voiceschanged", onVoicesChanged);
				}
				finish();
			};
			if (
				typeof synth.addEventListener === "function" &&
				typeof synth.removeEventListener === "function"
			) {
				synth.addEventListener("voiceschanged", onVoicesChanged, { once: true });
			}
		});
		const voicesAfterWait = synth.getVoices();
		await this.emitTelemetry("pie-toolkit-tts-browser-voices-ready", {
			voiceCount: voicesAfterWait.length,
			timedOut: voicesAfterWait.length === 0,
		});
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
			const ttsConfig = this.getTTSConfigFromProviders();
			if (ttsConfig?.enabled !== false) {
				await this.ensureTTSReady(ttsConfig);
			}
			if (!this.coordinatorReadyNotified) {
				this.coordinatorReadyNotified = true;
				await this.hooks.onCoordinatorReady?.(this);
				await this.emitTelemetry("pie-toolkit-coordinator-ready", {
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
		const ttsConfig = this.getTTSConfigFromProviders();
		return {
			tts: this.ttsInitialized,
			stateLoaded: this.stateLoaded || !this.hooks.loadToolState,
			coordinator:
				(this.stateLoaded || !this.hooks.loadToolState) &&
				(this.ttsInitialized || ttsConfig?.enabled === false),
			providers,
		};
	}

	private getTTSConfigFromProviders(): TTSToolConfig | undefined {
		const providers =
			(this.config.tools as { providers?: Record<string, ToolProviderConfig | undefined> })
				?.providers || {};
		return providers.textToSpeech as TTSToolConfig | undefined;
	}

	private assertCanonicalToolId(toolId: string): void {
		if (typeof toolId !== "string" || toolId.trim().length === 0) {
			throw new Error("Tool id must be a non-empty string.");
		}
		if (toolId === "tts") {
			throw new Error(
				`Tool id "tts" is no longer supported. Use "textToSpeech".`,
			);
		}
		if (!this.toolRegistry.get(toolId)) {
			throw new Error(`Unknown tool id "${toolId}".`);
		}
	}

	/**
	 * Check if a tool is enabled.
	 * Tools are enabled by default unless explicitly disabled.
	 *
	 * @param toolId Tool identifier (e.g., 'textToSpeech', 'answerEliminator')
	 * @returns True if tool is enabled
	 */
	isToolEnabled(toolId: string): boolean {
		this.assertCanonicalToolId(toolId);
		const toolConfig = (this.config.tools as any)?.providers?.[toolId];
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
		this.assertCanonicalToolId(toolId);
		return (
			((this.config.tools as { providers?: Record<string, ToolProviderConfig | undefined> })
				?.providers?.[toolId] as ToolProviderConfig | undefined) || null
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
		this.assertCanonicalToolId(toolId);
		const current = this.getToolConfig(toolId) || {};
		if (!this.config.tools) {
			this.config.tools = normalizeAndValidateToolsConfig(undefined, {
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateToolConfig",
				toolRegistry: this.toolRegistry,
			}).config;
		}
		if (!(this.config.tools as any).providers) {
			(this.config.tools as any).providers = {};
		}
		const nextProviders = {
			...((this.config.tools as any).providers || {}),
			[toolId]: { ...current, ...updates },
		};
		const validated = normalizeAndValidateToolsConfig(
			{
				...(this.config.tools as CanonicalToolsConfig),
				providers: nextProviders,
			},
			{
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateToolConfig",
				toolRegistry: this.toolRegistry,
			},
		);
		this.config.tools = validated.config;
		// M8 PR 2 — keep the policy engine's tools input in lockstep
		// with the validated coordinator config. The engine emits an
		// `inputs` change event so subscribers (e.g. PR 3 toolbars) can
		// re-decide without us managing a parallel pub/sub.
		this.policyEngine.updateInputs({
			tools: this.config.tools as CanonicalToolsConfig,
		});
		void this.emitTelemetry("pie-toolkit-tool-config-updated", { toolId });

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
			this.config.tools = normalizeAndValidateToolsConfig(undefined, {
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateFloatingTools",
				toolRegistry: this.toolRegistry,
			}).config;
		}
		const validated = normalizeAndValidateToolsConfig(
			{
				...(this.config.tools as CanonicalToolsConfig),
				placement: {
					section: [...toolIds],
					item: [...(this.config.tools?.placement?.item || [])],
					passage: [...(this.config.tools?.placement?.passage || [])],
				},
			},
			{
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateFloatingTools",
				toolRegistry: this.toolRegistry,
			},
		);
		this.config.tools = validated.config;
		// M8 PR 2 — keep the policy engine in lockstep with the
		// floating-tools placement update. See `updateToolConfig` for
		// the same pattern.
		this.policyEngine.updateInputs({
			tools: this.config.tools as CanonicalToolsConfig,
		});

		// Notify listener of change
		if (this.floatingToolsChangeCallback) {
			this.floatingToolsChangeCallback(toolIds);
		}
	}

	/**
	 * Get currently enabled floating tools (section-level placement).
	 *
	 * @returns Array of enabled tool IDs.
	 *
	 * @remarks
	 * As of M8 PR 2 this routes through the {@link ToolPolicyEngine}
	 * rather than the legacy `resolveToolsForLevel(...)` shim. The two
	 * paths agree on `placement → policy.allowed → policy.blocked`,
	 * but the engine additionally enforces:
	 *
	 *   - **Provider veto** — `tools.providers[id].enabled === false`
	 *     removes the tool from the visible set. The legacy resolver
	 *     ignored this flag for floating tools.
	 *   - **QTI gates** — when `qtiEnforcement` is `"on"` (set by host
	 *     via {@link setQtiEnforcement}, or auto-promoted when the
	 *     bound `AssessmentEntity` / current `AssessmentItemRef`
	 *     carries QTI 6-level precedence material — see
	 *     {@link resolveEffectiveQtiEnforcement}) **and an assessment
	 *     is bound**, the QTI 6-level precedence (district block →
	 *     test-admin override → item restriction/requirement →
	 *     district requirement → PNP supports / prohibitions) is
	 *     applied. `qtiEnforcement: "on"` without a bound assessment
	 *     is a no-op for QTI gating.
	 *   - **Custom `PolicySource`s** registered via
	 *     {@link registerPolicySource}.
	 *
	 * Under the default no-assessment, no-override, no-provider-veto
	 * configuration the result still matches `resolveToolsForLevel(...)`
	 * exactly — a parity asserted by the integration tests in
	 * `tests/policy/coordinator-integration.test.ts`. Once PR 5 deletes
	 * the legacy resolver this method becomes the canonical surface.
	 *
	 * Consumers that need the full decision (provenance, diagnostics)
	 * should call {@link decideToolPolicy} instead.
	 */
	getFloatingTools(): string[] {
		if (!this.config.tools) return [];
		return this.policyEngine.getVisibleToolIds("section", "*");
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

	// ----------------------------------------------------------------
	// M8 PR 2 — Tool Policy Engine surface
	//
	// The methods below are additive in PR 2: hosts can already drive
	// the unified ToolPolicyEngine, but the existing toolbar / section-
	// player render paths still consume the legacy `resolveToolsForLevel`
	// / `PnpToolResolver` chain. PR 3 switches consumers; PR 5 deletes
	// the legacy path. See `.cursor/plans/m8-implementation-plan.md`.
	// ----------------------------------------------------------------

	/**
	 * Resolve the visible tool set for a given placement level + scope.
	 *
	 * Thin shim over the owned tool-policy engine. Hosts that need
	 * richer outputs (provenance, diagnostics) read this directly;
	 * hosts that only need the section-level tool IDs can call
	 * {@link getFloatingTools} instead.
	 */
	decideToolPolicy(request: ToolPolicyDecisionRequest): ToolPolicyDecision {
		return this.policyEngine.decide(request);
	}

	/**
	 * Subscribe to policy-engine change events. Fires whenever the
	 * coordinator's bound inputs change (`updateToolConfig`,
	 * `updateFloatingTools`, `updateAssessment`, `updateCurrentItemRef`,
	 * `setQtiEnforcement`) or a custom `PolicySource` is registered /
	 * removed via {@link registerPolicySource}.
	 *
	 * The listener receives a `ToolPolicyChangeEvent` with the event
	 * `reason` and a frozen snapshot of the engine inputs. Listeners
	 * that want the new visible tool set should call
	 * {@link decideToolPolicy} with their level / scope.
	 *
	 * Note: the engine itself can also emit `reason: "disposed"`, but
	 * the coordinator does not dispose its engine on teardown today,
	 * so subscribers attached via this method will not observe that
	 * reason. Detach via the returned unsubscribe function instead of
	 * relying on a `disposed` event.
	 */
	onPolicyChange(listener: ToolPolicyChangeListener): () => void {
		return this.policyEngine.onPolicyChange(listener);
	}

	/**
	 * Bind (or clear) the active QTI assessment for policy decisions.
	 *
	 * Under auto-mode (no host override via {@link setQtiEnforcement}),
	 * the coordinator promotes the engine to `qtiEnforcement: "on"`
	 * iff the assessment carries any QTI 6-level precedence material
	 * (`personalNeedsProfile`, `settings.districtPolicy`,
	 * `settings.testAdministration`) or the currently-bound item ref
	 * carries item-level QTI inputs. A bare assessment record (just
	 * `id` / `name`, no PNP, no settings) keeps `"off"`.
	 *
	 * The host override set via {@link setQtiEnforcement} is sticky
	 * across assessment swaps; calling with `null` clears the binding
	 * and re-runs the auto-mode helper.
	 */
	updateAssessment(assessment: AssessmentEntity | null): void {
		this.boundAssessment = assessment;
		this.policyEngine.updateInputs({
			assessment,
			qtiEnforcement: this.resolveEffectiveQtiEnforcement(),
		});
	}

	/**
	 * Bind (or clear) the current item reference for policy decisions.
	 *
	 * Used by item-level QTI gates (item `requiredTools` /
	 * `restrictedTools` / `toolParameters`). Item-level QTI material
	 * also feeds {@link resolveEffectiveQtiEnforcement} — navigating
	 * to an item with QTI settings can flip auto-mode to `"on"` even
	 * when the parent assessment carries no QTI block of its own.
	 */
	updateCurrentItemRef(itemRef: AssessmentItemRef | null): void {
		this.boundCurrentItemRef = itemRef;
		this.policyEngine.updateInputs({
			currentItemRef: itemRef,
			qtiEnforcement: this.resolveEffectiveQtiEnforcement(),
		});
	}

	/**
	 * Override the auto-mode QTI enforcement decision.
	 *
	 * Pass `"on"` to force QTI enforcement even when no QTI inputs
	 * are bound (useful for tests / fixtures). Pass `"off"` to opt
	 * out even when QTI inputs are present. Pass `null` to clear the
	 * override and return to auto-mode — `"on"` iff
	 * {@link resolveDefaultQtiEnforcement} reports any QTI material
	 * on the bound assessment or current item, otherwise `"off"`.
	 */
	setQtiEnforcement(mode: QtiEnforcementMode | null): void {
		this.qtiEnforcementOverride = mode;
		this.policyEngine.updateInputs({
			qtiEnforcement: this.resolveEffectiveQtiEnforcement(),
		});
	}

	/**
	 * Get the policy engine inputs currently driving decisions. Useful
	 * for debugging / instrumentation; do not mutate.
	 */
	getPolicyInputs(): Readonly<ResolvedEngineInputs> {
		return this.policyEngine.getInputs();
	}

	/**
	 * Register a custom {@link PolicySource} with the owned policy
	 * engine. The source participates in every subsequent
	 * {@link decideToolPolicy} call until disposed (the returned
	 * function detaches and emits a `policy-source-removed` event).
	 *
	 * Delegates verbatim to
	 * {@link ToolPolicyEngine.registerPolicySource} — see that
	 * method for the full contract (event ordering, idempotency of
	 * the returned dispose function, and how registered sources
	 * compose with the built-in QTI source).
	 */
	registerPolicySource(source: PolicySource): () => void {
		return this.policyEngine.registerPolicySource(source);
	}

	/**
	 * Compute the effective `qtiEnforcement` mode given the explicit
	 * host override and the auto-mode helper.
	 *
	 * Auto-mode (no override) defers to
	 * {@link resolveDefaultQtiEnforcement}, which returns `"on"`
	 * exactly when the bound assessment or current item ref carries
	 * QTI 6-level precedence material (PNP, district policy, test
	 * administration, item-level required/restricted/parameters), and
	 * `"off"` otherwise. Hosts that bind a bare assessment record
	 * (just `id` / `name`) therefore keep the legacy floating-tools
	 * behavior — QTI gates engage the moment QTI material is present.
	 */
	private resolveEffectiveQtiEnforcement(): QtiEnforcementMode {
		if (this.qtiEnforcementOverride !== null) {
			return this.qtiEnforcementOverride;
		}
		return resolveDefaultQtiEnforcement({
			assessment: this.boundAssessment,
			currentItemRef: this.boundCurrentItemRef,
		});
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
			case "textToSpeech": {
				const reconfigurePromise = this._reconfigureTTSProvider();
				this.ttsReconfigurePromise = reconfigurePromise;
				void reconfigurePromise.finally(() => {
					if (this.ttsReconfigurePromise === reconfigurePromise) {
						this.ttsReconfigurePromise = undefined;
					}
				});
				void reconfigurePromise.then(async () => {
					const ttsConfig = this.getTTSConfigFromProviders();
					if (!this.lazyInit && ttsConfig?.enabled !== false) {
						await this.ensureTTSReady(ttsConfig);
					}
				});
				break;
			}

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
