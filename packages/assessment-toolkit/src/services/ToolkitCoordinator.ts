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
	ItemSettings,
	ToolParametersFor,
} from "@pie-players/pie-players-shared/types";
import {
	type CanonicalToolsConfig,
	type ToolPlacementConfig,
	type ToolPolicyConfig,
	type TextToSpeechToolProviderConfig,
	type ToolProviderConfig,
	type ToolProvidersConfig,
	type ToolsConfigInput,
	normalizeToolsConfig,
} from "./tools-config-normalizer.js";
import {
	collectToolConfigDiagnostics,
	normalizeToolConfigStrictness,
	reportToolConfigDiagnostics,
	type ToolConfigStrictness,
} from "./tool-config-validation.js";
import { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import type { CatalogChangeListener } from "./AccessibilityCatalogResolver.js";
import { ElementToolStateStore } from "./ElementToolStateStore.js";
import {
	frameworkErrorFromCoordinatorContext,
	type FrameworkErrorCohort,
	type FrameworkErrorModel,
} from "./framework-error.js";
import {
	FrameworkErrorBus,
	type FrameworkErrorListener,
} from "./framework-error-bus.js";
import { HighlightCoordinator } from "./HighlightCoordinator.js";
import { ToolCoordinator } from "./ToolCoordinator.js";
import type { ToolCoordinatorApi } from "./interfaces.js";
import type { ITTSProvider } from "@pie-players/pie-tts";
import { TTSService } from "./TTSService.js";
import {
	BrowserTTSProvider,
	browserFallbackConfig,
} from "./tts/browser-provider.js";
import type { ToolkitTTSConfig } from "./tts/provider-options.js";
import {
	buildRuntimeTTSConfig,
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
} from "./tts-runtime-config.js";
import { ToolProviderRegistry } from "./tool-providers/index.js";
import type { ToolProviderApi } from "./tool-providers/ToolProviderApi.js";

import { ToolRegistry } from "./ToolRegistry.js";
import type {
	ResolvedToolContext,
	ToolContextResolver,
	ToolContextResolverContext,
	ToolContextResolverMap,
	ToolRegistration,
} from "./ToolRegistry.js";
import type { ToolFailurePhase } from "./tool-failure.js";
import { ToolRequestRegistry } from "./tool-request.js";
import type { ToolOpenRequest, ToolRequestTarget } from "./tool-request.js";
import {
	ToolPolicyEngine,
	type FeaturePolicyDecision,
	type PnpEnforcementMode,
	type PolicySource,
	type ResolvedEngineInputs,
	type ToolPolicyChangeListener,
	type ToolPolicyDecision,
	type ToolPolicyDecisionRequest,
	type ToolPolicyDiagnostic,
	type ToolScope,
} from "../policy/engine.js";
import type {
	SectionControllerContext,
	SectionControllerEvent,
	SectionControllerEventType,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionControllerSessionState,
	SectionSessionPersistenceStrategy,
	SectionPersistenceFactoryDefaults,
} from "./section-controller-types.js";
import { resolveSectionSessionAssignment } from "./section-session-assignment.js";
export type {
	SectionControllerContext,
	SectionControllerEvent,
	SectionControllerEventType,
	SectionControllerFactoryDefaults,
	SectionControllerHandle,
	SectionControllerKey,
	SectionControllerLoadedRenderable,
	SectionSessionPersistenceConfig,
	SectionSessionPersistenceStrategy,
	SectionControllerRuntimeState,
	SectionControllerSessionState,
	SectionPersistenceFactoryDefaults,
} from "./section-controller-types.js";
export type {
	FeaturePolicyDecision,
	PnpEnforcementMode,
	ResolvedEngineInputs,
	ToolPolicyChangeListener,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
} from "../policy/engine.js";

class ToolkitCoordinatorDisposedError extends Error {
	constructor() {
		super("ToolkitCoordinator has been disposed.");
		this.name = "ToolkitCoordinatorDisposedError";
	}
}

class SectionControllerRetiredError extends Error {
	constructor() {
		super("Section controller acquisition was retired during initialization.");
		this.name = "SectionControllerRetiredError";
	}
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value);

const mergeToolConfigUpdate = (
	toolId: string,
	current: ToolProviderConfig,
	updates: Partial<ToolProviderConfig>,
): ToolProviderConfig => {
	const next = { ...current, ...updates };
	if (
		toolId === "textToSpeech" &&
		isPlainRecord(current.mathSpeech) &&
		isPlainRecord(updates.mathSpeech)
	) {
		next.mathSpeech = { ...current.mathSpeech, ...updates.mathSpeech };
	}
	return next;
};

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
	 * Tool availability and configuration. The default placement is empty: a tool
	 * shows only where placement puts it, and a grant does not place one.
	 */
	tools?: ToolsConfigInput;

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
	 * Registry used for tool-config validation and the only source of tool
	 * providers: the coordinator registers one per registration that carries a
	 * provider descriptor. Omitted, the coordinator takes the registry of the
	 * toolkit it is bound to — the section player's, under a section player — and
	 * until then validates nothing and registers no provider. A registry passed
	 * here is never replaced.
	 */
	toolRegistry?: ToolRegistry | null;

	/**
	 * Host-owned per-tool render-context resolvers. These run after
	 * framework policy gates (placement, provider config, host policy,
	 * PNP/profile rules, and custom policy sources) and can hide a
	 * surviving tool or attach render params for the tool registration.
	 * They cannot re-enable a tool removed by policy.
	 */
	toolContextResolvers?: ToolContextResolverMap;

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
	 * Start text-to-speech at its first use rather than as part of readiness.
	 * `waitUntilReady()` then settles without it, unless policy grants the tool,
	 * so a granted read-aloud still fails before the learner starts.
	 *
	 * @default false
	 */
	lazyInit?: boolean;

	/**
	 * Start initializing at construction. `<pie-assessment-toolkit>` passes false
	 * for the coordinator it builds, and starts initialization once its section
	 * composes.
	 *
	 * @default !lazyInit
	 */
	eagerInit?: boolean;

	/**
	 * Internal bootstrap escape hatch used by framework-owned hosts.
	 * When true, constructor skips throwing validation and expects caller
	 * to pass a pre-validated tools config.
	 *
	 * @internal
	 */
	deferToolConfigValidation?: boolean;

	/**
	 * Set by `<pie-assessment-toolkit>` on the coordinator it builds for itself.
	 * That toolkit binds only the `assessment` its host passes, and a section
	 * player passes none, so feature policy reports an unbound assessment only
	 * while PNP enforcement is explicitly `"on"`.
	 *
	 * @internal
	 */
	assessmentOptional?: boolean;

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
		| "section-controller-dispose"
		| ToolFailurePhase;
	/** The tool whose provider failed. */
	toolId?: string;
	details?: Record<string, unknown>;
	recoverable?: boolean;
}

const TOOL_FAILURE_SUMMARY: Record<ToolFailurePhase, string> = {
	"tool-module-load": "failed to load",
	"tool-request-open": "failed to open on request",
	"tool-request-host-check": "failed its toolbar's host check",
	"tool-visibility": "failed its relevance check",
	"tool-applicability": "failed its applicability check",
	"tool-state-load": "failed to restore its state",
	"tool-state-save": "failed to save its state",
	"tool-playback": "failed during playback",
};

export interface ProviderLifecycleContext {
	providerName?: string;
}

export interface SectionControllerLifecycleEvent {
	type: "ready" | "disposed";
	key: SectionControllerKey;
	controller?: SectionControllerHandle;
}

/**
 * Subscribe-time arguments for {@link ToolkitCoordinator.subscribeSectionEvents}.
 *
 * Phase D contract: subscriptions follow the toolkit's *active section
 * cohort* automatically. The listener is bound to whatever section
 * controller is active at subscribe time and is migrated, with snapshot
 * replay, on every cohort transition. There is no per-subscription
 * `(sectionId, attemptId)` binding.
 */
export interface SectionEventSubscriptionArgs {
	listener: (event: SectionControllerEvent) => void;
	eventTypes?: readonly SectionControllerEventType[];
	itemIds?: readonly string[];
}

/**
 * Internal Phase D subscription record. Holds a listener's filter args
 * and the disposer for whichever section controller it is currently
 * bound to. Detached and re-attached by the coordinator on every cohort
 * transition.
 *
 * @internal
 */
interface ActiveSectionSubscription {
	listener: (event: SectionControllerEvent) => void;
	eventTypes?: readonly SectionControllerEventType[];
	itemIds?: readonly string[];
	/**
	 * Disposer for the controller `subscribe(...)` call backing this
	 * subscription, or `null` when no cohort is currently active. Cleared
	 * on every detach so subsequent re-binds start from a clean slate.
	 */
	unsubscribeCurrent: (() => void) | null;
}

interface SectionControllerInitToken {
	retired: boolean;
	candidateClaimed: boolean;
}

interface SectionControllerInitEntry {
	key: SectionControllerKey;
	token: SectionControllerInitToken;
	promise: Promise<SectionControllerHandle>;
}

interface SectionControllerCandidate {
	mapKey: string;
	key: SectionControllerKey;
	controller: SectionControllerHandle;
	persistence: SectionSessionPersistenceStrategy;
	token: SectionControllerInitToken;
}

export type SectionItemEventType = Exclude<
	SectionControllerEventType,
	| "section-navigation-change"
	| "section-session-applied"
	| "section-loading-complete"
	| "section-items-complete-changed"
	| "section-error"
	| "timed-media-cue-changed"
	| "timed-media-policy-degraded"
	| "timed-media-invalid"
>;

export type SectionScopedEventType = Extract<
	SectionControllerEventType,
	| "section-navigation-change"
	| "section-session-applied"
	| "section-loading-complete"
	| "section-items-complete-changed"
	| "section-error"
	// Timed-media state is section-scoped even where a cue names items: a cue
	// activation is a fact about the timeline, and one event carries every item
	// the transition revealed rather than one event per item.
	| "timed-media-cue-changed"
	| "timed-media-policy-degraded"
	| "timed-media-invalid"
>;

export type SectionItemEvent = Extract<
	SectionControllerEvent,
	{ type: SectionItemEventType }
>;

export type SectionScopedEvent = Extract<
	SectionControllerEvent,
	{ type: SectionScopedEventType }
>;

/**
 * Subscribe-time arguments for {@link ToolkitCoordinator.subscribeItemEvents}.
 *
 * See {@link SectionEventSubscriptionArgs} for the Phase D active-cohort
 * binding contract.
 */
export interface SectionItemEventSubscriptionArgs {
	listener: (event: SectionItemEvent) => void;
	eventTypes?: readonly SectionItemEventType[];
	itemIds?: readonly string[];
}

/**
 * Subscribe-time arguments for
 * {@link ToolkitCoordinator.subscribeSectionLifecycleEvents}.
 *
 * See {@link SectionEventSubscriptionArgs} for the Phase D active-cohort
 * binding contract.
 */
export interface SectionScopedEventSubscriptionArgs {
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
	"timed-media-cue-changed",
	"timed-media-policy-degraded",
	"timed-media-invalid",
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
	 * subscribers (DOM event, prop callback, `subscribeFrameworkErrors`
	 * listeners).
	 */
	onFrameworkError?: (model: FrameworkErrorModel) => void;

	onBeforeTTSInit?: (context: ToolkitErrorContext) => void | Promise<void>;
	onTTSReady?: () => void | Promise<void>;
	onCoordinatorReady?: (
		coordinator: ToolkitCoordinator,
	) => void | Promise<void>;

