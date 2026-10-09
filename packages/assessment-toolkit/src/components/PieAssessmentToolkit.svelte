<svelte:options
	customElement={{
		tag: "pie-assessment-toolkit",
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			section: { attribute: "section", type: "Object" },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			env: { attribute: "env", type: "Object" },
			// Presentation flag surfaced onto the runtime context. Consumers
			// render the vendored <nds-icon-button> only when this is
			// explicitly `true`; otherwise they use plain <button>s. Defaults
			// to `false` (opt-in).
			ndsIcons: { attribute: "nds-icons", type: "Boolean" },
			// Interface locale, published onto the runtime context so every tool
			// resolves the same provider. `type: "String"` because hosts pass
			// attribute values as strings and a BCP-47 tag is one; POSIX
			// (`nl_NL`) and bare (`nl`) forms both resolve.
			locale: { attribute: "locale", type: "String" },
			// Content language, published onto the runtime context for read-aloud
			// and catalog lookups. Markup `lang` inside a shell wins over it.
			contentLanguage: { attribute: "content-language", type: "String" },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			toolConfigStrictness: { attribute: "tool-config-strictness", type: "String" },
			tools: { attribute: "tools", type: "Object" },
			toolContextResolvers: { type: "Object", reflect: false },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			player: { attribute: "player", type: "Object" },
			playerType: { attribute: "player-type", type: "String" },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			onFrameworkError: { type: "Object", reflect: false },
			errorRenderer: { type: "Object", reflect: false },
			// Tool policy inputs, forwarded to the coordinator this toolkit
			// owns: the assessment whose profile and settings policy reads, and
			// the enforcement override.
			assessment: { type: "Object", reflect: false },
			pnpEnforcement: {
				attribute: "pnp-enforcement",
				type: "String",
			},
			// `"inherit"` (the default) or `"force"`, as an attribute or a property;
			// section-player layouts set the property from `runtime.isolation`.
			// `type: "String"` because an observed attribute of type `Object` is
			// JSON-parsed, and `isolation="force"` would throw.
			isolation: { attribute: "isolation", type: "String", reflect: false },
			// JS-only prop. Section-player layouts forward their `session`
			// through this property. The controller created for `section`
			// applies it in place of hydrating from the persistence strategy;
			// a later value is applied to the live controller unless it equals
			// the current session.
			session: { type: "Object", reflect: false },
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script lang="ts">
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import { untrack } from "svelte";
	import { ContextProvider, requestContext } from "@pie-players/pie-context";
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		TOOLKIT_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import {
		commitPendingSessions,
		createPieLogger,
		isGlobalDebugEnabled,
		isInstrumentationProvider,
	} from "@pie-players/pie-players-shared";
	import {
		createPieI18n,
		DEFAULT_LOCALE,
	} from "@pie-players/pie-players-shared/i18n";
	import {
		assessmentToolkitHostRuntimeContext,
		assessmentToolkitRuntimeContext,
		type AssessmentToolkitHostRuntimeContext,
		type AssessmentToolkitRuntimeContext,
		type ItemPlayerConfig,
		type ItemPlayerType,
	} from "../context/assessment-toolkit-context.js";
	import { connectAssessmentToolkitHostRuntimeContext } from "../context/runtime-context-consumer.js";
	import { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
	import { resolveSectionSessionAssignment } from "../services/section-session-assignment.js";
	import {
		bindTtsAudioHandoff,
		pauseTtsForMediaAudio,
	} from "../services/audio-handoff.js";
	import type { PnpEnforcementMode } from "../policy/engine.js";
	import type {
		AssessmentEntity,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import {
		timedMediaProjectionSignature,
		type TimedMediaSectionProjection,
	} from "@pie-players/pie-players-shared/timed-media";
	import {
		formatFrameworkErrorForConsole,
		frameworkErrorFromUnknown,
		toFrameworkErrorModel,
		type FrameworkErrorModel,
	} from "../services/framework-error.js";
	import { FrameworkErrorBus } from "../services/framework-error-bus.js";
	import type { ToolRegistry } from "../services/ToolRegistry.js";
	import {
		normalizeAndValidateToolsConfig,
		type ToolConfigStrictness,
	} from "../services/tool-config-validation.js";
	import { parseToolList } from "../services/tools-config-normalizer.js";
	import {
		PIE_INTERNAL_CONTENT_LOADED_EVENT,
		PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
		PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
		PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
		PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type InternalContentLoadedDetail,
		type InternalFormativeActionDetail,
		type InternalItemSessionChangedDetail,
		type InternalItemPlayerErrorDetail,
		type InternalMediaTimeSourceDetail,
		type RuntimeRegistrationDetail,
	} from "../runtime/registration-events.js";
	import { dispatchCrossBoundaryEvent } from "../runtime/tool-host-contract.js";
	import { isRuntimeEventClaimed } from "../runtime/runtime-event-claim.js";
	import { registerContentWithCoordinator } from "../runtime/content-registration.js";
	import { observeMathControlNames } from "../services/tts/math-control-names.js";
	import { SectionControllerBinding } from "../runtime/SectionControllerBinding.js";
	import { resolveSectionId } from "../runtime/core/engine-resolver.js";
	import {
		type ForwardedPolicyInputs,
		policyInputsToForward,
	} from "../runtime/policy-input-forwarding.js";
	import { watchForUnclaimedRegistrations } from "../runtime/unclaimed-registration-watch.js";
	import { createCompositionEmitScheduler } from "../runtime/composition-emit-scheduler.js";
	import {
		createRuntimeId,
	} from "../runtime/runtime-id.js";
	import {
		createSessionEmitPolicyState,
		resetSessionEmitPolicyState,
		shouldEmitCanonicalSessionEvent,
	} from "../runtime/session-event-emitter-policy.js";

	const logger = createPieLogger("pie-assessment-toolkit", () =>
		isGlobalDebugEnabled(),
	);

	type SessionChangedLike = {
		eventDetail?: unknown;
	};
	type UnknownRecord = Record<string, unknown>;
	type HostRuntimeEventName =
		| typeof PIE_REGISTER_EVENT
		| typeof PIE_UNREGISTER_EVENT
		| typeof PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT
		| typeof PIE_INTERNAL_CONTENT_LOADED_EVENT
		| typeof PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT
		| typeof PIE_INTERNAL_FORMATIVE_ACTION_EVENT
		| typeof PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT;
	type HostRuntimeEventHandler = (event: Event) => void;

	interface CompositionSnapshot {
		sectionId: string;
		currentItemIndex: number;
		renderableSignature: string;
		itemSessionSignature: string;
		formativeSignature: string;
		timedMediaSignature: string;
	}

	interface CompositionRenderableSnapshot {
		id: string;
		version: string;
	}

	interface CompositionSessionSnapshot {
		itemId: string;
		sessionId: string;
		payloadSignature: string;
	}

	type HostItemPlayerInput = Partial<
	Pick<
		ItemPlayerConfig,
		"type" | "tagName" | "version" | "source" | "loaderConfig" | "loaderOptions"
	>
	> | null;

	const runtimeId = createRuntimeId("toolkit");
	// Resolves the section's controller and carries shell registration, content
	// loading, sessions and host commands to it. The stage chain is not the
	// toolkit's: a section player's layout kernel emits it.
	const sectionBinding = new SectionControllerBinding();
	// Per-CE-instance framework-error bus. Shared with the owned
	// `ToolkitCoordinator` so coordinator-side failures (provider-init,
	// tts-init, ...) flow through the same fan-out as CE-side failures
	// (coordinator-init, runtime-init, runtime-dispose). The bus is the
	// single source for the canonical `onFrameworkError` prop, the
	// `framework-error` DOM event, the banner UI, and the
	// `subscribeFrameworkErrors` API on the coordinator.
	const frameworkErrorBus = new FrameworkErrorBus();
const DEFAULT_ENV = {
	mode: "gather",
	role: "student",
} as const;
	const DEFAULT_ITEM_PLAYER_BY_TYPE: Record<ItemPlayerType, string> = {
		iife: "pie-item-player",
		esm: "pie-item-player",
	preloaded: "pie-item-player",
		custom: "",
	};

	let {
		assessmentId = "",
		section = null,
		sectionId = "",
		attemptId = "",
		env = {},
		ndsIcons = false,
		locale = "",
		contentLanguage = "",
		lazyInit = false,
		toolConfigStrictness = "error" as ToolConfigStrictness,
		tools = {},
		toolContextResolvers = null as Record<string, unknown> | null,
		enabledTools = "",
		toolRegistry = null as ToolRegistry | null,
		accessibility = {},
		player = null as HostItemPlayerInput,
		playerType = "" as ItemPlayerType | "",
		coordinator = null as ToolkitCoordinator | null,
		createSectionController = null as null | (() => unknown),
		onFrameworkError = null as null | ((errorModel: FrameworkErrorModel) => void),
		errorRenderer = null as
			| null
			| ((errorModel: FrameworkErrorModel) => {
					title?: string;
					details?: string[];
			  }),
		// Tool policy inputs; see the `<svelte:options>` props block above.
		// `pnpEnforcement` accepts `"on"`, `"off"`, or `null` (auto —
		// each decision enforces when the bound `assessment`, or the item it
		// is scoped to, carries PNP/profile material). Embedded
		// under `<pie-section-player-*>` the same override flows via
		// `runtime.tools.pnpEnforcement`; both entry points converge on
		// the same coordinator call.
		assessment = null as AssessmentEntity | null,
		pnpEnforcement = null as PnpEnforcementMode | null,
		isolation = "inherit",
		session = null as SectionControllerSessionState | null,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	let ownedCoordinator = $state<ToolkitCoordinator | null>(null);
	let inheritedRuntime = $state<AssessmentToolkitHostRuntimeContext | null>(null);
	// `lastOwnership` is a self-comparison latch read and written only by
	// the ownership-change `$effect` below. Keeping it as `$state` would
	// make Svelte treat the same-effect read+write as a reactivity loop
	// (effect_update_depth_exceeded). It does not feed any other reactive
	// consumer, so a plain `let` is safer and matches the canonical Svelte
	// 5 latch pattern documented in `AGENTS.md`.
	let lastOwnership: "owned" | "inherited" | null = null;
	// The coordinator `runtime-ready` last announced. Plain `let` for the same
	// reason as `lastOwnership`.
	let announcedCoordinator: ToolkitCoordinator | null = null;
	// Set when this toolkit builds its own coordinator after finding no outer
	// runtime, which settles ownership: a runtime that connects above it later
	// is not inherited. Cleared with the subscription to outer runtimes, when
	// `host` or `isolation` changes. A latch like `lastOwnership`.
	let ownsByDecision = false;
	let lastAppliedToolContextResolvers: Record<string, unknown> | null = null;
	let provider: ContextProvider<typeof assessmentToolkitRuntimeContext> | null = null;
	let hostRuntimeProvider: ContextProvider<
		typeof assessmentToolkitHostRuntimeContext
	> | null = null;
	let compositionVersion = $state(0);
	let compositionModel = $state<unknown>(null);
	let frameworkErrorModel = $state<FrameworkErrorModel | null>(null);
	let frameworkErrorTitle = $state("Unable to initialize assessment toolkit.");
	let frameworkErrorDetails = $state<string[]>([]);
	// Self-comparison latches for the framework-error redelivery `$effect`
	// and the owned-coordinator bootstrap `$effect` below. Same rationale
	// as `lastOwnership`: keeping these as `$state` made the owning
	// effects read+write the same source in a single pass, tripping
	// `effect_update_depth_exceeded`. Neither value is read by any other
	// reactive consumer, so plain `let` removes the loop without dropping
	// any subscriber.
	let deliveredFrameworkErrorKey = "";
	let lastOwnedBootstrapFailureKey = "";
	// The inputs the owned coordinator was built from, and what bound it: the
	// section that initialized with it, or the item that registered with it first.
	// Plain `let` for the same reason as the latches above.
	let ownedCoordinatorInputs: OwnedCoordinatorInputs | null = null;
	let ownedCoordinatorBinding: "a section initialized" | "an item registered" | null =
		null;
	// A `session` value belongs to the section and attempt current when it was
	// set. It waits in `sessionAssignment` until that section's controller takes
	// it: at creation, or once resolved. A section change discards a value set
	// for the outgoing section, so it never reaches another section's controller.
	// `notedSession` is the last value seen, by identity, so a section change that
	// comes without a new value hydrates as before. `resolvedCohort` is the
	// section whose controller has resolved. Plain `let` for the same reason as
	// the latches above.
	type SessionCohort = { sectionId: string; attemptId: string | undefined };
	let sessionAssignment: {
		value: SectionControllerSessionState;
		cohort: SessionCohort;
	} | null = null;
	let notedSession: SectionControllerSessionState | null = null;
	let resolvedCohort: SessionCohort | null = null;
	// The section and attempt the last initialize started, so a change of either
	// commits the outgoing section first. Plain `let` for the same reason as the
	// latches above.
	let initializedCohort: { sectionId: string; attemptId: string | undefined } | null =
		null;
	// The key of the banner a section that failed to start raised, which the next
	// section to start takes down. Plain `let` for the same reason as the latches
	// above.
	let sectionFailureBannerKey: string | null = null;
	let reportedLateOwnedCoordinatorInputs = false;
	// The coordinator the first-content effect started. Plain `let` for the same
	// reason as the latches above.
	let startedCoordinator: ToolkitCoordinator | null = null;
	let reportedLateOuterRuntime = false;
	let lastCompositionRevisionKey = $state("");
	let pendingCompositionModel: unknown = null;
	// PIE-885: the emit latch and its frame/deadline handles live in the
	// scheduler, so a cancelled or superseded frame can never leave the latch
	// set — which is what stranded `composition-changed` forever in a document
	// that never paints. See `runtime/composition-emit-scheduler.ts`.
	const compositionEmitScheduler = createCompositionEmitScheduler();
	let pendingCrossBoundaryEvents: Array<{ name: string; detail: unknown }> = [];
	const runtimeRegistrationDetails = new Map<HTMLElement, RuntimeRegistrationDetail>();
	const catalogRegistrationCleanups = new WeakMap<HTMLElement, Array<() => void>>();
	const mathNameObservers = new Map<HTMLElement, () => void>();
	const sessionEmitPolicyState = createSessionEmitPolicyState();

	// Whether a shell has registered with this toolkit. A toolkit's first content
	// is its section, or without one its first registered item: the coordinator
	// starts from it, and the inputs it was built from are fixed by it.
	let contentRegistered = $state(false);

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const host = $derived.by(() => getHostElement());

	function emit(name: string, detail: unknown): void {
		if (!host) {
			pendingCrossBoundaryEvents = [...pendingCrossBoundaryEvents, { name, detail }];
			return;
		}
		dispatchCrossBoundaryEvent(host, name, detail);
	}

	$effect(() => {
		if (!host) return;
		if (pendingCrossBoundaryEvents.length === 0) return;
		const queued = pendingCrossBoundaryEvents;
		pendingCrossBoundaryEvents = [];
		queueMicrotask(() => {
			const resolvedHost = host;
			if (!resolvedHost) {
				pendingCrossBoundaryEvents = [...queued, ...pendingCrossBoundaryEvents];
				return;
			}
			for (const event of queued) {
				dispatchCrossBoundaryEvent(resolvedHost, event.name, event.detail);
			}
		});
	});

	function applyErrorRenderer(model: FrameworkErrorModel): {
		title: string;
		details: string[];
	} {
		if (!errorRenderer) {
			return {
				title: "Unable to initialize assessment toolkit.",
				details: model.details.length > 0 ? model.details : [model.message],
			};
		}
		try {
			const rendered = errorRenderer(model) || {};
			return {
				title:
					typeof rendered.title === "string" && rendered.title.trim().length > 0
						? rendered.title
						: "Unable to initialize assessment toolkit.",
				details:
					Array.isArray(rendered.details) && rendered.details.length > 0
						? rendered.details.map((detail) => String(detail))
						: model.details.length > 0
							? model.details
							: [model.message],
			};
		} catch (rendererError) {
			const message =
				rendererError instanceof Error && rendererError.message.trim().length > 0
					? rendererError.message
					: String(rendererError || "Unknown renderer error");
			return {
				title: "Unable to initialize assessment toolkit.",
				details: [
					...model.details,
					`Error renderer failed: ${message}`,
				],
			};
		}
	}

	/**
	 * Build a `FrameworkErrorModel` and publish it on this CE's
	 * framework-error bus.
	 *
	 * All delivery side-effects (banner UI, `framework-error` DOM event,
	 * hook delivery, console logging) live in the bus subscriber
	 * registered below — keeping this helper a thin publish-side wrapper
	 * that CE-internal callers can use.
	 *
	 * Coordinator-side failures (provider-init, tts-init, ...) reach the
	 * same subscriber by way of the shared bus (passed into the owned
	 * coordinator via `buildOwnedCoordinator`), so consumers see one
	 * canonical fan-out per error.
	 */
	function reportFrameworkError(args: {
		kind: FrameworkErrorModel["kind"];
		source: string;
		error: unknown;
		recoverable?: boolean;
		scope?: FrameworkErrorModel["scope"];
	}): FrameworkErrorModel {
		const model = frameworkErrorFromUnknown({
			kind: args.kind,
			source: args.source,
			error: args.error,
			recoverable: args.recoverable,
			scope: args.scope,
		});
		frameworkErrorBus.reportFrameworkError(model);
		return model;
	}

	/**
	 * Surface the two timed-media conditions a host has to be able to see.
	 *
	 * A capability gap is recoverable: cues still fire and state is still recorded,
	 * so readiness is untouched and the section delivers — it is reported because a
	 * seek lock that does not lock reads to an author as one that does. Malformed
	 * authored data is not recoverable: the section delivers as an ordinary section,
	 * and the author has to learn that the cue timeline is inert.
	 *
	 * Every other controller event reaches hosts through the composition republish
	 * and the coordinator's own subscriptions; nothing else is intercepted here.
	 */
	function reportTimedMediaDiagnostic(event: { type?: string } | null): void {
		if (event?.type === "timed-media-policy-degraded") {
			const degradations =
				(event as { degradations?: Array<{ message?: string }> }).degradations || [];
			frameworkErrorBus.reportFrameworkError(
				toFrameworkErrorModel({
					kind: "timed-media",
					severity: "warning",
					source: "pie-assessment-toolkit",
					message:
						"A timed-media playback policy degraded to advisory: the media time source does not report the capability it needs.",
					details: degradations
						.map((entry) => entry?.message)
						.filter((message): message is string => typeof message === "string"),
					recoverable: true,
					scope: "cohort",
				}),
			);
			return;
		}
		if (event?.type !== "timed-media-invalid") return;
		const errors = (event as { errors?: Array<{ message?: string }> }).errors || [];
		frameworkErrorBus.reportFrameworkError(
			toFrameworkErrorModel({
				kind: "timed-media",
				severity: "error",
				source: "pie-assessment-toolkit",
				message:
					'This section declares sectionType: "timed-media" but its timedMedia data is not deliverable; the section renders without cue behavior.',
				details: errors
					.map((entry) => entry?.message)
					.filter((message): message is string => typeof message === "string"),
				recoverable: false,
				scope: "cohort",
			}),
		);
	}

	/**
	 * TTS/media handoff: whichever audio the learner started last is the one that
	 * plays, so starting read-aloud silences media and starting media silences
	 * read-aloud.
	 *
	 * Arbitrated here because this is the only layer that holds both capabilities.
	 * The section owns the media port and no policy over speech; the TTS service
	 * owns speech and knows nothing of a stimulus. Neither can yield to the other
	 * on its own, which is why the overlap survived the port landing.
	 *
	 * Neither direction resumes what it silenced. A learner who paused media before
	 * starting read-aloud would not expect it back, and auto-resuming into a held
	 * gate would fight the enforcement that paused it — so the resume is the
	 * learner's, as it already is for every other pause in this contract.
	 */
	function handleTimedMediaAudioStarted(event: { type?: string } | null): void {
		if (event?.type !== "timed-media-audio-started") return;
		if (!effectiveCoordinator) return;
		pauseTtsForMediaAudio(effectiveCoordinator.getServiceBundle().ttsService);
	}

	/**
	 * Whether this CE should surface the bootstrap banner for `kind`.
	 *
	 * The banner is the visible "we could not start the toolkit" surface
	 * and is intentionally narrower than the canonical contract: it only
	 * fires for fatal CE-bootstrap kinds (`coordinator-init`,
	 * `runtime-init`, `tool-config`). Coordinator-internal failures
	 * (provider-init, tts-init, ...) still flow through the canonical
	 * hook + DOM event but do not replace the toolkit content with an
	 * error card — they are degradations, not bootstrap failures.
	 */
	function isBootstrapKind(kind: FrameworkErrorModel["kind"]): boolean {
		return (
			kind === "coordinator-init" ||
			kind === "runtime-init" ||
			kind === "tool-config"
		);
	}

	function frameworkErrorKey(model: FrameworkErrorModel): string {
		return `${model.kind}|${model.source}|${model.message}`;
	}

	function deliverFrameworkErrorHook(model: FrameworkErrorModel): void {
		if (!onFrameworkError) return;
		try {
			onFrameworkError(model);
			deliveredFrameworkErrorKey = frameworkErrorKey(model);
		} catch (hookError) {
			console.error(
				`[pie-framework:${model.kind}:${model.source}] framework error hook failed`,
				hookError,
			);
		}
	}

	// Errors republished from a coordinator the host constructed. See the forward
	// below.
	const hostCoordinatorErrors = new WeakSet<FrameworkErrorModel>();
	// The model each error object was published as, so a failure the coordinator
	// reported is not reported a second time by the section initialization it
	// failed.
	const publishedFrameworkErrors = new WeakMap<object, FrameworkErrorModel>();

	function reportedFrameworkErrorFor(error: unknown): FrameworkErrorModel | null {
		if (typeof error !== "object" || error === null) return null;
		return publishedFrameworkErrors.get(error) ?? null;
	}

	function showFrameworkErrorBanner(model: FrameworkErrorModel): void {
		const rendered = applyErrorRenderer(model);
		frameworkErrorModel = model;
		frameworkErrorTitle = rendered.title;
		frameworkErrorDetails = rendered.details;
	}

	function clearFrameworkErrorBanner(): void {
		frameworkErrorModel = null;
		frameworkErrorTitle = "Unable to initialize assessment toolkit.";
		frameworkErrorDetails = [];
	}

	$effect(() => {
		const detach = frameworkErrorBus.subscribeFrameworkErrors((model) => {
			console.error(formatFrameworkErrorForConsole(model), model.cause);
			if (typeof model.cause === "object" && model.cause !== null) {
				publishedFrameworkErrors.set(model.cause, model);
			}

			if (isBootstrapKind(model.kind) && !hostCoordinatorErrors.has(model)) {
				showFrameworkErrorBanner(model);
			}

			emit("framework-error", model);

			deliverFrameworkErrorHook(model);
		});
		return () => {
			detach();
		};
	});

	// A coordinator the host constructed reports into its own bus, which the
	// subscriber above never sees, so its failures reach this CE's `framework-error`
	// event and `onFrameworkError` prop only through this forward. An owned
	// coordinator already shares the bus, and an inherited one is delivered by the
	// toolkit that owns its runtime. The forwarded errors skip the initialization
	// banner: it replaces the section, and the host that constructed the
	// coordinator handles that coordinator's failures.
	$effect(() => {
		const hostCoordinator = coordinator;
		if (!hostCoordinator || effectiveCoordinator !== hostCoordinator) return;
		if (typeof hostCoordinator.subscribeFrameworkErrors !== "function") return;
		return untrack(() =>
			hostCoordinator.subscribeFrameworkErrors((model) => {
				hostCoordinatorErrors.add(model);
				frameworkErrorBus.reportFrameworkError(model);
			}),
		);
	});

	// A coordinator without a registry, whether the host constructed it or this
	// toolkit built it, takes this toolkit's, so its providers are the ones behind
	// the toolbar's buttons. A registry set after mount is adopted in place. A host
	// coordinator also hears that there is none, which reports it missing.
	$effect(() => {
		const coord = effectiveCoordinator;
		const registry = toolRegistry;
		if (!coord || inheritsOuterRuntime) return;
		if (typeof coord.adoptToolRegistry !== "function") return;
		untrack(() => {
			const owned = coord === ownedCoordinator;
			if (owned && !registry) return;
			if (coord.adoptToolRegistry(registry) && owned && ownedCoordinatorInputs) {
				ownedCoordinatorInputs = { ...ownedCoordinatorInputs, toolRegistry: registry };
			}
		});
	});

	$effect(() => {
		if (!frameworkErrorModel) return;
		if (deliveredFrameworkErrorKey === frameworkErrorKey(frameworkErrorModel)) return;
		// Hook prop became available after the framework-error model was
		// already produced (e.g. host wired it asynchronously). Re-deliver
		// once for the current model so late-binding hosts see the error.
		deliverFrameworkErrorHook(frameworkErrorModel);
	});

	function hashString(input: string): string {
		let hash = 5381;
		for (let index = 0; index < input.length; index += 1) {
			hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
		}
		return (hash >>> 0).toString(36);
	}

	function asRecord(value: unknown): UnknownRecord {
		return value && typeof value === "object" ? (value as UnknownRecord) : {};
	}

	function toSectionId(model: UnknownRecord): string {
		const section = asRecord(model.section);
		const sectionIdentifier =
			typeof section.identifier === "string" ? section.identifier : "";
		const sectionIdValue = typeof model.sectionId === "string" ? model.sectionId : "";
		return sectionIdentifier || sectionIdValue;
	}

	function toCurrentItemIndex(model: UnknownRecord): number {
		return typeof model.currentItemIndex === "number" ? model.currentItemIndex : -1;
	}

	function toRenderableSnapshots(model: UnknownRecord): CompositionRenderableSnapshot[] {
		const renderables = Array.isArray(model.renderables) ? model.renderables : [];
		return renderables.map((entry, index) => {
			const row = asRecord(entry);
			const entity = asRecord(row.entity);
			const entityId =
				(typeof entity.id === "string" && entity.id) || `renderable-${index}`;
			const entityConfig = asRecord(entity.config);
			const entityVersion =
				(typeof entity.version === "string" && entity.version) ||
				(typeof entity.version === "number" ? String(entity.version) : "") ||
				(typeof entityConfig.version === "string" ? entityConfig.version : "");
			return {
				id: entityId,
				version: entityVersion,
			};
		});
	}

	function toSessionSnapshots(model: UnknownRecord): CompositionSessionSnapshot[] {
		const sessionsByItem = asRecord(model.itemSessionsByItemId);
		return Object.keys(sessionsByItem)
			.sort((left, right) => left.localeCompare(right))
			.map((itemId) => {
				const session = asRecord(sessionsByItem[itemId]);
				const sessionId = typeof session.id === "string" ? session.id : "";
				const dataPayload = Array.isArray(session.data) ? session.data : [];
				let payloadSignature = "";
				try {
					payloadSignature = hashString(JSON.stringify(dataPayload));
				} catch {
					payloadSignature = String(dataPayload.length);
				}
				return {
					itemId,
					sessionId,
					payloadSignature,
				};
			});
	}

	/**
	 * Formative Try state, folded into the revision key.
	 *
	 * Load-bearing: recording a Try changes neither the renderables nor the item
	 * sessions, so without this the revision key is identical before and after
	 * and `flushCompositionChanged` suppresses the emit — the controller holds
	 * correct state and the card never learns that its feedback was revealed.
	 *
	 * Reads only the three fields that change what a card renders. The outcome's
	 * points are deliberately excluded: a re-check that produces the same
	 * correctness with a different partial score is the same screen.
	 */
	function toFormativeSignature(model: UnknownRecord): string {
		const states = asRecord(asRecord(model.formative).states);
		return Object.entries(states)
			.map(([itemId, value]) => {
				const state = asRecord(value);
				const correctness = asRecord(state.lastOutcome).correctness ?? "";
				// `revealOverride` too: a host raising a reveal from correctness to
				// solution changes the projected env without changing `revealed`.
				return `${itemId}:${state.tryCount ?? 0}:${state.revealed === true ? 1 : 0}:${String(correctness)}:${String(state.revealOverride ?? "")}`;
			})
			.sort()
			.join("|");
	}

	/**
	 * Timed-media cue state, folded into the revision key for the same reason
	 * formative state had to be: a cue firing changes neither the renderables nor
	 * the item sessions, so without this the key is identical before and after and
	 * the emit is coalesced away — the controller would hold correct cue state while
	 * the pane kept every gated item hidden.
	 *
	 * The encoding is `players-shared`'s, shared with the controller's own emit
	 * check. Two encodings of the same question drift, and either direction fails
	 * silently: a republish for a change the controller never announced, or an
	 * announced change this coalesces away. Media position is absent from it, which
	 * is what keeps a four-per-second clock from republishing the composition.
	 */
	function toTimedMediaSignature(model: UnknownRecord): string {
		const projection = model.timedMedia as TimedMediaSectionProjection | null;
		return timedMediaProjectionSignature(projection);
	}

	function toCompositionSnapshot(model: unknown): CompositionSnapshot {
		const typed = asRecord(model);
		const renderableSignature = toRenderableSnapshots(typed)
			.map((entry) => `${entry.id}:${entry.version}`)
			.join("|");
		const itemSessionSignature = toSessionSnapshots(typed)
			.map((entry) => `${entry.itemId}:${entry.sessionId}:${entry.payloadSignature}`)
			.join("|");
		return {
			sectionId: toSectionId(typed),
			currentItemIndex: toCurrentItemIndex(typed),
			renderableSignature,
			itemSessionSignature,
			formativeSignature: toFormativeSignature(typed),
			timedMediaSignature: toTimedMediaSignature(typed),
		};
	}

	function getCompositionRevisionKey(model: unknown): string {
		const snapshot = toCompositionSnapshot(model);
		return `${snapshot.sectionId}|${snapshot.currentItemIndex}|${snapshot.renderableSignature}|${snapshot.itemSessionSignature}|${snapshot.formativeSignature}|${snapshot.timedMediaSignature}`;
	}

	function isKnownPlayerType(value: unknown): value is ItemPlayerType {
		return value === "iife" || value === "esm" || value === "preloaded" || value === "custom";
	}

	function normalizeItemPlayerConfig(
		hostPlayer: HostItemPlayerInput,
		hostPlayerType: ItemPlayerType | "",
	): ItemPlayerConfig {
		const typeFromConfig = hostPlayer?.type;
		const rawType = isKnownPlayerType(typeFromConfig)
			? typeFromConfig
			: isKnownPlayerType(hostPlayerType)
				? hostPlayerType
				: hostPlayer?.tagName
					? "custom"
					: "iife";
		const requestedTagName = hostPlayer?.tagName?.trim();
		if (rawType === "custom" && !requestedTagName) {
			return {
				type: "iife",
				tagName: DEFAULT_ITEM_PLAYER_BY_TYPE.iife,
				version: undefined,
				source: undefined,
				isDefault: true,
			};
		}
		return {
			type: rawType,
			tagName: requestedTagName || DEFAULT_ITEM_PLAYER_BY_TYPE[rawType],
			version: hostPlayer?.version,
			source: hostPlayer?.source,
			loaderConfig: hostPlayer?.loaderConfig,
			loaderOptions: hostPlayer?.loaderOptions,
			isDefault: !hostPlayer && !hostPlayerType,
		};
	}

	function normalizeEnv(input: unknown): { mode: string; role: string } {
		const envValue = ((input || {}) as Record<string, unknown>) || {};
		const mode =
			typeof envValue.mode === "string" && envValue.mode.trim()
				? envValue.mode.trim()
				: DEFAULT_ENV.mode;
		const role =
			typeof envValue.role === "string" && envValue.role.trim()
				? envValue.role.trim()
				: DEFAULT_ENV.role;
		return { mode, role };
	}

	function resolveSectionViewFromEnv(input: unknown): string {
		const resolvedEnv = normalizeEnv(input);
		if (resolvedEnv.mode === "author") return "author";
		if (resolvedEnv.role === "instructor") return "scorer";
		return "candidate";
	}

	function sameSessionCohort(a: SessionCohort, b: SessionCohort): boolean {
		return a.sectionId === b.sectionId && a.attemptId === b.attemptId;
	}

	function noteSession(): void {
		if (!session || session === notedSession) return;
		notedSession = session;
		sessionAssignment = {
			value: session,
			cohort: { sectionId: effectiveSectionId, attemptId: attemptId || undefined },
		};
	}

	/**
	 * The value set for `cohort`, once. Initializing a section discards a value
	 * set for any other, which can only be an outgoing one; a resolved controller
	 * leaves it, since it may be the next section's.
	 */
	function takeSessionFor(
		cohort: SessionCohort,
		initializing: boolean,
	): SectionControllerSessionState | null {
		noteSession();
		const assignment = sessionAssignment;
		if (!assignment) return null;
		if (!sameSessionCohort(assignment.cohort, cohort)) {
			if (initializing) sessionAssignment = null;
			return null;
		}
		sessionAssignment = null;
		return assignment.value;
	}

	function assignSessionToController(): void {
		const cohort = resolvedCohort;
		const coordinator = effectiveCoordinator;
		if (!cohort || !coordinator) return;
		const next = takeSessionFor(cohort, false);
		if (!next) return;
		const controller = coordinator.getSectionController(cohort);
		if (!controller) return;
		const resolved = resolveSectionSessionAssignment(
			controller.getSession?.() ?? null,
			next,
		);
		if (!resolved) return;
		void Promise.resolve()
			.then(() => {
				if (!controller.applySession) {
					throw new Error(
						"Section controller cannot apply the assigned session: it has no applySession.",
					);
				}
				return controller.applySession(resolved, { mode: "replace" });
			})
			.catch((error) => {
				reportFrameworkError({
					kind: "unknown",
					source: "pie-assessment-toolkit",
					error,
					recoverable: true,
				});
			});
	}

	async function createDefaultSectionController() {
		if (createSectionController) {
			return createSectionController() as any;
		}
		throw new Error(
			"pie-assessment-toolkit requires createSectionController when no coordinator hook provides one",
		);
	}

	/**
	 * Merge the `enabled-tools` shorthand into a `tools.placement.section`
	 * list, leaving the `tools` object form authoritative when both are
	 * provided. Mirrors `resolveToolsConfig` in the section-player layer
	 * so direct toolkit hosts get the same easy-tier behavior.
	 *
	 * Precedence (highest first):
	 *   1. Explicit `tools.placement.section` array on the `tools` prop
	 *   2. `enabled-tools` shorthand attribute / `enabledTools` prop
	 *
	 * Section-player CEs already merge before passing `tools` here, so for
	 * the embedded path this helper is a no-op in practice; it only fires
	 * when a host mounts `<pie-assessment-toolkit>` directly.
	 */
	function buildEffectiveToolsInput(): Record<string, unknown> {
		const baseTools = (tools || {}) as Record<string, unknown>;
		const sectionShorthand = parseToolList(enabledTools);
		if (sectionShorthand.length === 0) return baseTools;
		const placement = (baseTools.placement || {}) as Record<string, unknown>;
		const explicitSectionPlacement = Array.isArray(placement.section)
			? (placement.section as unknown[])
			: null;
		if (explicitSectionPlacement && explicitSectionPlacement.length > 0) {
			return baseTools;
		}
		return {
			...baseTools,
			placement: {
				...placement,
				section: sectionShorthand,
			},
		};
	}

	function validateToolsConfigForBootstrap() {
		return normalizeAndValidateToolsConfig(buildEffectiveToolsInput() as any, {
			strictness: toolConfigStrictness,
			source: "pie-assessment-toolkit.bootstrap",
			toolRegistry,
		}).config;
	}

	function getOwnedBootstrapFailureKey(): string {
		let toolsSignature = "";
		let toolContextResolverSignature = "";
		try {
			toolsSignature = JSON.stringify(buildEffectiveToolsInput());
		} catch {
			toolsSignature = "[unserializable-tools]";
		}
		try {
			toolContextResolverSignature = JSON.stringify(
				Object.entries(toolContextResolvers ?? {}).map(([toolId, resolver]) => [
					toolId,
					typeof resolver,
				]),
			);
		} catch {
			toolContextResolverSignature = "[unserializable-resolvers]";
		}
		return [
			assessmentId || "",
			String(toolConfigStrictness || "error"),
			toolsSignature,
			toolContextResolverSignature,
		].join("|");
	}

	// Coerce the public PNP enforcement CE attribute (string or null)
	// into the engine's `PnpEnforcementMode | null` contract. Anything
	// outside the canonical "on" / "off" set — typos like "ON",
	// missing-attribute artifacts like "" or "null" strings — collapses
	// to `null` (auto-mode) instead of silently degrading inside the
	// engine. This is the single canonical entry point for the prop.
	function coercePnpEnforcement(
		value: PnpEnforcementMode | null | string | undefined,
	): PnpEnforcementMode | null {
		return value === "on" || value === "off" ? value : null;
	}

	// Resolve the effective override that flows into the coordinator.
	// The explicit `pnp-enforcement` attribute (standalone path) wins
	// over `tools.pnpEnforcement` (embedded path via
	// runtime tools config); all fall back to `null` (auto-mode) so the coordinator's
	// {@link resolveDefaultPnpEnforcement} helper runs on the bound
	// assessment / item ref.
	function resolvePnpEnforcementInput(
		explicitPnp: PnpEnforcementMode | null | string | undefined,
		toolsConfig: unknown,
	): PnpEnforcementMode | null {
		const explicitMode = coercePnpEnforcement(explicitPnp);
		if (explicitMode) return explicitMode;
		if (toolsConfig && typeof toolsConfig === "object") {
			const toolConfig = toolsConfig as {
				pnpEnforcement?: unknown;
			};
			const candidate = toolConfig.pnpEnforcement;
			return coercePnpEnforcement(
				typeof candidate === "string" ? candidate : null,
			);
		}
		return null;
	}

	function buildOwnedCoordinator(validatedTools: unknown): ToolkitCoordinator {
		const fallbackAssessmentId =
			assessmentId ||
			(section as any)?.identifier ||
			`assessment-${Math.random().toString(16).slice(2)}`;
		return new ToolkitCoordinator({
			assessmentId: fallbackAssessmentId,
			lazyInit,
			// Initialization starts at first content, once the section composes; a
			// coordinator that started at construction would start text-to-speech,
			// and report its failures, before there is a section.
			eagerInit: false,
			toolConfigStrictness,
			deferToolConfigValidation: true,
			// This toolkit binds only its `assessment` prop, which a section player
			// leaves unset.
			assessmentOptional: true,
			tools: validatedTools as any,
			toolRegistry,
			toolContextResolvers: toolContextResolvers as any,
			accessibility: accessibility as any,
			frameworkErrorBus,
		});
	}

	// What `buildOwnedCoordinator` reads, in a form two reads compare by. The
	// tools leave out `pnpEnforcement`, which the policy effect below pushes to a
	// live coordinator, as the bootstrap effect does with the resolvers.
	type OwnedCoordinatorInputs = {
		signatures: Record<string, string>;
		toolRegistry: ToolRegistry | null;
	};

	function signatureOf(value: unknown): string {
		try {
			return JSON.stringify(value ?? null);
		} catch {
			return "[unserializable]";
		}
	}

	function readOwnedCoordinatorInputs(): OwnedCoordinatorInputs {
		return {
			signatures: {
				assessmentId: assessmentId || "",
				toolConfigStrictness: String(toolConfigStrictness || "error"),
				lazyInit: String(lazyInit),
				tools: signatureOf({
					...buildEffectiveToolsInput(),
					pnpEnforcement: undefined,
				}),
				accessibility: signatureOf(accessibility),
			},
			toolRegistry,
		};
	}

	function changedOwnedCoordinatorInputs(): string[] {
		const built = ownedCoordinatorInputs;
		if (!built) return [];
		const current = readOwnedCoordinatorInputs();
		const changed = Object.keys(current.signatures).filter(
			(name) => current.signatures[name] !== built.signatures[name],
		);
		// A coordinator built without a registry adopts the first one in place.
		if (built.toolRegistry && current.toolRegistry !== built.toolRegistry) {
			changed.push("toolRegistry");
		}
		return changed;
	}

	function reportLateOwnedCoordinatorInputs(
		changed: string[],
		binding: NonNullable<typeof ownedCoordinatorBinding>,
	): void {
		if (reportedLateOwnedCoordinatorInputs) return;
		reportedLateOwnedCoordinatorInputs = true;
		console.warn(
			`[pie-assessment-toolkit] ${changed.join(", ")} changed after ${binding} with the coordinator this toolkit built, and that coordinator keeps the values it was built with. Set these inputs no later than the section or the first item scope, pass a coordinator of your own, or update this one from runtime-ready with updateToolConfig(...) or updateToolsPlacement(...). Reported once per toolkit.`,
		);
	}

	function reportLateOuterRuntime(outerRuntimeId: string): void {
		if (reportedLateOuterRuntime) return;
		reportedLateOuterRuntime = true;
		console.warn(
			`[pie-assessment-toolkit] The toolkit above this one (runtime "${outerRuntimeId}") had no coordinator when this one connected, so this one built its own and keeps it: the two share no tool state, policy or read-aloud. Give the outer toolkit its coordinator before the inner one connects, or set isolation="force" on the inner one to keep them apart on purpose. Reported once per toolkit.`,
		);
	}

	function releaseOwnedCoordinator(): Promise<void> {
		const current = ownedCoordinator;
		if (!current) return Promise.resolve();
		ownedCoordinator = null;
		return current.dispose();
	}

	function reportOwnedCoordinatorDisposeError(error: unknown): void {
		reportFrameworkError({
			kind: "runtime-dispose",
			source: "pie-assessment-toolkit",
			error,
			recoverable: true,
		});
	}

	// A coordinator the host passes wins over an outer runtime, which is followed
	// meanwhile so that removing the prop inherits at once.
	const inheritsOuterRuntime = $derived(
		!coordinator && isolation !== "force" && inheritedRuntime?.coordinator != null,
	);
	const effectiveCoordinator = $derived.by(() => {
		if (inheritsOuterRuntime) {
			return inheritedRuntime?.coordinator as ToolkitCoordinator;
		}
		return coordinator || ownedCoordinator;
	});
	const hasSection = $derived(section != null);

	// Owned-coordinator bootstrap. The effect must re-run when ownership
	// inputs (`host`, `coordinator`, `isolation`, `inheritedRuntime`)
	// change so the toolkit can swap between owned, passed-in, and
	// inherited coordinators. It must *not* re-run on its own writes to
	// `ownedCoordinator` / `lastOwnedBootstrapFailureKey` /
	// `frameworkError*` — those self-mutations were the
	// observed source of the `effect_update_depth_exceeded` warnings in
	// the assessment-player smoke flow. We therefore explicitly track
	// only the ownership inputs and run the bootstrap body inside
	// `untrack`, matching the Svelte subscription guidance in `AGENTS.md`.
	//
	// It also tracks what the owned coordinator is built from, and the toolkit's
	// first content. Content that arrives after one of those inputs changed binds
	// a coordinator rebuilt from the current values, so a host that sets `runtime`
	// and `section` a tick after mount gets the coordinator it would have had
	// setting them first. Once content has bound the coordinator, which has then
	// started, a change is reported instead. A registry is the exception: the
	// registry effect above hands it to a coordinator built without one.
	$effect(() => {
		void host;
		void coordinator;
		void isolation;
		void inheritedRuntime;
		void toolContextResolvers;
		void hasSection;
		void contentRegistered;
		void tools;
		void enabledTools;
		void assessmentId;
		void toolConfigStrictness;
		void lazyInit;
		void accessibility;
		void toolRegistry;
		untrack(() => {
			if (!host) return;
			if (coordinator) {
				if (ownedCoordinator) {
					void releaseOwnedCoordinator().catch(
						reportOwnedCoordinatorDisposeError,
					);
				}
				lastAppliedToolContextResolvers = null;
				return;
			}
			if (isolation !== "force" && inheritedRuntime?.coordinator) {
				if (ownedCoordinator) {
					void releaseOwnedCoordinator().catch(
						reportOwnedCoordinatorDisposeError,
					);
				}
				lastAppliedToolContextResolvers = null;
				return;
			}
			if (ownedCoordinator) {
				const changed = changedOwnedCoordinatorInputs();
				if (changed.length > 0 && ownedCoordinatorBinding) {
					reportLateOwnedCoordinatorInputs(changed, ownedCoordinatorBinding);
				} else if (changed.length > 0 && (section || contentRegistered)) {
					void releaseOwnedCoordinator().catch(
						reportOwnedCoordinatorDisposeError,
					);
				}
			}
			if (
				ownedCoordinator &&
				lastAppliedToolContextResolvers !== toolContextResolvers
			) {
				try {
					ownedCoordinator.setToolContextResolvers(toolContextResolvers as any);
					lastAppliedToolContextResolvers = toolContextResolvers;
				} catch (error) {
					reportFrameworkError({
						kind: "coordinator-init",
						source: "pie-assessment-toolkit",
						error,
					});
				}
				return;
			}
			if (!ownedCoordinator) {
				// Ownership is decided before anything is built. An outer runtime
				// already providing its context is inherited; the subscription
				// below would find it a moment later, after an owned coordinator
				// had been built only to be released.
				if (isolation !== "force" && !ownsByDecision) {
					const outer = requestContext(host, assessmentToolkitHostRuntimeContext);
					if (outer?.coordinator && outer.runtimeId !== runtimeId) {
						inheritedRuntime = outer;
						lastAppliedToolContextResolvers = null;
						return;
					}
				}
				const failureKey = getOwnedBootstrapFailureKey();
				if (lastOwnedBootstrapFailureKey === failureKey) {
					return;
				}
				try {
					const validatedTools = validateToolsConfigForBootstrap();
					ownedCoordinator = buildOwnedCoordinator(validatedTools);
					ownsByDecision = isolation !== "force";
					ownedCoordinatorInputs = readOwnedCoordinatorInputs();
					ownedCoordinatorBinding = null;
					lastAppliedToolContextResolvers = toolContextResolvers;
					lastOwnedBootstrapFailureKey = "";
					clearFrameworkErrorBanner();
				} catch (error) {
					ownedCoordinator = null;
					lastOwnedBootstrapFailureKey = failureKey;
					reportFrameworkError({
						kind: "coordinator-init",
						source: "pie-assessment-toolkit",
						error,
					});
				}
			}
		});
	});

	// An item registering binds a coordinator no section has bound. After the
	// bootstrap effect above, which rebuilds it first from inputs that changed.
	$effect(() => {
		if (!contentRegistered || !effectiveCoordinator) return;
		const coord = effectiveCoordinator;
		untrack(() => {
			if (coord === ownedCoordinator) ownedCoordinatorBinding ??= "an item registered";
		});
	});

	// One interface-i18n provider per toolkit instance, published on the runtime
	// context. Every capability on the page shares it, so a locale's catalog is
	// fetched once rather than once per tool, and a host that swaps in its own
	// `I18nProvider` reaches all of them through the same channel.
	const interfaceI18n = createPieI18n();
	// Bumped by the provider's own change signal, which fires once a lazily
	// loaded catalog is resident. `runtimeContextValue` reads it, so the context
	// re-publishes and consumers re-read strings that were still English a tick
	// earlier. Without this the first paint would pin English forever — the same
	// class of failure as a composition context published with no change signal.
	let interfaceI18nVersion = $state(0);
	$effect(() =>
		interfaceI18n.subscribe(() => {
			interfaceI18nVersion += 1;
		}),
	);
	$effect(() => {
		const requested = typeof locale === "string" ? locale.trim() : "";
		untrack(() => {
			// Rejecting the promise here would take a player down over a missing
			// locale chunk; every key still resolves through the English fallback.
			void Promise.resolve(
				interfaceI18n.setLocale(requested || DEFAULT_LOCALE),
			).catch((error) => {
				reportFrameworkError({
					kind: "i18n-locale-load",
					source: "pie-assessment-toolkit",
					error: error instanceof Error ? error : new Error(String(error)),
					recoverable: true,
				});
			});
		});
	});

	const effectiveAssessmentId = $derived(
		assessmentId || effectiveCoordinator?.assessmentId || "",
	);
	const effectiveSectionId = $derived(
		resolveSectionId({ sectionId, section, assessmentId: effectiveAssessmentId }),
	);
	const effectiveEnv = $derived.by(() => normalizeEnv(env));
	const effectiveSectionView = $derived.by(() => resolveSectionViewFromEnv(effectiveEnv));
	const effectiveItemPlayer = $derived.by(() =>
		normalizeItemPlayerConfig(player, playerType),
	);
	const instrumentationProvider = $derived.by(
		() =>
			resolveInstrumentationProvider({
				player: effectiveItemPlayer,
				component: "pie-assessment-toolkit",
			}),
	);
	const runtimeContextValue = $derived.by((): AssessmentToolkitRuntimeContext | null => {
		if (!effectiveCoordinator) return null;
		const services = effectiveCoordinator.getServiceBundle();
		return {
			toolkitCoordinator: effectiveCoordinator,
			toolCoordinator: effectiveCoordinator.toolCoordinator,
			ttsService: services.ttsService,
			highlightCoordinator: services.highlightCoordinator,
			catalogResolver: services.catalogResolver,
			elementToolStateStore: services.elementToolStateStore,
			assessmentId: effectiveAssessmentId,
			sectionId: effectiveSectionId,
			itemPlayer: effectiveItemPlayer,
			// Opt-in: NDS icons only when explicitly enabled. Normalize to a
			// strict boolean so `undefined`/`false` both read as off.
			ndsIcons: ndsIcons === true,
			// Interface locale and the provider resolving it. Both live on the
			// context so a tool reads one value and one provider however deep it
			// sits. Reading the version counter is what makes a completed catalog
			// load re-publish this object; see `interfaceI18nVersion`.
			locale: (void interfaceI18nVersion, interfaceI18n.getLocale()),
			i18n: interfaceI18n,
			contentLanguage: contentLanguage?.trim() || undefined,
			reportSectionError: (error: unknown) => {
				sectionBinding.reportSectionError({
					source: "section-runtime",
					error,
					timestamp: Date.now(),
				});
			},
		};
	});
	const hostRuntimeContextValue = $derived.by(
		(): AssessmentToolkitHostRuntimeContext | null => {
			if (!effectiveCoordinator || !host) return null;
			return {
				runtimeId,
				coordinator: effectiveCoordinator,
				sectionBound: hasSection,
				eventTarget: host,
			};
		},
	);

	function flushCompositionChanged(nextModel: unknown) {
		// A registration before any controller resolves has no composition to report.
		if (nextModel == null) return;
		const nextRevisionKey = getCompositionRevisionKey(nextModel);
		if (nextRevisionKey === lastCompositionRevisionKey) {
			return;
		}
		lastCompositionRevisionKey = nextRevisionKey;
		compositionVersion += 1;
		compositionModel = nextModel;
		emit("composition-changed", {
			composition: compositionModel,
			version: compositionVersion,
		});
	}

	function emitCompositionChanged(nextModel?: unknown) {
		pendingCompositionModel = nextModel ?? sectionBinding.getCompositionModel();
		// Coalescing lives in the scheduler: repeated calls before the cycle
		// resolves only replace the model, and the flush reads the latest one.
		compositionEmitScheduler.schedule(() => {
			flushCompositionChanged(pendingCompositionModel);
		});
	}

	/** Publish a scheduled composition now rather than on the next frame. */
	function flushPendingComposition() {
		if (!compositionEmitScheduler.isPending()) return;
		compositionEmitScheduler.cancel();
		flushCompositionChanged(pendingCompositionModel);
	}

	function unregisterCatalogsForElement(element?: HTMLElement | null): void {
		if (!element) return;
		const cleanups = catalogRegistrationCleanups.get(element);
		if (!cleanups) return;
		for (const cleanup of cleanups) {
			cleanup();
		}
		catalogRegistrationCleanups.delete(element);
	}

	function unregisterAllScopedCatalogs(): void {
		for (const detail of runtimeRegistrationDetails.values()) {
			unregisterCatalogsForElement(detail.element);
		}
	}

	function registerCatalogsForDetail(detail: RuntimeRegistrationDetail): void {
		unregisterCatalogsForElement(detail.element);
		if (!effectiveCoordinator) return;
		catalogRegistrationCleanups.set(
			detail.element,
			registerContentWithCoordinator(effectiveCoordinator, detail, {
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
			}),
		);
	}

	function refreshCatalogRegistrations(): void {
		unregisterAllScopedCatalogs();
		for (const detail of runtimeRegistrationDetails.values()) {
			registerCatalogsForDetail(detail);
		}
	}

	function stopNamingMath(element?: HTMLElement | null): void {
		if (!element) return;
		mathNameObservers.get(element)?.();
		mathNameObservers.delete(element);
	}

	function nameMathInControls(element: HTMLElement): void {
		stopNamingMath(element);
		mathNameObservers.set(
			element,
			observeMathControlNames(element, {
				getMathSpeech: () =>
					effectiveCoordinator?.getServiceBundle().ttsService.getMathSpeechOptions(),
				getContentLanguage: () => contentLanguage,
			}),
		);
	}

	function emitNormalizedSessionChanged(args: {
		itemId: string;
		canonicalItemId?: string;
		result: unknown;
		fallbackSession: unknown;
	}) {
		const normalized =
			(args.result as SessionChangedLike | null)?.eventDetail || args.fallbackSession;
		const payload = {
			...(normalized as Record<string, unknown>),
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId || args.itemId,
			sourceRuntimeId: runtimeId,
		} as Record<string, unknown>;
		if (
			!shouldEmitCanonicalSessionEvent({
				state: sessionEmitPolicyState,
				itemId: args.itemId,
				payload,
			})
		) {
			return;
		}
		emit("session-changed", payload);
	}

	function isLocalToCurrentRuntime(eventTarget: EventTarget | null): boolean {
		if (!(eventTarget instanceof HTMLElement)) return false;
		const sourceRuntime = requestContext(
			eventTarget,
			assessmentToolkitHostRuntimeContext,
		);
		return sourceRuntime?.runtimeId === runtimeId;
	}

	function getEventDetail<T>(event: Event): T | null {
		const detail = (event as CustomEvent<T>).detail;
		return detail ?? null;
	}

	function registerHostRuntimeListeners(
		hostElement: HTMLElement,
		bindings: Array<{
			name: HostRuntimeEventName;
			handler: HostRuntimeEventHandler;
		}>,
	): () => void {
		for (const binding of bindings) {
			hostElement.addEventListener(binding.name, binding.handler);
		}
		return () => {
			for (const binding of bindings) {
				hostElement.removeEventListener(binding.name, binding.handler);
			}
		};
	}

	// Follows the outer runtime this toolkit inherits. The owned-coordinator
	// bootstrap decides ownership first; once it has built an owned coordinator,
	// an outer runtime answering later is reported and ignored, so the
	// coordinator is never swapped under a running section. An inherited runtime
	// republishing its context is followed.
	$effect(() => {
		const currentHost = host;
		const currentIsolation = isolation;
		return untrack(() => {
			if (!currentHost) return;
			if (currentIsolation === "force") {
				inheritedRuntime = null;
				return () => {
					ownsByDecision = false;
				};
			}
			const stop = connectAssessmentToolkitHostRuntimeContext(currentHost, (value) => {
				if (value.runtimeId === runtimeId) return;
				if (ownsByDecision) {
					reportLateOuterRuntime(value.runtimeId);
					return;
				}
				inheritedRuntime = value;
			});
			return () => {
				stop();
				inheritedRuntime = null;
				ownsByDecision = false;
			};
		});
	});

	// Wiring only: the coordinator is the dependency, and the subscription's callback
	// writes no reactive state — it asks the section binding to pause a media port.
	$effect(() => {
		const coordinator = effectiveCoordinator;
		if (!coordinator) return;
		return untrack(() =>
			bindTtsAudioHandoff({
				ttsService: coordinator.getServiceBundle().ttsService,
				listenerId: `timed-media-audio-handoff:${runtimeId}`,
				silence: () => sectionBinding.requestMediaPauseForCompetingAudio(),
			}),
		);
	});

	$effect(() => {
		const parentRuntimeId = inheritsOuterRuntime
			? (inheritedRuntime?.runtimeId ?? null)
			: null;
		const ownership: "owned" | "inherited" = parentRuntimeId ? "inherited" : "owned";
		if (ownership !== lastOwnership) {
			lastOwnership = ownership;
			emit(ownership === "inherited" ? "runtime-inherited" : "runtime-owned", {
				runtimeId,
				parentRuntimeId,
			});
		}
	});

	$effect(() => {
		const currentHost = host;
		if (!currentHost) return;
		untrack(() => watchForUnclaimedRegistrations(currentHost.ownerDocument));
	});

	// Once per coordinator, owned, passed or inherited, with or without a section:
	// the point from which a host can drive the coordinator. `toolkit-ready` stays
	// the section's.
	$effect(() => {
		const coord = effectiveCoordinator;
		if (!coord) return;
		const ownership: "owned" | "inherited" = inheritsOuterRuntime
			? "inherited"
			: "owned";
		untrack(() => {
			if (coord === announcedCoordinator) return;
			announcedCoordinator = coord;
			emit("runtime-ready", { runtimeId, coordinator: coord, ownership });
		});
	});

	$effect(() => {
		const currentSectionId = effectiveSectionId;
		const currentAttemptId = attemptId || "";
		void currentSectionId;
		void currentAttemptId;
		resetSessionEmitPolicyState(sessionEmitPolicyState);
	});

	$effect(() => {
		if (!host) return;
		host.setAttribute("data-item-player-type", effectiveItemPlayer.type);
		host.setAttribute("data-item-player-tag", effectiveItemPlayer.tagName);
		host.setAttribute("data-env-mode", String((effectiveEnv as any)?.mode || ""));
		host.setAttribute("data-env-role", String((effectiveEnv as any)?.role || ""));
	});

	$effect(() => {
		void effectiveCoordinator;
		void effectiveAssessmentId;
		void effectiveSectionId;
		refreshCatalogRegistrations();
		return () => {
			unregisterAllScopedCatalogs();
		};
	});

	$effect(() => {
		if (!host) return;
		return attachInstrumentationEventBridge({
			host,
			instrumentationProvider,
			component: "pie-assessment-toolkit",
			eventMap: TOOLKIT_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "toolkit",
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
				attemptId: attemptId || undefined,
			},
		});
	});

	// Forward the policy inputs (`assessment`, `pnpEnforcement`) to the
	// coordinator this toolkit owns, each only when its own value changes:
	// `policyInputsToForward` keeps a re-run of this effect from resetting a
	// binding the host made on the coordinator. The
	// enforcement mode resolves through `resolvePnpEnforcementInput`, so the
	// embedded path (`runtime.tools.pnpEnforcement`) and the standalone
	// `pnp-enforcement` attribute converge on one call.
	//
	// A coordinator the host passes or shares is never written: its policy
	// inputs are the host's to bind through `coord.updateAssessment(...)`.
	let forwardedPolicyInputs: {
		coordinator: ToolkitCoordinator;
		inputs: ForwardedPolicyInputs;
	} | null = null;
	$effect(() => {
		void assessment;
		void pnpEnforcement;
		void tools;
		const coord = effectiveCoordinator;
		if (!coord) return;
		if (coord !== ownedCoordinator) return;
		untrack(() => {
			const next: ForwardedPolicyInputs = {
				pnpEnforcement: resolvePnpEnforcementInput(pnpEnforcement, tools),
				assessment: assessment ?? null,
			};
			const previous =
				forwardedPolicyInputs?.coordinator === coord
					? forwardedPolicyInputs.inputs
					: null;
			forwardedPolicyInputs = { coordinator: coord, inputs: next };
			for (const key of policyInputsToForward(previous, next)) {
				if (key === "pnpEnforcement") coord.setPnpEnforcement(next.pnpEnforcement);
				else coord.updateAssessment(next.assessment);
			}
		});
	});

	$effect(() => {
		if (!effectiveCoordinator) return;
		return effectiveCoordinator.subscribeTelemetry(({ eventName, payload }) => {
			if (!isInstrumentationProvider(instrumentationProvider)) return;
			if (!instrumentationProvider.isReady()) return;
			// Telemetry event names are prefixed at the emit site in
			// `ToolkitCoordinator.emitTelemetry`. See the JSDoc on that
			// method for the namespace convention. No fallback here.
			const instrumentationEventName = eventName;
			const timestamp = new Date().toISOString();
			const attributes = {
				...(payload || {}),
				instrumentationLayer: "toolkit",
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
				attemptId: attemptId || undefined,
				component: "pie-assessment-toolkit",
				sourceEventName: eventName,
				timestamp,
			} as Record<string, unknown>;
			instrumentationProvider.trackEvent(instrumentationEventName, attributes);
			const payloadErrorType =
				payload && typeof payload.errorType === "string"
					? payload.errorType
					: undefined;
			if (!eventName.endsWith("-error") && !payloadErrorType) return;
			const message =
				payload && typeof payload.message === "string"
					? payload.message
					: `Toolkit telemetry error: ${eventName}`;
			instrumentationProvider.trackError(new Error(message), {
				component: "pie-assessment-toolkit",
				errorType: payloadErrorType || "ToolkitTelemetryError",
				...attributes,
			});
		});
	});

	$effect(() => {
		if (!section || !effectiveCoordinator) return;
		let cancelled = false;
		// The section's controller now lives on the coordinator, and the host
		// receives it from `toolkit-ready`, so an owned one is no longer rebuilt.
		if (effectiveCoordinator === untrack(() => ownedCoordinator)) {
			ownedCoordinatorBinding ??= "a section initialized";
		}

		// Leaving a section commits its pending responses while its elements are
		// mounted and its controller still holds the host's subscriptions: the
		// coordinator detaches those as soon as it starts on the next section.
		const cohort = { sectionId: effectiveSectionId, attemptId: attemptId || undefined };
		const previousCohort = initializedCohort;
		initializedCohort = cohort;
		if (
			previousCohort &&
			(previousCohort.sectionId !== cohort.sectionId ||
				previousCohort.attemptId !== cohort.attemptId)
		) {
			untrack(() => commitPendingSessions(host, { reason: "teardown", logger }));
		}

		resolvedCohort = null;
		const initialSession = untrack(() => takeSessionFor(cohort, true));

		void sectionBinding
			.initialize({
				coordinator: effectiveCoordinator,
				section,
				sectionId: effectiveSectionId,
				assessmentId: effectiveAssessmentId,
				attemptId: attemptId || undefined,
				view: effectiveSectionView,
				initialSession,
				createDefaultController: createDefaultSectionController,
				onCompositionChanged: (nextComposition) => {
					if (cancelled) return;
					emitCompositionChanged(nextComposition);
				},
				onControllerEvent: (event) => {
					if (cancelled) return;
					handleTimedMediaAudioStarted(event);
					reportTimedMediaDiagnostic(event);
				},
			})
			.then(() => {
				if (cancelled) return;
				resolvedCohort = cohort;
				const banner = untrack(() => frameworkErrorModel);
				if (banner && frameworkErrorKey(banner) === sectionFailureBannerKey) {
					clearFrameworkErrorBanner();
				}
				sectionFailureBannerKey = null;
				// A value assigned while the controller was being created.
				untrack(() => assignSessionToController());
				// The section's composition goes out ahead of `section-ready`. A layout
				// that counts readiness from `section-ready` then holds this section's
				// composition, never the previous section's, which it would otherwise
				// hold until the next frame.
				untrack(() => flushPendingComposition());
				// A microtask later, so the layout commits the composition before the
				// ready handlers write: in the same task their writes joined its
				// update, and a host-built layout's items pane never mounted its cards.
				queueMicrotask(() => {
					if (cancelled) return;
					emit("toolkit-ready", {
						runtimeId,
						assessmentId: effectiveAssessmentId,
						sectionId: effectiveSectionId,
						itemPlayer: effectiveItemPlayer,
						coordinator: effectiveCoordinator,
					});
					emit("section-ready", {
						sectionId: cohort.sectionId,
						attemptId: cohort.attemptId,
						controller: effectiveCoordinator.getSectionController(cohort) ?? null,
					});
				});
			})
			.catch((error) => {
				// A rerun or unmount retires the previous controller acquisition.
				// Its rejection is cancellation of obsolete work, not a runtime failure.
				if (cancelled) return;
				// The coordinator has already delivered the failure to the host's
				// section subscriptions, and reported a controller it could not
				// create through this toolkit's bus. The failure is reported once,
				// and the section it took down shows the banner either way.
				const reported = untrack(() => reportedFrameworkErrorFor(error));
				if (reported) {
					untrack(() => showFrameworkErrorBanner(reported));
					sectionFailureBannerKey = frameworkErrorKey(reported);
				} else {
					sectionFailureBannerKey = frameworkErrorKey(
						reportFrameworkError({
							kind: "runtime-init",
							source: "pie-assessment-toolkit",
							error,
							scope: "cohort",
						}),
					);
				}
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		void session;
		untrack(() => {
			noteSession();
			assignSessionToController();
		});
	});

	$effect(() => {
		if (!host) return;
		const localHost = host;
		// The shells' private channel to their runtime. A claimed event goes no
		// further: nothing above the runtime that handles it has a use for it,
		// and hosts would otherwise receive every registration and raw session
		// change on `document`. An event from another runtime's shell keeps
		// bubbling toward the toolkit that owns it, by the id it is addressed to
		// or else by its target.
		const claimLocalEvent = (event: Event): boolean => {
			if (!isRuntimeEventClaimed(event, runtimeId, isLocalToCurrentRuntime)) {
				return false;
			}
			event.stopPropagation();
			return true;
		};
		const bindings: Array<{
			name: HostRuntimeEventName;
			handler: HostRuntimeEventHandler;
		}> = [
			{
				name: PIE_REGISTER_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<RuntimeRegistrationDetail>(event);
					if (!detail?.element || !detail?.itemId) return;
					const changed = sectionBinding.register(detail);
					runtimeRegistrationDetails.set(detail.element, detail);
					contentRegistered = true;
					registerCatalogsForDetail(detail);
					nameMathInControls(detail.element);
					sectionBinding.handleContentRegistered(detail);
					if (changed) emitCompositionChanged();
				},
			},
			{
				name: PIE_UNREGISTER_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<RuntimeRegistrationDetail>(event);
					if (!detail?.itemId) return;
					const changed = detail?.element
						? sectionBinding.unregister(detail.element)
						: false;
					unregisterCatalogsForElement(detail.element);
					stopNamingMath(detail.element);
					if (detail.element) {
						runtimeRegistrationDetails.delete(detail.element);
					}
					sectionBinding.handleContentUnregistered(detail);
					if (changed) emitCompositionChanged();
				},
			},
			{
				name: PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<InternalItemSessionChangedDetail>(event);
					if (!detail?.itemId) return;
					const result = sectionBinding.updateItemSession(detail.itemId, detail.session);
					emitNormalizedSessionChanged({
						itemId: detail.itemId,
						canonicalItemId: sectionBinding.getCanonicalItemId(detail.itemId),
						result,
						fallbackSession: detail.session,
					});
				},
			},
			{
				name: PIE_INTERNAL_CONTENT_LOADED_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<InternalContentLoadedDetail>(event);
					if (!detail?.itemId) return;
					sectionBinding.handleContentLoaded({
						itemId: detail.itemId,
						canonicalItemId: detail.canonicalItemId,
						contentKind: detail.contentKind,
						detail: detail.detail,
						timestamp: Date.now(),
					});
				},
			},
			{
				name: PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<InternalItemPlayerErrorDetail>(event);
					if (!detail?.itemId) return;
					sectionBinding.handleItemPlayerError({
						itemId: detail.itemId,
						canonicalItemId: detail.canonicalItemId,
						contentKind: detail.contentKind,
						error: detail.error,
						timestamp: Date.now(),
					});
				},
			},
			{
				// A learner's check / retry. The card supplies the outcomes it got
				// from `provideScore()`; the controller derives correctness, so the
				// route carries data rather than a decision.
				name: PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<InternalFormativeActionDetail>(event);
					if (!detail?.itemId) return;
					if (detail.action !== "check" && detail.action !== "retry") return;
					sectionBinding.handleFormativeAction({
						itemId: detail.canonicalItemId || detail.itemId,
						action: detail.action,
						outcomes: detail.outcomes,
					});
				},
			},
			{
				// The one route media reaches the section by. The stimulus card sends a
				// native `<video>` adapter; a host wrapping its own player sends its own
				// port through the same event.
				name: PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT,
				handler: (event: Event) => {
					if (!claimLocalEvent(event)) return;
					const detail = getEventDetail<InternalMediaTimeSourceDetail>(event);
					if (!detail?.renderableId) return;
					if (detail.action !== "attach" && detail.action !== "detach") return;
					sectionBinding.handleMediaTimeSource({
						renderableId: detail.renderableId,
						action: detail.action,
						source: detail.source,
						origin: detail.origin,
					});
				},
			},
		];
		const unregisterListeners = registerHostRuntimeListeners(localHost, bindings);
		return () => {
			unregisterListeners();
			for (const element of [...mathNameObservers.keys()]) stopNamingMath(element);
		};
	});

	// One provider per context for the host's lifetime: created with the first
	// value, republished with `setValue` after that, and left on the last value
	// while there is none. A consumer keeps the provider that answered it and
	// nothing asks it to request again, so a replaced provider would leave its
	// subscribers on a value that never updates. These effects come after the
	// claim listeners above: connecting announces the provider, the document's
	// context root replays the shells' requests, and their registrations
	// arrive while the provider connects.
	$effect(() => {
		if (!host) return;
		return () => {
			hostRuntimeProvider?.disconnect();
			hostRuntimeProvider = null;
			provider?.disconnect();
			provider = null;
		};
	});

	$effect(() => {
		const currentHost = host;
		const value = hostRuntimeContextValue;
		if (!currentHost || !value) return;
		untrack(() => {
			if (hostRuntimeProvider) {
				hostRuntimeProvider.setValue(value);
				return;
			}
			hostRuntimeProvider = new ContextProvider(currentHost, {
				context: assessmentToolkitHostRuntimeContext,
				initialValue: value,
			});
			hostRuntimeProvider.connect();
		});
	});

	$effect(() => {
		const currentHost = host;
		const value = runtimeContextValue;
		if (!currentHost || !value) return;
		untrack(() => {
			if (provider) {
				provider.setValue(value);
				return;
			}
			provider = new ContextProvider(currentHost, {
				context: assessmentToolkitRuntimeContext,
				initialValue: value,
			});
			provider.connect();
		});
	});

	export async function waitUntilReady(): Promise<void> {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		await effectiveCoordinator.waitUntilReady();
	}

	export function getServiceBundle() {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		return effectiveCoordinator.getServiceBundle();
	}

	export function setHooks(hooks: Record<string, unknown>): void {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		effectiveCoordinator.setHooks(hooks as any);
	}

	export function navigateToItem(index: number): unknown {
		return sectionBinding.navigateToItem(index);
	}

	export function getCompositionModel(): unknown {
		return sectionBinding.getCompositionModel();
	}

	export function getItemPlayerConfig(): ItemPlayerConfig {
		return effectiveItemPlayer;
	}

	export async function persist(): Promise<void> {
		await sectionBinding.persist();
	}

	export async function hydrate(): Promise<void> {
		await sectionBinding.hydrate();
	}

	// The coordinator starts at the toolkit's first content: its section's first
	// composition, or without a section the first item that registers. One that
	// started at construction would start text-to-speech, and report its
	// failures, before there is anything to read. Readiness failures reach hosts
	// as framework errors.
	$effect(() => {
		const coord = effectiveCoordinator;
		if (!coord) return;
		const composed = compositionVersion > 0 || compositionModel !== null;
		const sectionlessContent = !hasSection && contentRegistered;
		if (!composed && !sectionlessContent) return;
		untrack(() => {
			if (coord === startedCoordinator) return;
			startedCoordinator = coord;
			void coord.waitUntilReady().catch(() => {});
		});
	});

	$effect(() => {
		return () => {
			compositionEmitScheduler.cancel();
			void sectionBinding
				.dispose()
				.catch((error) => {
					reportFrameworkError({
						kind: "runtime-dispose",
						source: "pie-assessment-toolkit",
						error,
						recoverable: true,
					});
				})
				.then(() => releaseOwnedCoordinator())
				.catch(reportOwnedCoordinatorDisposeError)
				.finally(() => {
					frameworkErrorBus.dispose();
				});
		};
	});
</script>

<div bind:this={anchor} class="pie-assessment-toolkit-anchor" aria-hidden="true"></div>
{#if frameworkErrorModel && !frameworkErrorModel.recoverable}
	<div class="pie-assessment-toolkit-error" role="alert" aria-live="assertive">
		<div class="pie-assessment-toolkit-error-title">{frameworkErrorTitle}</div>
		<div class="pie-assessment-toolkit-error-message">{frameworkErrorModel.message}</div>
		<pre class="pie-assessment-toolkit-error-details">{frameworkErrorDetails.join("\n")}</pre>
	</div>
{:else}
	<slot></slot>
{/if}

<style>
	.pie-assessment-toolkit-anchor {
		display: none;
	}

	.pie-assessment-toolkit-error {
		margin: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid
			color-mix(in srgb, var(--pie-incorrect-icon, #dc2626) 40%, transparent);
		background: color-mix(in srgb, var(--pie-incorrect-icon, #dc2626) 12%, transparent);
		color: var(--pie-incorrect, #7f1d1d);
		font-size: 0.9rem;
	}

	.pie-assessment-toolkit-error-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.pie-assessment-toolkit-error-message {
		margin-bottom: 0.5rem;
	}

	.pie-assessment-toolkit-error-details {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