	onProviderRegistered?: (
		toolId: string,
		meta: ProviderLifecycleContext,
	) => void | Promise<void>;
	onProviderInitStart?: (
		toolId: string,
		meta: ProviderLifecycleContext,
	) => void | Promise<void>;
	onProviderReady?: (
		toolId: string,
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
 * ToolkitCoordinator - Orchestrates all assessment toolkit services
 *
 * @example
 * ```typescript
 * // Exported by @pie-players/pie-default-tool-loaders
 * const toolRegistry = createPackagedToolRegistry();
 *
 * // Create coordinator with configuration
 * const coordinator = new ToolkitCoordinator({
 *   assessmentId: 'demo-three-questions',
 *   toolRegistry,
 *   tools: {
 *     providers: {
 *       textToSpeech: { enabled: true, backend: 'browser' },
 *       answerEliminator: { enabled: true }
 *     },
 *     placement: {
 *       item: ['textToSpeech', 'answerEliminator']
 *     }
 *   }
 * });
 *
 * // Pass to section player
 * player.runtime = { ...(player.runtime ?? {}), coordinator };
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
	readonly toolCoordinator: ToolCoordinatorApi;
	readonly highlightCoordinator: HighlightCoordinator;
	readonly elementToolStateStore: ElementToolStateStore;
	readonly catalogResolver: AccessibilityCatalogResolver;
	readonly toolProviderRegistry: ToolProviderRegistry;
	readonly hooks: ToolkitCoordinatorHooks;
	readonly lazyInit: boolean;

	/** Track TTS initialization state */
	private ttsInitialized = false;
	/** Text-to-speech failed to start and policy does not grant it. */
	private ttsDegraded = false;
	private ttsInitPromise?: Promise<void>;
	private ttsReconfigurePromise?: Promise<void>;
	private stateLoaded = false;
	/**
	 * The loader ran, whether or not it returned state. A failed load is
	 * reported once and the coordinator runs without saved tool state.
	 */
	private stateLoadSettled = false;
	private stateLoadPromise?: Promise<void>;
	private coordinatorReadyPromise?: Promise<void>;
	private coordinatorReadyNotified = false;
	private readonly providerInitPromises = new Map<
		string,
		Promise<ToolProviderApi>
	>();
	/**
	 * Recoverable failures, by tool. A policy change that grants one of these
	 * tools reports its failure again as fatal.
	 */
	private readonly degradedTools = new Map<
		string,
		{ error: unknown; context: ToolkitErrorContext }
	>();
	/** Tool failures already reported, by phase and tool, each reported once. */
	private readonly reportedToolFailures = new Set<string>();
	private readonly readyChangeListeners = new Set<() => void>();
	private readonly eagerInit: boolean;
	private toolRegistry: ToolRegistry;
	/** Whether the host passed `toolRegistry`, which then always stands. */
	private readonly toolRegistrySupplied: boolean;
	/**
	 * Whether the registry is final: supplied at construction, or adopted from
	 * the toolkit this coordinator is bound to.
	 */
	private toolRegistrySettled: boolean;
	/**
	 * Whether a bound toolkit reported having no registry. Until then, or until a
	 * registry settles, the empty placeholder reports no missing registry, since
	 * the toolkit may supply one.
	 */
	private toolRegistryAbsent = false;
	private readonly toolContextResolvers = new Map<
		string,
		ToolContextResolver
	>();
	private readonly toolContextResolverChangeListeners = new Set<() => void>();
	private readonly toolRequests = new ToolRequestRegistry(
		(toolId, phase, error) => this.reportToolFailure(toolId, phase, error),
	);
	private readonly sectionControllers = new Map<
		string,
		SectionControllerHandle
	>();
	private readonly sectionControllerKeys = new Map<
		string,
		SectionControllerKey
	>();
	private readonly sectionControllerInitEntries = new Map<
		string,
		SectionControllerInitEntry
	>();
	private readonly sectionControllerDisposePromises = new Map<
		string,
		Promise<void>
	>();
	private readonly sectionPersistenceStrategies = new Map<
		string,
		SectionSessionPersistenceStrategy
	>();
	private readonly sectionControllerLifecycleListeners = new Set<
		(event: SectionControllerLifecycleEvent) => void
	>();
	/**
	 * Phase D: every active section-event subscription, indexed by
	 * listener identity. The listener follows the toolkit's active
	 * section cohort across transitions; this map is the registry the
	 * coordinator iterates on every cohort change to detach the listener
	 * from the outgoing controller, attach it to the new one, and replay
	 * the snapshot (content-loaded × N then section-loading-complete) in
	 * canonical order.
	 *
	 * Dedup is by listener identity: subscribing the same listener
	 * function twice replaces the prior subscription's filter args.
	 */
	private readonly activeSubscriptions = new Map<
		(event: SectionControllerEvent) => void,
		ActiveSectionSubscription
	>();
	/**
	 * Phase D: map key of the section controller currently treated as
	 * the *active cohort*. Set by `getOrCreateSectionController` (both
	 * the create-new and resolve-existing paths) and cleared when the
	 * matching controller is disposed, and `null` while the next requested
	 * cohort is still starting.
	 */
	private activeCohortMapKey: string | null = null;
	/**
	 * Latest requested active cohort. Async controller initialization can
	 * resolve out of order; only the most recent request may migrate active
	 * subscriptions. Older completions still populate the controller cache.
	 * `null` until the first request, which is the only state where
	 * `subscribeSectionEvents` throws.
	 */
	private latestRequestedActiveCohortMapKey: string | null = null;
	private readonly telemetryListeners = new Set<ToolkitTelemetryListener>();
	private readonly frameworkErrorBus: FrameworkErrorBus;
	private readonly ownsFrameworkErrorBus: boolean;
	/** The instance behind {@link toolCoordinator}, kept for disposal. */
	private readonly ownedToolCoordinator: ToolCoordinator;
	private frameworkErrorHookUnsubscribe: (() => void) | null = null;
	private disposePromise: Promise<void> | null = null;

	/**
	 * Unified Tool Policy Engine. Owned by the coordinator and disposed with it.
	 *
	 * Hosts read decisions via {@link decideToolPolicy} or subscribe
	 * to changes via {@link onPolicyChange}.
	 */
	private readonly policyEngine: ToolPolicyEngine;

	/**
	 * Policy diagnostics reported since the last input change, keyed by code,
	 * tool id and, for `tool-policy.itemSettingNotApplied`, item id; see
	 * {@link warnPolicyDiagnostics}.
	 */
	private readonly reportedPolicyDiagnostics = new Map<
		string,
		ToolPolicyDiagnostic
	>();
	private readonly policyDiagnosticListeners = new Set<
		(diagnostic: ToolPolicyDiagnostic) => void
	>();

	/**
	 * Whether {@link decideFeaturePolicy} has already reported serving a decision
	 * with no assessment bound.
	 *
	 * One report per coordinator, not per decision: a feature policy is consulted
	 * once per capability per card, so a per-decision warning would bury itself.
	 * Never reset — {@link updateAssessment} arriving later fixes the deployment,
	 * and re-arming would report the same gap again on the next unbound coordinator
	 * lifetime for no new information.
	 */
	private reportedUnboundFeaturePolicy = false;

	/**
	 * Whether {@link _initializeTTS} has already reported a non-browser backend
	 * falling back to browser speech because no text-to-speech provider is registered.
	 * Once per coordinator: a text-to-speech config change re-runs
	 * initialization, and the missing provider is the same gap each time.
	 */
	private reportedMissingTTSProvider = false;

	/**
	 * The backend of a fallback {@link reportMissingTTSProvider} held back while
	 * the registry was unsettled, reported if the bound toolkit has no registry.
	 */
	private heldMissingTTSProviderBackend: string | null = null;

	/**
	 * Whether {@link validateToolsConfig} has already reported validating with
	 * no registry (`tools.registryUnavailable`). Once per coordinator: every
	 * {@link updateToolConfig} and {@link updateToolsPlacement} re-validates, and
	 * the missing registry is the same gap each time.
	 */
	private reportedRegistryUnavailable = false;

	private resolveConfig(
		config: ToolkitCoordinatorConfig,
	): ToolkitCoordinatorConfig {
		const strictness = normalizeToolConfigStrictness(
			config.toolConfigStrictness,
		);
		// An empty placeholder when the host supplies none, replaced by the bound
		// toolkit's registry in `adoptToolRegistry`. This package does not hold the
		// packaged capability set, and importing it would be a dependency cycle.
		// Tool-id validation is skipped against an empty registry rather than
		// rejecting every configured id.
		const toolRegistry = config.toolRegistry ?? new ToolRegistry();
		const normalized =
			config.deferToolConfigValidation === true
				? normalizeToolsConfig(config.tools as any)
				: this.validateToolsConfig(config.tools as any, {
						strictness,
						source: "ToolkitCoordinator.init",
						toolRegistry,
					});
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

	/**
	 * `normalizeAndValidateToolsConfig`, except that `tools.registryUnavailable`
	 * is reported once per coordinator, whichever call validates.
	 */
	private validateToolsConfig(
		tools: ToolsConfigInput | null | undefined,
		options: {
			strictness: ToolConfigStrictness;
			source: string;
			toolRegistry: ToolRegistry;
		},
	): CanonicalToolsConfig {
		const { config, diagnostics } = collectToolConfigDiagnostics(
			tools,
			options.toolRegistry,
		);
		const unreported =
			this.reportedRegistryUnavailable || this.toolRegistryPending()
				? diagnostics.filter(
						(entry) => entry.code !== "tools.registryUnavailable",
					)
				: diagnostics;
		reportToolConfigDiagnostics(unreported, options);
		if (
			options.strictness !== "off" &&
			unreported.some((entry) => entry.code === "tools.registryUnavailable")
		) {
			this.reportedRegistryUnavailable = true;
		}
		return config;
	}

	constructor(config: ToolkitCoordinatorConfig) {
		if (!config.assessmentId) {
			throw new Error("ToolkitCoordinator requires assessmentId in config");
		}

		this.toolRegistrySupplied = config.toolRegistry != null;
		this.toolRegistrySettled = this.toolRegistrySupplied;
		const resolvedConfig = this.resolveConfig(config);

		this.assessmentId = resolvedConfig.assessmentId;
		this.config = resolvedConfig;
		this.toolRegistry = resolvedConfig.toolRegistry ?? new ToolRegistry();
		this.installToolContextResolvers(resolvedConfig.toolContextResolvers);
		// The coordinator's own copy, so `setHooks` leaves the host's object as it
		// passed it.
		this.hooks = { ...resolvedConfig.hooks };
		this.lazyInit = config.lazyInit === true;
		this.eagerInit = config.eagerInit ?? !this.lazyInit;

		// Use the host-provided framework-error bus if one was passed
		// (typical when embedded inside <pie-assessment-toolkit>, so
		// pre-coordinator failures from the CE flow through the same
		// fan-out as coordinator failures). Otherwise own a private one.
		this.frameworkErrorBus =
			config.frameworkErrorBus ?? new FrameworkErrorBus();
		this.ownsFrameworkErrorBus = !config.frameworkErrorBus;
		this.subscribeFrameworkErrorHookAdapters();

		// Initialize all services
		this.ownedToolCoordinator = new ToolCoordinator();
		this.toolCoordinator = this.ownedToolCoordinator;
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
		// Selection read-aloud speaks through this service without the inline TTS
		// tool ever having run, so it cannot rely on that tool to attach highlights.
		this.ttsService.setHighlightCoordinator(this.highlightCoordinator);
		// A caller that speaks without `ensureTTSReady()` first, such as selection
		// read-aloud, starts the service instead of finding it uninitialized.
		this.ttsService.setReadinessGate(() => this.ensureTTSReady());
		this.ttsService.setMathSpeechSource(
			() =>
				buildRuntimeTTSConfig(
					resolveTTSRuntimeSettings(this.resolveTTSToolConfig()),
				).providerOptions?.mathSpeech,
		);
		this.setupStatePersistenceHooks();

		// The unified ToolPolicyEngine, seeded with the validated tools config.
		// The assessment starts `null` and items register their settings as they
		// mount; auto-mode enforcement turns on only once the policy material a
		// decision reads is present, so a host that consumes the engine for
		// placement/policy gating alone sees no PNP/profile gate.
		this.policyEngine = new ToolPolicyEngine({
			toolRegistry: this.toolRegistry,
			contextId: `toolkit-coordinator:${this.assessmentId}`,
			assessmentOptional: this.config.assessmentOptional === true,
			inputs: {
				tools: this.config.tools as CanonicalToolsConfig,
				assessment: null,
				pnpEnforcement: this.resolveConfiguredPnpEnforcement(),
			},
		});

		// Input diagnostics are computed once per change, so they are reported
		// here rather than with each decision.
		this.policyEngine.onPolicyChange((event) => {
			if (event.reason === "disposed") return;
			if (event.reason === "inputs" || event.reason === "pnp-enforcement") {
				this.reportedPolicyDiagnostics.clear();
			}
			this.warnPolicyDiagnostics(event.inputs.diagnostics);
			this.reportNewlyGrantedFailures();
		});

		if (this.eagerInit) {
			void this.waitUntilReady().catch((err) => {
				if (err instanceof ToolkitCoordinatorDisposedError) return;
				console.error("[ToolkitCoordinator] Failed eager initialization:", err);
				this.handleError(err, { phase: "coordinator-ready", recoverable: false });
			});
		}
	}

	private assertNotDisposed(): void {
		if (this.disposePromise !== null) {
			throw new ToolkitCoordinatorDisposedError();
		}
	}

	/**
	 * Subscribe the canonical `onFrameworkError` hook adapter to the
	 * framework-error bus.
	 *
	 * Called once from the constructor. The adapter inspects the live
	 * `this.hooks` reference, so a hook added later via {@link setHooks}
	 * is picked up automatically without re-subscribing.
	 */
	private subscribeFrameworkErrorHookAdapters(): void {
		this.frameworkErrorHookUnsubscribe =
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

	private emitSectionControllerLifecycle(
		event: SectionControllerLifecycleEvent,
	): void {
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

	/**
	 * Every report site states whether the coordinator carries on after the
	 * failure; one that takes down only its section passes that section.
	 */
	private handleError(
		error: unknown,
		context: ToolkitErrorContext & { recoverable: boolean },
		cohort?: FrameworkErrorCohort,
	): void {
		const model = frameworkErrorFromCoordinatorContext({
			error,
			context,
			recoverable: context.recoverable,
			scope: cohort ? "cohort" : "runtime",
			cohort,
		});
		this.frameworkErrorBus.reportFrameworkError(model);
	}

	/**
	 * Whether policy grants `toolId` as an accommodation on some surface: a
	 * test-administration override, a mounted item's or a district requirement,
	 * or profile support. A toolbar tool counts only surfaces where PNP
	 * enforcement is on; a region feature ignores enforcement, as its decisions
	 * do. Read without the unbound-assessment warning.
	 */
	private isToolGranted(toolId: string): boolean {
		try {
			return this.policyEngine.grantsFeatureAnywhere(toolId, {
				enforced: this.toolRegistry.getToolActivation(toolId) !== "region",
			});
		} catch {
			return false;
		}
	}

	/**
	 * Reports a tool's start failure: recoverable, so the tool reports itself
	 * unavailable and the assessment goes on, unless policy grants the tool.
	 * `fallbackFollows` marks a failure another path absorbs, which is recoverable
	 * whatever the policy.
	 */
	private reportStartFailure(
		error: unknown,
		context: ToolkitErrorContext,
		toolIds: Iterable<string>,
		fallbackFollows = false,
	): void {
		const ids = Array.from(toolIds);
		const recoverable =
			fallbackFollows || !ids.some((toolId) => this.isToolGranted(toolId));
		if (recoverable && !fallbackFollows) {
			for (const toolId of ids) this.degradedTools.set(toolId, { error, context });
		}
		this.handleError(error, { ...context, recoverable });
	}

	/**
	 * Report that a tool failed in `phase`. A module that failed to load follows
	 * the start-failure policy: the tool degrades, so toolbars withhold it, unless
	 * policy grants it. Every other phase is recoverable, since its report site
	 * keeps a recovery, and is reported on a microtask. Reported once per tool and
	 * phase however many toolbars or instances fail. A module failure re-announces the request targets, since
	 * the reporting toolbar no longer hosts the tool.
	 */
	reportToolFailure(
		toolId: string,
		phase: ToolFailurePhase,
		error: unknown,
	): void {
		if (phase === "tool-module-load") this.toolRequests.notifyTargetsChange();
		const key = `${phase}\u0000${toolId}`;
		if (this.reportedToolFailures.has(key)) return;
		this.reportedToolFailures.add(key);
		const detail =
			error instanceof Error && error.message.trim().length > 0
				? error.message
				: String(error);
		const report = () =>
			this.reportStartFailure(
				new Error(`Tool "${toolId}" ${TOOL_FAILURE_SUMMARY[phase]}: ${detail}`, {
					cause: error,
				}),
				{ phase, details: { toolId } },
				[toolId],
				phase !== "tool-module-load",
			);
		// The recoverable phases fail inside a toolbar's derived state, where a
		// listener writing state would throw.
		if (phase === "tool-module-load") report();
		else queueMicrotask(report);
	}

	private reportNewlyGrantedFailures(): void {
		for (const [toolId, failure] of this.degradedTools) {
			if (!this.isToolGranted(toolId)) continue;
			this.degradedTools.delete(toolId);
			this.handleError(failure.error, { ...failure.context, recoverable: false });
		}
	}

	/**
	 * Subscribe to changes of {@link isReady}: state loading, text-to-speech
	 * starting, failing or reconfiguring. The listener reads the status itself.
	 */
	onReadyChange(listener: () => void): () => void {
		this.readyChangeListeners.add(listener);
		return () => {
			this.readyChangeListeners.delete(listener);
		};
	}

	private notifyReadyChange(): void {
		for (const listener of this.readyChangeListeners) {
			try {
				listener();
			} catch (error) {
				console.warn("[ToolkitCoordinator] ready-change listener failed:", error);
			}
		}
	}

	/**
	 * Subscribe to framework-error events emitted by this coordinator.
	 *
	 * See `ToolkitCoordinatorApi.subscribeFrameworkErrors` for the
	 * contract. The bus is shared with the canonical
	 * `onFrameworkError` lifecycle hook, so a listener registered here
	 * sees the same fan-out the hook sees.
	 */
	public subscribeFrameworkErrors(
		listener: FrameworkErrorListener,
	): () => void {
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
		// Stored per attempt. Without an attempt id nothing tells two learners on
		// one device apart, so the section is neither read nor written.
		const getStorageKey = (context: SectionControllerContext): string | null => {
			const { assessmentId, sectionId, attemptId } = context.key;
			if (!attemptId) return null;
			return `pie:section-controller:v1:${assessmentId}:${sectionId}:${attemptId}`;
		};
		return {
			async loadSession(context) {
				const key = getStorageKey(context);
				if (!storage || !key) return null;
				const value = storage.getItem(key);
				if (!value) return null;
				try {
					return JSON.parse(value);
				} catch {
					return null;
				}
			},
			async saveSession(context, session) {
				const key = getStorageKey(context);
				if (!storage || !key) return;
				storage.setItem(key, JSON.stringify(session));
			},
			async clearSession(context) {
				const key = getStorageKey(context);
				if (!storage || !key) return;
				storage.removeItem(key);
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
				this.handleError(err, { phase: "state-save", recoverable: true });
			});
		});
	}

	private async ensureStateLoaded(): Promise<void> {
		if (this.stateLoadSettled) return;
		if (this.stateLoadPromise) return this.stateLoadPromise;
		this.stateLoadPromise = (async () => {
			const loader = this.hooks.loadToolState;
			if (!loader) {
				return;
			}
			try {
				const state = await loader();
				this.assertNotDisposed();
				if (state && typeof state === "object") {
					this.elementToolStateStore.loadState(state);
				}
				this.stateLoaded = true;
				this.stateLoadSettled = true;
				await this.emitTelemetry("pie-toolkit-tool-state-loaded", {
					hasState: Boolean(state),
				});
			} catch (err) {
				if (err instanceof ToolkitCoordinatorDisposedError) throw err;
				this.stateLoadSettled = true;
				this.handleError(err, { phase: "state-load", recoverable: true });
			}
		})().finally(() => {
			this.stateLoadPromise = undefined;
			this.notifyReadyChange();
		});
		return this.stateLoadPromise;
	}

	/** Whether the toolkit this coordinator binds to may still supply a registry. */
	private toolRegistryPending(): boolean {
		return !this.toolRegistrySettled && !this.toolRegistryAbsent;
	}

	private reportMissingTTSProvider(backend: string): void {
		// The toolkit this coordinator binds to may still supply the provider.
		if (this.toolRegistryPending()) {
			this.heldMissingTTSProviderBackend = backend;
			return;
		}
		if (this.reportedMissingTTSProvider) return;
		this.reportedMissingTTSProvider = true;
		console.warn(
			`[ToolkitCoordinator] Text-to-speech is configured for the "${backend}" backend but falls back to browser speech: no "textToSpeech" tool provider is registered. A coordinator registers tool providers only from its \`toolRegistry\`, or from its toolkit's when constructed without one, so supply one that carries the text-to-speech registration — for the packaged capability set, \`createPackagedToolRegistry()\` from "@pie-players/pie-default-tool-loaders". Reported once per coordinator.`,
		);
	}

	/**
	 * Take the registry of the toolkit this coordinator is bound to, when the host
	 * constructed it without one: the config is validated against it, its
	 * providers register, and text-to-speech re-initializes through it if it
	 * already started. The toolkit elements call this on binding, and again when
	 * their registry changes. A registry passed at construction stands, and the
	 * first registry adopted wins; `null` records a toolkit without one, which
	 * reports the registry as missing and still adopts one that arrives later.
	 *
	 * @returns Whether `registry` was adopted.
	 */
	adoptToolRegistry(registry: ToolRegistry | null): boolean {
		if (this.disposePromise !== null || this.toolRegistrySettled) return false;
		if (!registry && this.toolRegistryAbsent) return false;
		const heldBackend = this.heldMissingTTSProviderBackend;
		this.heldMissingTTSProviderBackend = null;
		const strictness = this.config.toolConfigStrictness ?? "error";
		const source = "ToolkitCoordinator.adoptToolRegistry";
		if (!registry) {
			this.toolRegistryAbsent = true;
			this.validateToolsConfig(this.config.tools as CanonicalToolsConfig, {
				strictness,
				source,
				toolRegistry: this.toolRegistry,
			});
			if (heldBackend) this.reportMissingTTSProvider(heldBackend);
			return false;
		}
		this.toolRegistrySettled = true;
		this.toolRegistry = registry;
		this.config.toolRegistry = registry;
		try {
			// Warn at most: the config was accepted at construction, and a binding
			// toolkit has no caller to throw to.
			this.config.tools = this.validateToolsConfig(
				this.config.tools as CanonicalToolsConfig,
				{
					strictness: strictness === "off" ? "off" : "warn",
					source,
					toolRegistry: registry,
				},
			);
		} catch (err) {
			console.warn(
				"[ToolkitCoordinator] Tool config does not validate against the adopted tool registry:",
				err,
			);
		}
		this.policyEngine.replaceToolRegistry(
			registry,
			this.config.tools as CanonicalToolsConfig,
		);
		const ttsStarted =
			this.ttsInitialized ||
			this.ttsInitPromise !== undefined ||
			this.ttsReconfigurePromise !== undefined;
		for (const tool of this.getProviderDescriptorTools()) {
			if (ttsStarted && tool.toolId === "textToSpeech") continue;
			void this.registerProviderFromTool(tool);
		}
		if (ttsStarted) this.scheduleTTSReconfigure();
		return true;
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
		return this.toolRegistry.getAllTools().filter((tool) => !!tool.provider);
	}

	/**
	 * Register the provider `tool`'s descriptor creates for the tool's current
	 * config under the tool's id, unless the tool is disabled or, without
	 * `replace`, a provider is registered under that id. A descriptor that throws
	 * is reported the way a failed registration is.
	 */
	private async registerProviderFromTool(
		tool: ToolRegistration,
		replace = false,
	): Promise<void> {
		const descriptor = tool.provider;
		if (!descriptor) return;
		const { toolId } = tool;
		let registration: Parameters<ToolProviderRegistry["register"]>[1];
		try {
			const toolConfig = this.getToolConfig(toolId) || undefined;
			if (toolConfig?.enabled === false) {
				// A disabled tool keeps no provider, including the one it replaces.
				if (replace) void this.toolProviderRegistry.unregister(toolId);
				return;
			}
			if (!replace && this.toolProviderRegistry.has(toolId)) return;
			const provider = descriptor.createProvider(toolConfig);
			const initConfig =
				descriptor.getInitConfig?.(toolConfig) ??
				toolConfig?.provider?.init ??
				{};
			const initConfigWithTelemetry = this.addToolTelemetryReporter(
				toolId,
				initConfig,
			);
			const registryTelemetry = this.createToolTelemetryForwarder(toolId);
			const authFetcher =
				descriptor.getAuthFetcher?.(toolConfig) ??
				toolConfig?.provider?.runtime?.authFetcher;
			registration = {
				provider,
				config: initConfigWithTelemetry,
				lazy: descriptor.lazy ?? true,
				authFetcher,
				onTelemetry: registryTelemetry,
			};
		} catch (err) {
			this.reportProviderRegisterFailure(err, toolId);
			return;
		}
		await this.registerProvider(toolId, registration);
	}

	private createToolTelemetryForwarder(
		toolId: string,
	): (eventName: string, payload?: Record<string, unknown>) => Promise<void> {
		return async (eventName: string, payload?: Record<string, unknown>) => {
			await this.emitTelemetry(eventName, { ...(payload || {}), toolId });
		};
	}

	private addToolTelemetryReporter(
		toolId: string,
		initConfig: unknown,
	): Record<string, unknown> {
		const configObject =
			initConfig && typeof initConfig === "object"
				? { ...(initConfig as Record<string, unknown>) }
				: {};
		const existingReporter =
			typeof configObject.onTelemetry === "function"
				? (configObject.onTelemetry as (
						eventName: string,
						payload?: Record<string, unknown>,
					) => void | Promise<void>)
				: null;
		const forwardTelemetry = this.createToolTelemetryForwarder(toolId);
		configObject.onTelemetry = async (
			eventName: string,
			payload?: Record<string, unknown>,
		) => {
			if (existingReporter) {
				await existingReporter(eventName, payload);
			}
			await forwardTelemetry(eventName, payload);
		};
		return configObject;
	}

	private async registerProvider(
		toolId: string,
		config: Parameters<ToolProviderRegistry["register"]>[1],
	): Promise<void> {
		try {
			this.toolProviderRegistry.register(toolId, config);
			const meta: ProviderLifecycleContext = {
				providerName: config.provider.providerName,
			};
			await this.hooks.onProviderRegistered?.(toolId, meta);
			await this.emitTelemetry("pie-toolkit-provider-registered", {
				toolId,
				providerName: config.provider.providerName,
			});
		} catch (err) {
			this.reportProviderRegisterFailure(err, toolId);
		}
	}

	/**
	 * A console warning and a `provider-register` framework error, under the
	 * start-failure policy every other tool failure follows.
	 */
	private reportProviderRegisterFailure(err: unknown, toolId: string): void {
		console.warn(
			`[ToolkitCoordinator] Failed to register the provider of tool "${toolId}":`,
			err,
		);
		this.reportStartFailure(err, { phase: "provider-register", toolId }, [toolId]);
	}

	public async ensureProviderReady(toolId: string): Promise<ToolProviderApi> {
		return this.initializeProvider(toolId, false);
	}

	/** `fallbackFollows`: the caller recovers from a failure on its own. */
	private async initializeProvider(
		toolId: string,
		fallbackFollows: boolean,
	): Promise<ToolProviderApi> {
		this.assertNotDisposed();
		const existing = this.providerInitPromises.get(toolId);
		if (existing) return existing;
		const promise = (async () => {
			try {
				let provider = await this.toolProviderRegistry.getProvider(
					toolId,
					false,
				);
				this.assertNotDisposed();
				// A tool asks each time it opens; the lifecycle hooks report the start once.
				if (this.toolProviderRegistry.isInitialized(toolId)) return provider;
				const meta: ProviderLifecycleContext = {
					providerName: provider.providerName,
				};
				await this.hooks.onProviderInitStart?.(toolId, meta);
				this.assertNotDisposed();
				await this.toolProviderRegistry.initialize(toolId);
				this.assertNotDisposed();
				// A config update may have replaced the provider during its start.
				provider = await this.toolProviderRegistry.getProvider(toolId, false);
				await this.hooks.onProviderReady?.(toolId, meta);
				this.assertNotDisposed();
				await this.emitTelemetry("pie-toolkit-provider-ready", { toolId });
				this.assertNotDisposed();
				return provider;
			} catch (err) {
				if (err instanceof ToolkitCoordinatorDisposedError) throw err;
				const error = err instanceof Error ? err : new Error(String(err));
				this.reportStartFailure(
					error,
					{ phase: "provider-init", toolId },
					// Attributed when the id names a tool with a provider; any other id
					// was never a tool's.
					this.toolRegistry.get(toolId)?.provider ? [toolId] : [],
					fallbackFollows,
				);
				throw error;
			}
		})().finally(() => {
			this.providerInitPromises.delete(toolId);
		});
		this.providerInitPromises.set(toolId, promise);
		return promise;
	}

	public setHooks(hooks: ToolkitCoordinatorHooks): void {
		Object.assign(this.hooks, hooks);
		this.setupStatePersistenceHooks();

		if (
			this.disposePromise === null &&
			hooks.onCoordinatorReady &&
			this.isReady()
		) {
			void Promise.resolve(hooks.onCoordinatorReady(this)).catch((err) => {
				this.handleError(err, { phase: "coordinator-ready", recoverable: false });
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

	public subscribeSectionEvents(
		args: SectionEventSubscriptionArgs,
	): () => void {
		// Phase D: subscriptions follow the toolkit's *active section
		// cohort* automatically. We bind the listener to whichever
		// controller is currently active and re-bind it on every
		// `getOrCreateSectionController` / `disposeSectionController`
		// transition, with snapshot replay on each migration. A listener
		// added while the next section is still starting binds when it
		// becomes active.
		if (
			this.activeCohortMapKey === null &&
			this.latestRequestedActiveCohortMapKey === null
		) {
			throw new Error(
				"[ToolkitCoordinator] subscribeSectionEvents requires an active section cohort; call getOrCreateSectionController first.",
			);
		}
		const previous = this.activeSubscriptions.get(args.listener);
		if (previous) {
			previous.unsubscribeCurrent?.();
			previous.unsubscribeCurrent = null;
		}
		const sub: ActiveSectionSubscription = {
			listener: args.listener,
			eventTypes: args.eventTypes,
			itemIds: args.itemIds,
			unsubscribeCurrent: null,
		};
		this.activeSubscriptions.set(args.listener, sub);

		const controller =
			this.activeCohortMapKey === null
				? undefined
				: this.sectionControllers.get(this.activeCohortMapKey);
		if (controller) {
			this.bindSubscriptionToController(sub, controller);
		}

		let detached = false;
		return () => {
			if (detached) return;
			detached = true;
			sub.unsubscribeCurrent?.();
			sub.unsubscribeCurrent = null;
			// Only delete if the registry still points at *this* sub. A
			// re-subscribe with the same listener replaces the entry; an
			// old disposer must not stomp the new one.
			if (this.activeSubscriptions.get(args.listener) === sub) {
				this.activeSubscriptions.delete(args.listener);
			}
		};
	}

	/**
	 * Bind a Phase D subscription to a section controller. Detaches any
	 * prior controller binding the subscription was holding, attaches a
	 * fresh `controller.subscribe(...)` callback, and replays the
	 * canonical late-subscribe sequence (content-loaded × N then
	 * section-loading-complete) so the listener observes the same
	 * ordering a fresh subscriber would have seen.
	 *
	 * Listener throws are caught and `console.warn`-logged; the throw
	 * does not interrupt fan-out to the remaining listeners (matches
	 * the {@link FrameworkErrorBus} isolation pattern).
	 */
	private bindSubscriptionToController(
		sub: ActiveSectionSubscription,
		controller: SectionControllerHandle,
	): void {
		sub.unsubscribeCurrent?.();
		sub.unsubscribeCurrent = null;

		const subscribe = controller.subscribe;
		if (typeof subscribe !== "function") return;

		const predicate = this.buildSectionEventPredicate(sub);

		sub.unsubscribeCurrent = subscribe.call(controller, (event) => {
			if (!predicate(event)) return;
			this.deliverSectionEventSafely(sub.listener, event);
		});

		const contentLoadedReplays =
			this.buildContentLoadedReplayEvents(controller);
		for (const event of contentLoadedReplays) {
			if (predicate(event)) {
				this.deliverSectionEventSafely(sub.listener, event);
			}
		}
		const loadingComplete = this.buildLoadingCompleteReplayEvent(controller);
		if (loadingComplete && predicate(loadingComplete)) {
			this.deliverSectionEventSafely(sub.listener, loadingComplete);
		}
	}

	private deliverSectionEventSafely(
		listener: (event: SectionControllerEvent) => void,
		event: SectionControllerEvent,
	): void {
		try {
			listener(event);
		} catch (error) {
			console.warn(
				"[ToolkitCoordinator] section-event listener failed:",
				error,
			);
		}
	}

	/**
	 * Mark the given map key as the active section cohort. Called from
	 * `getOrCreateSectionController` (both create-new and resolve-existing
	 * paths) so a cohort transition through either path migrates active
	 * subscriptions.
	 *
	 * Same-cohort re-entry is a no-op so a same-cohort `updateInput`
	 * (PnP toggle, prompt edit) doesn't double-replay snapshots to
	 * already-bound listeners.
	 */
	private setActiveCohort(mapKey: string): void {
		if (this.activeCohortMapKey === mapKey) return;
		this.activeCohortMapKey = mapKey;
		const controller = this.sectionControllers.get(mapKey);
		if (!controller) return;
		// Snapshot the subscription list before iterating: a listener may
		// synchronously call `subscribeSectionEvents(...)` from inside its
		// replay delivery, which inserts a new entry into
		// `activeSubscriptions`. Map iteration yields keys inserted
		// during the loop; without snapshotting, the inner subscribe path
		// would bind the new listener once (correctly, with replay) and
		// the outer loop would then visit it a second time, double-
		// replaying the snapshot. Snapshot keeps "replay once per cohort
		// transition" intact.
		for (const sub of Array.from(this.activeSubscriptions.values())) {
			this.bindSubscriptionToController(sub, controller);
		}
	}

	private setActiveCohortIfLatestRequest(mapKey: string): void {
		if (this.latestRequestedActiveCohortMapKey !== mapKey) return;
		this.setActiveCohort(mapKey);
	}

	private suspendActiveCohortIfSuperseded(mapKey: string): void {
		if (this.activeCohortMapKey === null) return;
		if (this.activeCohortMapKey === mapKey) return;
		this.activeCohortMapKey = null;
		for (const sub of Array.from(this.activeSubscriptions.values())) {
			sub.unsubscribeCurrent?.();
			sub.unsubscribeCurrent = null;
		}
	}

	/**
	 * Clear the active cohort if `mapKey` matches it, detaching every
	 * active subscription's current controller binding. Subscriptions
	 * stay in the registry — a subsequent `setActiveCohort(...)` will
	 * re-bind them to the new controller.
	 */
	private clearActiveCohortIfMatches(mapKey: string): void {
		if (this.activeCohortMapKey !== mapKey) return;
		this.activeCohortMapKey = null;
		// Symmetric snapshot for safety: a disposer fired during detach
		// could mutate `activeSubscriptions`. Detach is silent (no listener
		// fan-out), so re-entrancy exposure is lower than `setActiveCohort`,
		// but the snapshot keeps both paths uniform.
		for (const sub of Array.from(this.activeSubscriptions.values())) {
			sub.unsubscribeCurrent?.();
			sub.unsubscribeCurrent = null;
		}
	}

	private buildSectionEventPredicate(
		args: Pick<SectionEventSubscriptionArgs, "eventTypes" | "itemIds">,
	): (event: SectionControllerEvent) => boolean {
		const eventTypeFilter = args.eventTypes ? new Set(args.eventTypes) : null;
		const itemIdFilter = args.itemIds ? new Set(args.itemIds) : null;
		return (event: SectionControllerEvent): boolean => {
			if (eventTypeFilter || itemIdFilter) {
				const eventType = event?.type || null;
				if (
					eventTypeFilter &&
					(!eventType || !eventTypeFilter.has(eventType))
				) {
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
		if (
			"canonicalItemId" in event &&
			typeof event.canonicalItemId === "string"
		) {
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

	/**
	 * Build replay `content-loaded` events for renderables the controller has
	 * already finished loading.
	 *
	 * Strict by design: only renderables explicitly reported in
	 * `runtimeState.loadedRenderables` are replayed. Synthetic test harnesses
	 * that omit the field (or controllers from older revisions that did not
	 * populate it) get an empty replay set rather than a fabricated one — that
	 * preserves the contract that replays mirror events that actually fired.
	 *
	 * Order follows registration order from
	 * `SectionController.collectLoadedRenderableSnapshot`, which mirrors the
	 * order live `content-loaded` events were emitted in.
	 */
	private buildContentLoadedReplayEvents(
		controller: SectionControllerHandle,
	): SectionControllerEvent[] {
		const runtimeState = controller.getRuntimeState?.();
		const loadedRenderables = runtimeState?.loadedRenderables;
		if (!Array.isArray(loadedRenderables) || loadedRenderables.length === 0) {
			return [];
		}
		const currentItemIndex =
			typeof runtimeState?.currentItemIndex === "number" &&
			Number.isFinite(runtimeState.currentItemIndex)
				? runtimeState.currentItemIndex
				: 0;
		const timestamp = Date.now();
		const events: SectionControllerEvent[] = [];
		for (const renderable of loadedRenderables) {
			if (!renderable) continue;
			const itemId = renderable.itemId;
			const canonicalItemId =
				typeof renderable.canonicalItemId === "string" &&
				renderable.canonicalItemId
					? renderable.canonicalItemId
					: itemId;
			if (typeof itemId !== "string" || !itemId) continue;
			events.push({
				type: "content-loaded",
				contentKind: renderable.contentKind ?? "unknown",
				itemId,
				canonicalItemId,
				currentItemIndex,
				timestamp,
			});
		}
		return events;
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

	/**
	 * Subscribe to item-scoped controller events.
	 *
	 * Same active-cohort binding contract as
	 * {@link subscribeSectionEvents}; defaults `eventTypes` to the
	 * item-scoped subset.
	 */
	public subscribeItemEvents(
		args: SectionItemEventSubscriptionArgs,
	): () => void {
		return this.subscribeSectionEvents({
			eventTypes: args.eventTypes || SECTION_ITEM_EVENT_TYPES,
			itemIds: args.itemIds,
			listener: args.listener as (event: SectionControllerEvent) => void,
		});
	}

	/**
	 * Subscribe to section-scoped controller events.
	 *
	 * Same active-cohort binding contract as
	 * {@link subscribeSectionEvents}; defaults `eventTypes` to the
	 * section-scoped subset. Section-scoped events do not carry item
	 * identifiers, so this helper intentionally does not expose
	 * `itemIds` filtering.
	 */
	public subscribeSectionLifecycleEvents(
		args: SectionScopedEventSubscriptionArgs,
	): () => void {
		return this.subscribeSectionEvents({
			eventTypes: args.eventTypes || SECTION_SCOPED_EVENT_TYPES,
			listener: args.listener as (event: SectionControllerEvent) => void,
		});
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
		initialSession?: SectionControllerSessionState | null;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle> {
		if (this.disposePromise !== null) {
			throw new ToolkitCoordinatorDisposedError();
		}
		const key: SectionControllerKey = {
			assessmentId: this.assessmentId,
			sectionId: args.sectionId,
			attemptId: args.attemptId,
		};
		const mapKey = this.getSectionControllerMapKey(key);
		this.latestRequestedActiveCohortMapKey = mapKey;
		this.suspendActiveCohortIfSuperseded(mapKey);
		let existingController: SectionControllerHandle | undefined;
		try {
			existingController = await this.resolveExistingSectionController({
				mapKey,
				key,
				input: args.input,
				updateExisting: args.updateExisting,
			});
			if (existingController) {
				if (this.disposePromise !== null) {
					throw new ToolkitCoordinatorDisposedError();
				}
				if (args.initialSession) {
					await this.assignSessionToPublishedController(
						existingController,
						args.initialSession,
					);
				}
			}
		} catch (err) {
			this.deliverSectionStartError(mapKey, err);
			throw err;
		}
		if (existingController) return existingController;
		const pendingDisposal = this.sectionControllerDisposePromises.get(mapKey);
		if (pendingDisposal) {
			// Persistence and hydration share the cohort's durable state. Keep the
			// retired controller out of the cache immediately, but do not let its
			// replacement hydrate until that exact cohort's save/dispose pipeline has
			// settled. Other cohorts remain independent.
			await Promise.allSettled([pendingDisposal]);
		}
		if (this.disposePromise !== null) {
			throw new ToolkitCoordinatorDisposedError();
		}

		const existingEntry = this.sectionControllerInitEntries.get(mapKey);
		if (existingEntry) {
			if (!args.initialSession) return existingEntry.promise;
			const pendingController = await existingEntry.promise;
			await this.assignSessionToPublishedController(
				pendingController,
				args.initialSession,
			);
			return pendingController;
		}

		const token: SectionControllerInitToken = {
			retired: false,
			candidateClaimed: false,
		};
		const initPromise = this.initializeNewSectionController({
			args,
			key,
			mapKey,
			token,
		})
			.catch((err) => {
				this.handleSectionControllerInitError(err, args);
				this.deliverSectionStartError(mapKey, err);
				throw err;
			})
			.finally(() => {
				if (this.sectionControllerInitEntries.get(mapKey)?.token === token) {
					this.sectionControllerInitEntries.delete(mapKey);
				}
			});

		this.sectionControllerInitEntries.set(mapKey, {
			key,
			token,
			promise: initPromise,
		});
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
		// `updateInput` may yield to a teardown. Never hand a controller back
		// after its exact cache entry has been removed or replaced.
		if (this.sectionControllers.get(args.mapKey) !== existingController) {
			return undefined;
		}
		// PIE-512 Phase D: a `getOrCreateSectionController` call that
		// resolves to a previously-created controller still represents a
		// cohort transition from the toolkit's perspective (same-cohort
		// re-entry is a no-op inside `setActiveCohort`). Active
		// subscriptions migrate here so a host that subscribed once on
		// `toolkit-ready` keeps receiving events after navigating back
		// to a section it visited earlier.
		this.setActiveCohortIfLatestRequest(args.mapKey);
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
			initialSession?: SectionControllerSessionState | null;
			createDefaultController: () =>
				| SectionControllerHandle
				| Promise<SectionControllerHandle>;
		};
		key: SectionControllerKey;
		mapKey: string;
		token: SectionControllerInitToken;
	}): Promise<SectionControllerHandle> {
		const context = this.createSectionControllerContext({
			key: args.key,
			input: args.args.input,
		});
		const persistence = await this.resolveSectionPersistence(context);
		if (this.disposePromise !== null || args.token.retired) {
			if (this.sectionPersistenceStrategies.get(args.mapKey) === persistence) {
				this.sectionPersistenceStrategies.delete(args.mapKey);
			}
			throw this.createSectionControllerRetirementError();
		}
		const defaults: SectionControllerFactoryDefaults = {
			createDefaultController: args.args.createDefaultController,
		};
		const controller =
			(await this.hooks.createSectionController?.(context, defaults)) ??
			(await defaults.createDefaultController());
		const candidate = {
			mapKey: args.mapKey,
			key: args.key,
			controller,
			persistence,
			token: args.token,
		};
		try {
			await this.retireUnpublishedSectionControllerIfNeeded(candidate);
			await controller.configureSessionPersistence?.({
				strategy: persistence,
				context,
			});
			await this.retireUnpublishedSectionControllerIfNeeded(candidate);
			await controller.initialize?.(args.args.input);
			await this.retireUnpublishedSectionControllerIfNeeded(candidate);
			// A session the host supplied takes the place of the strategy's stored
			// snapshot, and is applied before publication so the ready lifecycle
			// event and every reader after it see it. The strategy still receives
			// every `persist()`.
			const initialSession = args.args.initialSession;
			if (initialSession) {
				if (!controller.applySession) {
					throw new Error(
						"Section controller cannot apply the session it was created with: it has no applySession.",
					);
				}
				await controller.applySession(initialSession, { mode: "replace" });
			} else {
				await controller.hydrate?.();
			}
			await this.finalizeSectionControllerReady({
				...candidate,
				context,
			});
			return controller;
		} catch (error) {
			await this.cleanupUnpublishedSectionController(candidate);
			throw error;
		}
	}

	/**
	 * Apply a host-supplied session to a controller that is already published,
	 * under the rules `resolveSectionSessionAssignment` sets: an equal session is a
	 * no-op and recorded responses are not replaced by response-free ones.
	 */
	private async assignSessionToPublishedController(
		controller: SectionControllerHandle,
		session: SectionControllerSessionState | null | undefined,
	): Promise<void> {
		if (!session) return;
		if (!controller.applySession) {
			throw new Error(
				"Section controller cannot apply the assigned session: it has no applySession.",
			);
		}
		const resolved = resolveSectionSessionAssignment(
			controller.getSession?.() ?? null,
			session,
		);
		if (!resolved) return;
		await controller.applySession(resolved, { mode: "replace" });
	}

	private createSectionControllerRetirementError(): Error {
		return this.disposePromise !== null
			? new ToolkitCoordinatorDisposedError()
			: new SectionControllerRetiredError();
	}

	private async retireUnpublishedSectionControllerIfNeeded(
		args: SectionControllerCandidate,
	): Promise<void> {
		if (this.disposePromise === null && !args.token.retired) return;
		await this.cleanupUnpublishedSectionController(args);
		throw this.createSectionControllerRetirementError();
	}

	private async cleanupUnpublishedSectionController(
		args: SectionControllerCandidate,
	): Promise<void> {
		if (args.token.candidateClaimed) return;
		args.token.candidateClaimed = true;
		try {
			await args.controller.dispose?.();
		} catch (error) {
			this.handleError(error, {
				phase: "section-controller-dispose",
				details: {
					sectionId: args.key.sectionId,
					attemptId: args.key.attemptId,
				},
				recoverable: true,
			});
		} finally {
			if (
				this.sectionPersistenceStrategies.get(args.mapKey) === args.persistence
			) {
				this.sectionPersistenceStrategies.delete(args.mapKey);
			}
		}
	}

	private retirePublishedSectionControllerIfNeeded(args: {
		key: SectionControllerKey;
		token: SectionControllerInitToken;
	}): void {
		if (this.disposePromise !== null && !args.token.retired) {
			void this.disposeSectionController({
				sectionId: args.key.sectionId,
				attemptId: args.key.attemptId,
			});
		}
		if (args.token.retired) {
			throw this.createSectionControllerRetirementError();
		}
	}

	private async finalizeSectionControllerReady(
		args: SectionControllerCandidate & {
			context: SectionControllerContext;
		},
	): Promise<void> {
		await this.retireUnpublishedSectionControllerIfNeeded(args);
		this.sectionControllers.set(args.mapKey, args.controller);
		this.sectionControllerKeys.set(args.mapKey, args.key);
		args.token.candidateClaimed = true;
		// PIE-512 Phase D: a freshly-resolved controller becomes the
		// active cohort. Active subscriptions migrate to it before the
		// `ready` lifecycle event and `onSectionControllerReady` hook
		// fire so any synchronous post-ready work observes a coherent
		// active-cohort view.
		this.setActiveCohortIfLatestRequest(args.mapKey);
		this.emitSectionControllerLifecycle({
			type: "ready",
			key: args.key,
			controller: args.controller,
		});
		await this.hooks.onSectionControllerReady?.(args.context, args.controller);
		this.retirePublishedSectionControllerIfNeeded(args);
		await this.emitTelemetry("pie-toolkit-section-controller-ready", {
			assessmentId: args.key.assessmentId,
			sectionId: args.key.sectionId,
			attemptId: args.key.attemptId,
		});
		this.retirePublishedSectionControllerIfNeeded(args);
	}

	private handleSectionControllerInitError(
		err: unknown,
		args: { sectionId: string; attemptId?: string },
	): void {
		if (
			err instanceof ToolkitCoordinatorDisposedError ||
			err instanceof SectionControllerRetiredError
		) {
			return;
		}
		this.handleError(
			err,
			{
				phase: "section-controller-init",
				details: {
					sectionId: args.sectionId,
					attemptId: args.attemptId,
				},
				recoverable: false,
			},
			{ sectionId: args.sectionId, attemptId: args.attemptId },
		);
	}

	/**
	 * A section that fails to start has no controller of its own to emit its
	 * `section-error`, and the host's subscriptions are already off the outgoing
	 * section, so the coordinator delivers the error to them while that section
	 * is still the one requested.
	 */
	private deliverSectionStartError(mapKey: string, error: unknown): void {
		if (
			error instanceof ToolkitCoordinatorDisposedError ||
			error instanceof SectionControllerRetiredError ||
			this.latestRequestedActiveCohortMapKey !== mapKey
		) {
			return;
		}
		const event: SectionControllerEvent = {
			type: "section-error",
			source: "section-runtime",
			error,
			currentItemIndex: 0,
			timestamp: Date.now(),
		};
		for (const sub of Array.from(this.activeSubscriptions.values())) {
			if (this.buildSectionEventPredicate(sub)(event)) {
				this.deliverSectionEventSafely(sub.listener, event);
			}
		}
	}

	public disposeSectionController(args: {
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
		const initEntry = this.sectionControllerInitEntries.get(mapKey);
		if (initEntry) {
			initEntry.token.retired = true;
		}
		const controller = this.sectionControllers.get(mapKey);
		if (!controller) {
			const existingDisposal =
				this.sectionControllerDisposePromises.get(mapKey);
			if (existingDisposal) return existingDisposal;
			if (!initEntry) return Promise.resolve();
			const retirementBarrier = Promise.allSettled([initEntry.promise]).then(
				() => undefined,
			);
			return this.trackSectionControllerDisposal(mapKey, retirementBarrier);
		}
		const persistenceStrategy = this.sectionPersistenceStrategies.get(mapKey);
		// PIE-512 Phase D: if the disposing cohort is the active one,
		// detach all listener-controller bindings before the controller
		// itself disposes. The subscription registry stays intact so a
		// later `getOrCreateSectionController(...)` re-binds the same
		// listeners to the new controller.
		this.clearActiveCohortIfMatches(mapKey);
		// Relinquish this exact controller before the first asynchronous step.
		// A new mount for the same cohort must create a fresh controller rather
		// than reacquire the one whose persistence/disposal is still in flight.
		if (this.sectionControllers.get(mapKey) === controller) {
			this.sectionControllers.delete(mapKey);
			this.sectionControllerKeys.delete(mapKey);
			this.sectionPersistenceStrategies.delete(mapKey);
			// Lifecycle consumers match by cohort key rather than controller identity.
			// Publish retirement now so a replacement can only produce
			// disposed -> ready, never ready -> stale disposed.
			this.emitSectionControllerLifecycle({
				type: "disposed",
				key,
			});
		}

		const context = this.createSectionControllerContext({
			key,
			input: undefined,
		});
		const controllerDisposalPromise = this.disposeSectionControllerEntry({
			args,
			key,
			context,
			controller,
			persistenceStrategy,
		});
		const disposalBarrier = initEntry
			? Promise.allSettled([initEntry.promise]).then(
					() => controllerDisposalPromise,
				)
			: controllerDisposalPromise;
		return this.trackSectionControllerDisposal(mapKey, disposalBarrier);
	}

	private trackSectionControllerDisposal(
		mapKey: string,
		disposePromise: Promise<void>,
	): Promise<void> {
		this.sectionControllerDisposePromises.set(mapKey, disposePromise);
		const forgetDisposePromise = () => {
			if (
				this.sectionControllerDisposePromises.get(mapKey) === disposePromise
			) {
				this.sectionControllerDisposePromises.delete(mapKey);
			}
		};
		void disposePromise.then(forgetDisposePromise, forgetDisposePromise);
		return disposePromise;
	}

	private async disposeSectionControllerEntry(args: {
		args: {
			sectionId: string;
			attemptId?: string;
			persistBeforeDispose?: boolean;
			clearPersistence?: boolean;
		};
		key: SectionControllerKey;
		context: SectionControllerContext;
		controller: SectionControllerHandle;
		persistenceStrategy?: SectionSessionPersistenceStrategy;
	}): Promise<void> {
		try {
			await this.runSectionControllerDisposePipeline({
				key: args.key,
				context: args.context,
				controller: args.controller,
				persistBeforeDispose: args.args.persistBeforeDispose,
			});
		} catch (err) {
			this.handleError(err, {
				phase: "section-controller-dispose",
				details: {
					sectionId: args.args.sectionId,
					attemptId: args.args.attemptId,
				},
				recoverable: true,
			});
		} finally {
			await this.finalizeSectionControllerDispose({
				context: args.context,
				persistenceStrategy: args.persistenceStrategy,
				clearPersistence: args.args.clearPersistence,
			});
		}
	}

	private async runSectionControllerDisposePipeline(args: {
		key: SectionControllerKey;
		context: SectionControllerContext;
		controller: SectionControllerHandle;
		persistBeforeDispose?: boolean;
	}): Promise<void> {
		const failures: unknown[] = [];
		if (args.persistBeforeDispose !== false) {
			try {
				await args.controller.persist?.();
			} catch (error) {
				failures.push(error);
			}
		}
		try {
			await args.controller.dispose?.();
		} catch (error) {
			failures.push(error);
		}
		if (failures.length === 1) throw failures[0];
		if (failures.length > 1) {
			throw new AggregateError(
				failures,
				"Section controller persistence and disposal both failed.",
			);
		}
		await this.hooks.onSectionControllerDispose?.(
			args.context,
			args.controller,
		);
		await this.emitTelemetry("pie-toolkit-section-controller-disposed", {
			assessmentId: args.key.assessmentId,
			sectionId: args.key.sectionId,
			attemptId: args.key.attemptId,
		});
	}

	private async finalizeSectionControllerDispose(args: {
		context: SectionControllerContext;
		persistenceStrategy?: SectionSessionPersistenceStrategy;
		clearPersistence?: boolean;
	}): Promise<void> {
		if (args.clearPersistence) {
			await args.persistenceStrategy?.clearSession?.(args.context);
		}
	}

	/**
	 * Release every resource whose lifetime is owned by this coordinator.
	 * Borrowed constructor inputs, including a host framework-error bus and tool
	 * registry, remain owned by their caller.
	 */
	public dispose(): Promise<void> {
		if (this.disposePromise) return this.disposePromise;
		// Defer cleanup until after this promise is assigned. The promise itself is
		// the single lifetime flag observed by every admission guard.
		this.disposePromise = Promise.resolve().then(() =>
			this.disposeOwnedResources(),
		);
		return this.disposePromise;
	}

	private async disposeOwnedResources(): Promise<void> {
		const errors: unknown[] = [];
		const cleanup = async (action: () => void | Promise<void>) => {
			try {
				await action();
			} catch (error) {
				errors.push(error);
			}
		};

		// Work admitted before `dispose()` may still be inside a host hook or a
		// provider/service initializer. Let it observe the disposal promise and
		// settle before destroying the owned registries and services it is using.
		await this.waitForAdmittedInitialization();

		// Retire every admitted section initialization before waiting. A section
		// with no cached controller still gets a per-key barrier; a controller that
		// reached `ready` while its init hook was pending is removed and disposed by
		// the same path as any other cached controller.
		const sectionKeys = new Map<string, SectionControllerKey>();
		for (const [mapKey, entry] of this.sectionControllerInitEntries) {
			sectionKeys.set(mapKey, entry.key);
		}
		for (const [mapKey, key] of this.sectionControllerKeys) {
			sectionKeys.set(mapKey, key);
		}
		for (const key of sectionKeys.values()) {
			void this.disposeSectionController({
				sectionId: key.sectionId,
				attemptId: key.attemptId,
			});
		}
		await Promise.allSettled(
			Array.from(this.sectionControllerDisposePromises.values()),
		);
		this.sectionControllers.clear();
		this.sectionControllerKeys.clear();
		this.sectionControllerInitEntries.clear();
		this.sectionPersistenceStrategies.clear();

		for (const subscription of this.activeSubscriptions.values()) {
			await cleanup(() => subscription.unsubscribeCurrent?.());
			subscription.unsubscribeCurrent = null;
		}
		this.activeSubscriptions.clear();
		this.activeCohortMapKey = null;
		this.latestRequestedActiveCohortMapKey = null;

		await cleanup(() => this.ttsService.dispose());
		await cleanup(() => this.toolProviderRegistry.destroy());
		await cleanup(() => this.highlightCoordinator.destroy());
		await cleanup(() => this.ownedToolCoordinator.destroy());
		await cleanup(() => this.catalogResolver.destroy());
		await cleanup(() => this.toolRequests.dispose());
		await cleanup(() => this.policyEngine.dispose());

		this.toolContextResolvers.clear();
		this.toolContextResolverChangeListeners.clear();
		this.policyDiagnosticListeners.clear();
		this.sectionControllerLifecycleListeners.clear();
		this.telemetryListeners.clear();
		this.frameworkErrorHookUnsubscribe?.();
		this.frameworkErrorHookUnsubscribe = null;
		if (this.ownsFrameworkErrorBus) {
			this.frameworkErrorBus.dispose();
		}

		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) {
			throw new AggregateError(
				errors,
				"ToolkitCoordinator cleanup failed for multiple owned resources.",
			);
		}
	}

	private async waitForAdmittedInitialization(): Promise<void> {
		const pending = new Set<Promise<unknown>>();
		if (this.coordinatorReadyPromise) {
			pending.add(this.coordinatorReadyPromise);
		}
		if (this.ttsInitPromise) pending.add(this.ttsInitPromise);
		if (this.ttsReconfigurePromise) {
			pending.add(this.ttsReconfigurePromise);
		}
		for (const promise of this.providerInitPromises.values()) {
			pending.add(promise);
		}
		await Promise.allSettled(pending);
	}

	/**
	 * Initialize the TTS service from the `textToSpeech` tool config.
	 */
	public async ensureTTSReady(): Promise<void> {
		this.assertNotDisposed();
		await this.waitForPendingTTSReconfigure();
		this.assertNotDisposed();
		if (this.ttsInitialized) return;
		if (this.ttsInitPromise) return this.ttsInitPromise;
		this.ttsInitPromise = this._initializeTTS()
			.then(() => this.assertNotDisposed())
			.finally(() => {
				this.ttsInitPromise = undefined;
				this.notifyReadyChange();
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

	private async _initializeTTS(): Promise<void> {
		if (this.ttsInitialized) return;
		const resolvedToolConfig = this.resolveTTSToolConfig();
		const runtimeSettings = resolveTTSRuntimeSettings(resolvedToolConfig);
		const resolvedBackend = resolveTTSBackend(runtimeSettings);
		const runtimeTTSConfig = buildRuntimeTTSConfig(runtimeSettings);
		await this.hooks.onBeforeTTSInit?.({
			phase: "tts-init",
			details: {
				backend: resolvedBackend,
			},
		});
		this.assertNotDisposed();
		await this.emitTelemetry("pie-toolkit-tts-init-start", {
			backend: resolvedBackend,
		});
		await this.emitTelemetry("pie-tool-init-start", {
			toolId: "textToSpeech",
			operation: "tts-init",
			backend: resolvedBackend,
		});

		// Try to use TTS provider from registry if available
		if (this.toolProviderRegistry.has("textToSpeech")) {
			try {
				// Browser speech follows a server provider that fails to start.
				const ttsProvider = await this.initializeProvider("textToSpeech", true);
				const providerInstance = await ttsProvider.createInstance();
				await this.initializeTTSService(providerInstance, runtimeTTSConfig);
				await this.emitTelemetry("pie-toolkit-tts-init-success", {
					provider: "registry",
				});
				await this.emitTelemetry("pie-tool-init-success", {
					toolId: "textToSpeech",
					operation: "tts-init",
					backend: resolvedBackend,
					provider: "registry",
				});
				return;
			} catch (error) {
				if (error instanceof ToolkitCoordinatorDisposedError) throw error;
				const normalized =
					error instanceof Error ? error : new Error(String(error));
				await this.emitTelemetry("pie-tool-init-fallback", {
					toolId: "textToSpeech",
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
		} else if (resolvedBackend !== "browser") {
			this.reportMissingTTSProvider(resolvedBackend);
		}

		// Browser speech, configured or standing in for a backend that has no
		// provider or failed to start.
		const provider = new BrowserTTSProvider();
		try {
			await this.initializeTTSService(
				provider,
				resolvedBackend === "browser"
					? runtimeTTSConfig
					: browserFallbackConfig(runtimeTTSConfig),
			);
			await this.emitTelemetry("pie-toolkit-tts-init-success", {
				provider: "browser-fallback",
			});
			await this.emitTelemetry("pie-tool-init-success", {
				toolId: "textToSpeech",
				operation: "tts-init",
				backend: resolvedBackend,
				provider: "browser-fallback",
			});
		} catch (error) {
			if (error instanceof ToolkitCoordinatorDisposedError) throw error;
			const normalized =
				error instanceof Error ? error : new Error(String(error));
			this.reportStartFailure(normalized, { phase: "tts-init" }, ["textToSpeech"]);
			await this.emitTelemetry("pie-toolkit-tts-init-error", {
				message: normalized.message,
			});
			await this.emitTelemetry("pie-tool-init-error", {
				toolId: "textToSpeech",
				operation: "tts-init",
				backend: resolvedBackend,
				errorType: "TTSInitError",
				message: normalized.message,
			});
			throw normalized;
		}
	}

	private resolveTTSToolConfig(): TextToSpeechToolProviderConfig {
		return this.getTTSConfigFromProviders() || {};
	}

	private async initializeTTSService(
		provider: ITTSProvider,
		config: Partial<ToolkitTTSConfig>,
	): Promise<void> {
		const nextProviderOptions = {
			...config.providerOptions,
			__pieTelemetry: async (
				eventName: string,
				payload?: Record<string, unknown>,
			) => {
				await this.emitTelemetry(eventName, {
					toolId: "textToSpeech",
					...(payload || {}),
				});
			},
		};
		const nextConfig: Partial<ToolkitTTSConfig> = {
			...config,
			providerOptions: nextProviderOptions,
		};
		await this.ttsService.initialize(provider, nextConfig);
		this.assertNotDisposed();
		this.ttsService.setCatalogResolver(this.catalogResolver);
		this.ttsInitialized = true;
		this.ttsDegraded = false;
		this.degradedTools.delete("textToSpeech");
		await this.hooks.onTTSReady?.();
		this.assertNotDisposed();
	}

	async waitUntilReady(): Promise<void> {
		this.assertNotDisposed();
		if (this.isReady()) return;
		if (this.coordinatorReadyPromise) return this.coordinatorReadyPromise;
		this.coordinatorReadyPromise = (async () => {
			await this.ensureStateLoaded();
			this.assertNotDisposed();
			if (this.ttsRequiredForReadiness()) {
				await this.startTTSForReadiness();
			}
			this.assertNotDisposed();
			if (!this.coordinatorReadyNotified) {
				this.coordinatorReadyNotified = true;
				await this.hooks.onCoordinatorReady?.(this);
				this.assertNotDisposed();
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
		return (
			(this.stateLoadSettled || !this.hooks.loadToolState) &&
			(this.ttsInitialized ||
				this.ttsDegraded ||
				!this.ttsRequiredForReadiness())
		);
	}

	/**
	 * Readiness waits for text-to-speech when it is enabled and either starts
	 * eagerly or is granted: a granted read-aloud fails before the learner starts.
	 */
	private ttsRequiredForReadiness(): boolean {
		if (this.getTTSConfigFromProviders()?.enabled === false) return false;
		return !this.lazyInit || this.isToolGranted("textToSpeech");
	}

	/**
	 * Starts text-to-speech for readiness. A failure policy does not grant leaves
	 * the tool degraded, reporting itself unavailable, and readiness settles; a
	 * granted tool's failure rejects.
	 */
	private async startTTSForReadiness(): Promise<void> {
		try {
			await this.ensureTTSReady();
		} catch (error) {
			if (error instanceof ToolkitCoordinatorDisposedError) throw error;
			if (this.isToolGranted("textToSpeech")) throw error;
			this.ttsDegraded = true;
			this.notifyReadyChange();
		}
	}

	private getTTSConfigFromProviders():
		| TextToSpeechToolProviderConfig
		| undefined {
		return this.config.tools?.providers?.textToSpeech;
	}

	private assertCanonicalToolId(toolId: string): void {
		if (typeof toolId !== "string" || toolId.trim().length === 0) {
			throw new Error("Tool id must be a non-empty string.");
		}
		// An empty registry means the host supplied none, not that every id is
		// wrong. There is nothing to check an id against, and throwing turns a
		// host's every tool-config call into an exception — including the calls
		// this coordinator's own default-provider block provokes, which is how a
		// host that passes no registry ended up unable to read its own config.
		// Validation reports the missing registry once per coordinator, as
		// `tools.registryUnavailable`; a report per call would be noise.
		if (this.toolRegistry.getAllToolIds().length === 0) return;
		if (!this.toolRegistry.get(toolId)) {
			throw new Error(`Unknown tool id "${toolId}".`);
		}
	}

	private installToolContextResolvers(
		resolvers: ToolContextResolverMap | undefined,
	): void {
		if (!resolvers) return;
		for (const [toolId, resolver] of Object.entries(resolvers)) {
			if (resolver == null) continue;
			this.assertCanonicalToolId(toolId);
			if (typeof resolver !== "function") {
				throw new Error(
					`Invalid tool context resolver for "${toolId}": expected a function.`,
				);
			}
			this.toolContextResolvers.set(toolId, resolver);
		}
	}

	/**
	 * Replace all host-owned render-context resolvers. The toolkit element
	 * calls this from `runtime.toolContextResolvers`; it is not on
	 * `ToolkitCoordinatorApi`.
	 */
	setToolContextResolvers(
		resolvers: ToolContextResolverMap | null | undefined,
	): void {
		this.toolContextResolvers.clear();
		this.installToolContextResolvers(resolvers ?? undefined);
		this.notifyToolContextResolverChange();
	}

	private notifyToolContextResolverChange(): void {
		for (const listener of this.toolContextResolverChangeListeners) {
			try {
				listener();
			} catch (error) {
				console.warn(
					"[ToolkitCoordinator] Tool context resolver listener threw:",
					error,
				);
			}
		}
	}

	/**
	 * Get tool configuration.
	 *
	 * @param toolId Tool identifier
	 * @returns Tool configuration or null if not configured
	 */
	getToolConfig(toolId: "textToSpeech"): TextToSpeechToolProviderConfig | null;
	getToolConfig(toolId: string): ToolProviderConfig | null;
	getToolConfig(
		toolId: string,
	): ToolProviderConfig | TextToSpeechToolProviderConfig | null {
		this.assertCanonicalToolId(toolId);
		return this.config.tools?.providers?.[toolId] || null;
	}

	/**
	 * Update tool configuration.
	 * Applies changes to underlying services.
	 *
	 * @param toolId Tool identifier
	 * @param updates Partial configuration updates
	 */
	updateToolConfig(
		toolId: "textToSpeech",
		updates: Partial<TextToSpeechToolProviderConfig>,
	): void;
	updateToolConfig(toolId: string, updates: Partial<ToolProviderConfig>): void;
	updateToolConfig(
		toolId: string,
		updates:
			| Partial<ToolProviderConfig>
			| Partial<TextToSpeechToolProviderConfig>,
	): void {
		// Update config
		this.assertCanonicalToolId(toolId);
		const current = this.getToolConfig(toolId) || {};
		if (!this.config.tools) {
			this.config.tools = this.validateToolsConfig(undefined, {
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateToolConfig",
				toolRegistry: this.toolRegistry,
			});
		}
		if (!(this.config.tools as any).providers) {
			(this.config.tools as any).providers = {};
		}
		const nextProviders = {
			...((this.config.tools as any).providers || {}),
			[toolId]: mergeToolConfigUpdate(toolId, current, updates),
		};
		this.config.tools = this.validateToolsConfig(
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
		// The engine's tools input follows the validated config; its `inputs`
		// change event is what makes toolbars re-decide.
		this.policyEngine.updateInputs({
			tools: this.config.tools as CanonicalToolsConfig,
		});
		void this.emitTelemetry("pie-toolkit-tool-config-updated", { toolId });

		// Apply configuration changes to services
		this._applyToolConfigChange(toolId);
	}

	/**
	 * Patch one or more placement levels in the canonical tools config.
	 *
	 * This is the generic placement companion to {@link updateToolConfig}:
	 * it validates the next canonical tools config, keeps the policy
	 * engine in lockstep, and emits the same policy-change event used by
	 * live toolbars/debug panels.
	 */
	updateToolsPlacement(partial: ToolPlacementConfig): void {
		if (!this.config.tools) {
			this.config.tools = this.validateToolsConfig(undefined, {
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateToolsPlacement",
				toolRegistry: this.toolRegistry,
			});
		}
		const currentPlacement = this.config.tools?.placement ?? {
			section: [],
			item: [],
			passage: [],
		};
		const nextPlacement: Required<ToolPlacementConfig> = {
			section: [...(partial.section ?? currentPlacement.section ?? [])],
			item: [...(partial.item ?? currentPlacement.item ?? [])],
			passage: [...(partial.passage ?? currentPlacement.passage ?? [])],
		};
		const validated = this.validateToolsConfig(
			{
				...(this.config.tools as CanonicalToolsConfig),
				placement: nextPlacement,
			},
			{
				strictness: this.config.toolConfigStrictness ?? "error",
				source: "ToolkitCoordinator.updateToolsPlacement",
				toolRegistry: this.toolRegistry,
			},
		);
		validated.placement = nextPlacement;
		this.config.tools = validated;
		this.policyEngine.updateInputs({
			tools: this.config.tools as CanonicalToolsConfig,
		});
	}

	/**
	 * Resolve the visible tool set for a given placement level + scope.
	 *
	 * Delegates to the owned tool-policy engine and logs the decision's
	 * diagnostics through {@link warnPolicyDiagnostics}.
	 */
	decideToolPolicy(request: ToolPolicyDecisionRequest): ToolPolicyDecision {
		const decision = this.policyEngine.decide(request);
		this.warnPolicyDiagnostics(decision.diagnostics);
		return decision;
	}

	/**
	 * Report each policy diagnostic as a console warning and to the
	 * {@link onPolicyDiagnostic} listeners, once per code and tool id, and per
	 * item for `tool-policy.itemSettingNotApplied`. Every toolbar and feature
	 * asks for decisions, so a conflict would otherwise repeat on each; the
	 * engine's input diagnostics arrive with each policy change.
	 */
	private warnPolicyDiagnostics(
		diagnostics: readonly ToolPolicyDiagnostic[],
	): void {
		for (const diagnostic of diagnostics) {
			const itemId =
				diagnostic.code === "tool-policy.itemSettingNotApplied"
					? diagnostic.details.itemId
					: "";
			const key = `${diagnostic.code}\0${diagnostic.toolId}\0${itemId}`;
			if (this.reportedPolicyDiagnostics.has(key)) continue;
			this.reportedPolicyDiagnostics.set(key, diagnostic);
			console.warn(`[ToolkitCoordinator] ${diagnostic.message}`);
			for (const listener of Array.from(this.policyDiagnosticListeners)) {
				this.notifyPolicyDiagnosticListener(listener, diagnostic);
			}
		}
	}

	private notifyPolicyDiagnosticListener(
		listener: (diagnostic: ToolPolicyDiagnostic) => void,
		diagnostic: ToolPolicyDiagnostic,
	): void {
		try {
			listener(diagnostic);
		} catch (error) {
			console.error(
				"[ToolkitCoordinator] Policy diagnostic listener failed:",
				error,
			);
		}
	}

	/**
	 * File a mounted item's policy settings (`requiredTools`, `restrictedTools`,
	 * `toolParameters`) under its canonical id. They govern the decisions scoped
	 * to that item: its own item-level toolbar, and the feature decisions its
	 * content asks with the item's scope. `pie-item-scope` registers them from
	 * its `settings` property; the returned function withdraws them.
	 */
	registerItemSettings(itemId: string, settings: ItemSettings): () => void {
		return this.policyEngine.registerItemSettings(itemId, settings);
	}

	/**
	 * Resolve eligibility for one PNP/AfA feature id, independent of toolbar
	 * placement.
	 *
	 * Thin shim over the owned tool-policy engine; see
	 * {@link ToolPolicyEngine.decideFeature} for the contract, including why
	 * `pnpEnforcement` is not consulted.
	 *
	 * Reports once per coordinator when it is asked about a feature with no
	 * assessment bound. A host in that state gets a denial for every capability
	 * no item requires, which is indistinguishable from a student who was
	 * properly declined — so without this, forgetting {@link updateAssessment}
	 * presents as an accommodation that silently never appears.
	 *
	 * A coordinator built with `assessmentOptional` reports only while PNP
	 * enforcement is explicitly `"on"`. Its toolkit binds whatever assessment the
	 * host gave, usually none, and a host that passes no profile and leaves
	 * enforcement unset or `"off"` has asked for no accommodation.
	 *
	 * `scope` is the surface asking; an item's scope brings in that item's
	 * registered settings ({@link registerItemSettings}).
	 */
	decideFeaturePolicy<K extends string>(
		featureId: K,
		scope?: ToolScope,
	): FeaturePolicyDecision<ToolParametersFor<K>> {
		const decision = this.policyEngine.decideFeature(featureId, scope);
		this.warnPolicyDiagnostics(decision.diagnostics);
		if (
			!decision.assessmentBound &&
			this.policyEngine.getInputs().assessmentExpected &&
			!this.reportedUnboundFeaturePolicy
		) {
			this.reportedUnboundFeaturePolicy = true;
			console.warn(
				`[ToolkitCoordinator] Feature policy was asked about "${featureId}" with no assessment bound, so profile, district and test-administration policy have nothing to read and only an item's requiredTools can grant. Pass the assessment to the toolkit's assessment property, or call updateAssessment(...), before relying on any accommodation. Reported once per coordinator.`,
			);
		}
		return decision;
	}

	/**
	 * Subscribe to policy-engine change events. Fires whenever the
	 * coordinator's bound inputs change (`updateToolConfig`,
	 * `updateToolsPlacement`, `updateAssessment`, `setPnpEnforcement`), an
	 * item's settings are registered or withdrawn ({@link registerItemSettings}),
	 * or a custom `PolicySource` is registered / removed via
	 * {@link registerPolicySource}.
	 *
	 * The listener receives a `ToolPolicyChangeEvent` with the event
	 * `reason` and a frozen snapshot of the engine inputs. Listeners
	 * that want the new visible tool set should call
	 * {@link decideToolPolicy} with their level / scope.
	 *
	 * The owned engine emits `reason: "disposed"` during coordinator teardown.
	 * Callers should still detach through the returned unsubscribe function when
	 * their own lifetime ends before the coordinator's.
	 */
	onPolicyChange(listener: ToolPolicyChangeListener): () => void {
		return this.policyEngine.onPolicyChange(listener);
	}

	onPolicyDiagnostic(
		listener: (diagnostic: ToolPolicyDiagnostic) => void,
	): () => void {
		this.policyDiagnosticListeners.add(listener);
		for (const diagnostic of Array.from(this.reportedPolicyDiagnostics.values())) {
			this.notifyPolicyDiagnosticListener(listener, diagnostic);
		}
		return () => {
			this.policyDiagnosticListeners.delete(listener);
		};
	}

	/**
	 * Subscribe to accessibility-catalog registrations and removals.
	 *
	 * Delegates to the owned resolver, the same way {@link onPolicyChange}
	 * delegates to the owned policy engine, so a consumer holding only the
	 * coordinator can react to both of the mutable inputs a catalog-backed
	 * capability depends on without reaching for the services directly.
	 *
	 * @returns Unsubscribe function
	 */
	onCatalogsChange(listener: CatalogChangeListener): () => void {
		return this.catalogResolver.onCatalogsChange(listener);
	}

	/**
	 * Bind (or clear) the active assessment for PNP/profile policy decisions.
	 *
	 * Under auto-mode (no host override via {@link setPnpEnforcement}), a
	 * decision enforces PNP/profile policy iff the assessment carries profile
	 * precedence material (`personalNeedsProfile`, `settings.districtPolicy`,
	 * `settings.testAdministration`), or the decision is scoped to an item whose
	 * settings carry item-level policy inputs. A bare assessment record (just
	 * `id` / `name`, no PNP, no settings) keeps `"off"`.
	 *
	 * The host override set via {@link setPnpEnforcement} is sticky
	 * across assessment swaps.
	 */
	updateAssessment(assessment: AssessmentEntity | null): void {
		this.policyEngine.updateInputs({ assessment });
	}

	/**
	 * Override the auto-mode PNP/profile enforcement decision; `null` returns
	 * to auto-mode. `"on"` and `"off"` stick across assessment swaps until
	 * cleared.
	 */
	setPnpEnforcement(mode: PnpEnforcementMode | null): void {
		this.policyEngine.updateInputs({ pnpEnforcement: mode });
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
	 * compose with the built-in PNP policy source).
	 */
	registerPolicySource(source: PolicySource): () => void {
		return this.policyEngine.registerPolicySource(source);
	}

	hasToolContextResolver(toolId: string): boolean {
		this.assertCanonicalToolId(toolId);
		return this.toolContextResolvers.has(toolId);
	}

	resolveToolContext(
		context: ToolContextResolverContext,
	): ResolvedToolContext | null {
		this.assertCanonicalToolId(context.toolId);
		const resolver = this.toolContextResolvers.get(context.toolId);
		if (!resolver) return null;

		let result: ReturnType<ToolContextResolver>;
		try {
			result = resolver(context);
		} catch (error) {
			console.error(
				`[ToolkitCoordinator] Tool context resolver for "${context.toolId}" threw:`,
				error,
			);
			return {
				toolId: context.toolId,
				visible: false,
				params: {},
				reason: "Tool context resolver threw.",
			};
		}
		if (!result) {
			return {
				toolId: context.toolId,
				visible: true,
				params: {},
			};
		}

		const params =
			result.params &&
			typeof result.params === "object" &&
			!Array.isArray(result.params)
				? result.params
				: {};
		return {
			toolId: context.toolId,
			visible: result.visible !== false,
			params,
			reason: typeof result.reason === "string" ? result.reason : undefined,
		};
	}

	onToolContextResolverChange(listener: () => void): () => void {
		this.toolContextResolverChangeListeners.add(listener);
		return () => {
			this.toolContextResolverChangeListeners.delete(listener);
		};
	}

	getToolRegistry(): ToolRegistry {
		return this.toolRegistry;
	}

	/**
	 * Claim requests for one placement level. Called by a toolbar on mount.
	 */
	registerToolRequestTarget(target: ToolRequestTarget): () => void {
		return this.toolRequests.registerTarget(target);
	}

	/**
	 * Ask the toolbar hosting a tool to open it, handing it `params`.
	 *
	 * Returns whether a toolbar claimed the request. A surface offering this as an
	 * affordance should gate on {@link canRequestTool} first rather than acting on
	 * the return value, so the learner never sees a control that does nothing.
	 */
	requestTool(request: ToolOpenRequest): boolean {
		this.assertCanonicalToolId(request.toolId);
		return this.toolRequests.request(request);
	}

	/**
	 * Answers `false` for a tool this deployment does not carry rather than
	 * throwing as {@link requestTool} does. A composer asks this while rendering a
	 * surface, and a host that swapped the registry for one without the tool would
	 * otherwise lose the whole surface to an exception over an absent action.
	 */
	canRequestTool(
		toolId: string,
		level?: ToolOpenRequest["level"],
		scopeId?: string,
	): boolean {
		try {
			this.assertCanonicalToolId(toolId);
		} catch {
			return false;
		}
		return this.toolRequests.canRequest(toolId, level, scopeId);
	}

	onToolRequestTargetsChange(listener: () => void): () => void {
		return this.toolRequests.onTargetsChange(listener);
	}

	private resolveConfiguredPnpEnforcement(): PnpEnforcementMode | null {
		const tools = this.config.tools as CanonicalToolsConfig | undefined;
		return tools?.pnpEnforcement ?? null;
	}

	/**
	 * Apply tool configuration changes to underlying services.
	 * Called after updateToolConfig().
	 */
	private _applyToolConfigChange(toolId: string): void {
		if (this.disposePromise !== null) return;
		if (toolId === "textToSpeech") {
			this.scheduleTTSReconfigure();
			return;
		}
		this._registerChangedToolProvider(toolId);
	}

	/**
	 * Register the provider a tool's updated config builds, replacing the one
	 * registered under the tool's id. Registration completes before this returns,
	 * so a check on the policy change the update dispatched finds the new provider.
	 */
	private _registerChangedToolProvider(toolId: string): void {
		const registration = this.getProviderDescriptorTools().find(
			(tool) => tool.toolId === toolId,
		);
		if (!registration) return;
		// A failure of the replaced provider no longer describes the tool.
		this.degradedTools.delete(toolId);
		void this.registerProviderFromTool(registration, true);
	}

	/**
	 * Re-register the text-to-speech provider for the current config and registry, then
	 * re-initialize unless initialization is lazy. An initialization already
	 * running finishes first: it would otherwise mark its provider ready after
	 * the reset.
	 */
	private scheduleTTSReconfigure(): void {
		const inFlight = this.ttsInitPromise;
		const reconfigurePromise = inFlight
			? inFlight.catch(() => {}).then(() => this._reconfigureTTSProvider())
			: this._reconfigureTTSProvider();
		this.ttsReconfigurePromise = reconfigurePromise;
		void reconfigurePromise.finally(() => {
			if (this.ttsReconfigurePromise === reconfigurePromise) {
				this.ttsReconfigurePromise = undefined;
			}
		});
		void reconfigurePromise
			.then(async () => {
				if (this.disposePromise !== null) return;
				if (this.ttsRequiredForReadiness()) await this.startTTSForReadiness();
			})
			// Reported where it failed; a granted failure has nowhere else to go.
			.catch(() => {});
	}

	private async _reconfigureTTSProvider(): Promise<void> {
		this.ttsInitialized = false;
		this.ttsDegraded = false;
		this.degradedTools.delete("textToSpeech");
		this.ttsInitPromise = undefined;
		this.notifyReadyChange();
		try {
			// The next speak waits on readiness, which starts the new provider.
			this.ttsService.releaseProvider();
		} catch {
			// noop: release best effort
		}

		if (this.toolProviderRegistry.has("textToSpeech")) {
			await this.toolProviderRegistry.unregister("textToSpeech");
		}
		if (this.disposePromise !== null) return;
		const ttsRegistration = this.getProviderDescriptorTools().find(
			(tool) => tool.toolId === "textToSpeech",
		);
		if (!ttsRegistration) return;
		await this.registerProviderFromTool(ttsRegistration);
	}
}
