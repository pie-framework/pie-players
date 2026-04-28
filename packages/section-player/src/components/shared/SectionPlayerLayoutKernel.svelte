<script lang="ts">
	import {
		createPieLogger,
		isGlobalDebugEnabled,
	} from "@pie-players/pie-players-shared";
	import type {
		ToolRegistry,
		ToolbarItem,
		ToolConfigStrictness,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		SECTION_RUNTIME_ENGINE_KEY,
		SectionRuntimeEngine,
		sectionRuntimeEngineHostContext,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import { ContextProvider } from "@pie-players/pie-context";
	import {
		FrameworkErrorBus,
		cohortsEqual,
		makeCohort,
		type EngineReadinessSignals,
	} from "@pie-players/pie-assessment-toolkit/runtime/internal";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, setContext, untrack } from "svelte";
	import type {
		SectionPlayerNavigationSnapshot,
		SectionPlayerSnapshot,
	} from "../../contracts/runtime-host-contract.js";
	import {
		DEFAULT_SECTION_PLAYER_POLICIES,
		isPreloadEnabled,
	} from "../../policies/index.js";
	import type { FrameworkErrorModel } from "@pie-players/pie-assessment-toolkit";
	import type { SectionPlayerPolicies } from "../../policies/types.js";
	import { createPlayerAction } from "./player-action.js";
	import {
		type LayoutCompositionSnapshot,
		deriveLayoutCompositionSnapshot,
		getCompositionSnapshotFromEvent,
	} from "./section-player-view-state.js";
	import { EMPTY_COMPOSITION } from "./composition.js";
	import { resolveSectionPlayerRuntimeState } from "./section-player-host-runtime.js";
	import type {
		RuntimeConfig,
		StageChangeHandler,
		LoadingCompleteHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/internal";
	import { attachRuntimeCallbackBridge } from "./section-player-runtime-callbacks.js";
	import type { SectionPlayerCardRenderContext } from "./section-player-card-context.js";
	import { coerceBooleanLike } from "./section-player-props.js";
	import { createReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/internal";
	import SectionPlayerLayoutScaffold from "./SectionPlayerLayoutScaffold.svelte";
	import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";

	type PlayerActionConfig = {
		stateKey: string;
		includeSessionRefInState?: boolean;
	};

	type KernelEvents = {
		// Non-engine Svelte events the kernel still dispatches up to the
		// hosting layout CE. The legacy readiness vocabulary
		// (`readiness-change` / `interaction-ready` / `ready`) and the
		// canonical M6 vocabulary (`pie-stage-change` /
		// `pie-loading-complete`) are no longer dispatched here — the
		// section runtime engine bridges those onto DOM events fired
		// directly on the layout CE host (post-M7 PR 5). Same for
		// `framework-error`: the engine's DOM event bridge owns it.
		"runtime-owned": Record<string, unknown>;
		"runtime-inherited": Record<string, unknown>;
		"session-changed": Record<string, unknown>;
		"composition-changed": { composition: unknown };
		"section-controller-ready": {
			sectionId: string;
			attemptId?: string;
			controller: unknown;
		};
		"element-preload-retry": Record<string, unknown>;
		"element-preload-error": Record<string, unknown>;
	};

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		playerType,
		player,
		lazyInit,
		tools,
		accessibility,
		coordinator,
		env,
		iifeBundleHost,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
		toolConfigStrictness = "error" as ToolConfigStrictness,
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		debug = undefined as string | boolean | undefined,
		playerActionConfig = {
			stateKey: "__sectionPlayerAppliedParams",
			includeSessionRefInState: false,
		} satisfies PlayerActionConfig,
		policies = DEFAULT_SECTION_PLAYER_POLICIES as SectionPlayerPolicies,
		hooks = undefined as SectionPlayerHostHooks | undefined,
		onFrameworkError = undefined as
			| undefined
			| ((model: FrameworkErrorModel) => void),
		// M6 canonical stage-change callback. The DOM event
		// `pie-stage-change` remains the canonical channel; this
		// callback runs at the same emit point so hosts that prefer
		// callback-style wiring stay in lockstep with the event. Per
		// the strict mirror rule, `runtime.onStageChange` wins; the
		// resolved handler arrives via `runtimeState.effectiveRuntime`.
		onStageChange = undefined as StageChangeHandler | undefined,
		// M6 canonical loading-complete callback. Mirrors the
		// `pie-loading-complete` DOM event one-to-one; invoked at the
		// same dispatch point so the event and the callback fire in
		// lockstep for the same cohort. Resolved through the runtime
		// (`runtime.onLoadingComplete` wins over the top-level prop)
		// so any host channel reaches the same effective handler.
		onLoadingComplete = undefined as LoadingCompleteHandler | undefined,
		// `sourceCe` is the host layout CE's tag name (without the
		// `--version-<encoded>` suffix) used to label `pie-stage-change`
		// emissions. Each layout CE that mounts the kernel passes its own
		// canonical tag name; defaults to `pie-section-player` so kernel
		// instantiations in tests/demos still produce well-formed events.
		sourceCe = "pie-section-player" as string,
		// Host element on which the section runtime engine should
		// dispatch its DOM events (`pie-stage-change`,
		// `pie-loading-complete`, `framework-error`, and the legacy
		// readiness aliases). Each layout CE that mounts the kernel
		// passes its own host element (`this`); defaults to `null` so
		// the kernel keeps mounting before the layout CE has resolved
		// its host. The engine attaches lazily once `host` is non-null.
		host = null as HTMLElement | null,
	} = $props();

	const dispatch = createEventDispatcher<KernelEvents>();
	const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
	const debugEnabled = $derived.by(() => {
		if (debug !== undefined && debug !== null) {
			const debugStr = String(debug);
			const debugValue = !(
				debugStr.toLowerCase() === "false" ||
				debugStr === "0" ||
				debugStr === ""
			);
			if (isBrowser) {
				try {
					(window as any).PIE_DEBUG = debugValue;
				} catch {}
			}
			return debugValue;
		}
		return isGlobalDebugEnabled();
	});
	const logger = createPieLogger("section-player-layout-kernel", () => debugEnabled);
	let compositionSnapshot = $state<LayoutCompositionSnapshot>(
		deriveLayoutCompositionSnapshot(EMPTY_COMPOSITION),
	);
	let paneElementsLoaded = $state(false);
	let scaffoldRef = $state<{
		navigateToItem?: (index: number) => boolean;
		getCompositionModelSnapshot?: () => unknown;
		getSectionController?: () => SectionControllerHandle | null;
		waitForSectionController?: (
			timeoutMs?: number,
		) => Promise<SectionControllerHandle | null>;
		getNavigationStateSnapshot?: () => SectionPlayerNavigationSnapshot;
		focusStart?: () => boolean;
	} | null>(null);
	let sectionReady = $state(false);
	let runtimeErrorState = $state(false);
	let sectionControllerReadyDispatched = $state(false);

	// M7 PR 5: own a section runtime engine + framework-error bus per
	// kernel mount. The engine drives stage progression, readiness
	// emission, and `pie-loading-complete` directly via DOM events on
	// the layout CE host (passed in as `host` once the layout CE has
	// resolved its self-element). The kernel feeds the engine reactive
	// inputs from a single tracked `$effect` wrapped in `untrack`.
	//
	// Construction is cheap and side-effect free; `attachHost` is the
	// step that actually wires the adapter (DOM/legacy/framework-error
	// bridges). We construct here so the engine reference is stable for
	// `setContext` and so `getRuntimeId()` returns the canonical id used
	// downstream (e.g. for the `runtimeId` field in event details).
	const frameworkErrorBus = new FrameworkErrorBus();
	const engine = new SectionRuntimeEngine();

	// Provide the engine to descendant Svelte components via the
	// canonical Svelte context key. This reaches in-tree consumers
	// (descendants in the same shadow root) but does not cross the
	// custom-element boundary into the toolkit CE.
	setContext(SECTION_RUNTIME_ENGINE_KEY, engine);

	// M7 PR 6: cross-CE bridge to the wrapped toolkit. The toolkit CE
	// renders inside its own shadow root and reaches the engine through
	// a `pie-context` handshake on the layout CE host. We install the
	// `ContextProvider` once the layout CE host is available and
	// disconnect on unmount; the consumer is on the toolkit side and
	// uses `connectSectionRuntimeEngineHostContext`. Standalone
	// toolkits never see this provider and continue using their own
	// engine.
	let engineHostProvider: ContextProvider<
		typeof sectionRuntimeEngineHostContext
	> | null = null;

	// Non-reactive bookkeeping for the engine-driver effect. `attached`
	// gates the very first `attachHost` (per cohort the adapter handles
	// host swaps idempotently via `setHost`); `lastCohort` is the
	// previously-dispatched cohort we compare against with
	// `cohortsEqual` so we differentiate first-time `initialize`,
	// no-op (same cohort), `update-runtime` (same cohort, runtime
	// changed), and `cohort-change` (rolled over). Mutated only inside
	// `untrack(...)` so they never appear as tracked deps of the
	// effect that maintains them.
	let attached = false;
	let lastCohort: ReturnType<typeof makeCohort> = null;

	const compositionModel = $derived(compositionSnapshot.compositionModel);
	const passages = $derived(compositionSnapshot.passages);
	const items = $derived(compositionSnapshot.items);
	const preloadedRenderables = $derived(compositionSnapshot.renderables);
	const preloadedRenderablesSignature = $derived(
		compositionSnapshot.renderablesSignature,
	);
	const runtimeState = $derived.by(() =>
		resolveSectionPlayerRuntimeState({
			assessmentId,
			playerType,
			player,
			lazyInit,
			tools,
			accessibility,
			coordinator,
			env,
			runtime,
			enabledTools,
			itemToolbarTools,
			passageToolbarTools,
			toolConfigStrictness,
			onFrameworkError,
			onStageChange,
			onLoadingComplete,
		}),
	);
	const effectiveRuntime = $derived(runtimeState.effectiveRuntime);
	const effectiveToolsConfig = $derived(runtimeState.effectiveToolsConfig);
	const playerRuntime = $derived(runtimeState.playerRuntime);
	const resolvedPlayerDefinition = $derived(playerRuntime.resolvedPlayerDefinition);
	const resolvedPlayerTag = $derived(playerRuntime.resolvedPlayerTag);
	const resolvedPlayerAttributes = $derived(playerRuntime.resolvedPlayerAttributes);
	const resolvedPlayerProps = $derived(playerRuntime.resolvedPlayerProps);
	const effectiveResolvedPlayerProps = $derived.by(() => {
		if (debug === undefined || debug === null) return resolvedPlayerProps;
		return {
			...(resolvedPlayerProps || {}),
			debug,
		};
	});
	const resolvedPlayerEnv = $derived(playerRuntime.resolvedPlayerEnv);
	const playerStrategy = $derived(playerRuntime.strategy);
	const playerAction = $derived.by(() => createPlayerAction(playerActionConfig));
	const effectiveCardTitleFormatter = $derived(hooks?.cardTitleFormatter);
	const cardRenderContextValue = $derived.by(
		(): SectionPlayerCardRenderContext => ({
			resolvedPlayerTag,
			playerAction,
			cardTitleFormatter: effectiveCardTitleFormatter,
		}),
	);
	const normalizedShowToolbar = $derived(coerceBooleanLike(showToolbar, false));
	const preloadEnabled = $derived(isPreloadEnabled(policies));
	const readinessDetail = $derived.by(() =>
		createReadinessDetail({
			mode: policies.readiness.mode,
			signals: {
				sectionReady,
				interactionReady: sectionReady,
				allLoadingComplete: paneElementsLoaded,
				runtimeError: runtimeErrorState,
			},
			reason: `policy:${policies.readiness.mode}`,
		}),
	);

	function handleBaseCompositionChanged(event: Event) {
		compositionSnapshot = getCompositionSnapshotFromEvent(event);
		dispatch("composition-changed", (event as CustomEvent<{ composition: unknown }>).detail);
	}

	function handleItemsPaneElementsLoaded(event: Event) {
		const detail = (event as CustomEvent<{ elementsLoaded?: unknown }>).detail;
		paneElementsLoaded = detail?.elementsLoaded === true;
	}

	function handleItemsPanePreloadRetry(event: Event) {
		const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
		dispatch(
			"element-preload-retry",
			{
				...detail,
				assessmentId,
				sectionId,
				attemptId: attemptId || undefined,
			},
		);
	}

	function handleItemsPanePreloadError(event: Event) {
		const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
		dispatch(
			"element-preload-error",
			{
				...detail,
				assessmentId,
				sectionId,
				attemptId: attemptId || undefined,
			},
		);
	}

	function handleSectionReady(_event: Event) {
		sectionReady = true;
	}

	function handleFrameworkError(event: Event) {
		const detail = (event as CustomEvent<FrameworkErrorModel>).detail;
		runtimeErrorState = true;
		// Route the framework-error model into the section runtime
		// engine so the engine's framework-error / DOM-event bridges
		// fan out a `framework-error` DOM event on the layout CE host.
		// The legacy kernel-side `dispatch("framework-error", detail)`
		// Svelte event has been dropped: the engine's bridge is the
		// only kernel-side emit point. The wrapped
		// `<pie-assessment-toolkit>` continues to dispatch its own
		// `framework-error` (with `bubbles: true, composed: true`)
		// during the M7 migration window; that bubbled event reaches
		// outside listeners on the layout CE host as a second emit.
		// PR 6 deliberately preserves this dual-emit (the toolkit's
		// own `frameworkErrorBus → DOM emit` is unchanged in PR 6
		// scope and the kernel intentionally re-feeds the bubbled
		// detail into its engine here so `engine.dispatchInput` is
		// the canonical kernel-side input source) — collapsing the
		// dual emit is deferred to a later PR with an idempotency /
		// dedup latch on the layout CE host. Outside listeners
		// already see two emits today; PR 6 does not change that.
		// `onFrameworkError` itself is still delivered exactly once by
		// the underlying `pie-assessment-toolkit` (two-tier precedence:
		// `runtime.onFrameworkError` wins; resolution happens in
		// `resolveRuntime`); the kernel intentionally does not invoke
		// any handler here to avoid double-firing.
		//
		// PR 7 follow-up (R3-#3): The dual-emit count, ordering, and
		// detail-equality contract is pinned by
		// `tests/section-player-framework-error-dual-emit.test.ts`.
		// When PR 8+ collapses the dual emit, that test flips to
		// assert the single canonical emit (and the bubbled-toolkit
		// branch is removed from this comment).
		if (!detail) return;
		engine.dispatchInput({ kind: "framework-error", error: detail });
	}

	function handleSessionChanged(event: Event) {
		dispatch("session-changed", (event as CustomEvent<Record<string, unknown>>).detail || {});
	}

	function handleRuntimeOwned(event: Event) {
		dispatch("runtime-owned", (event as CustomEvent<Record<string, unknown>>).detail || {});
	}

	function handleRuntimeInherited(event: Event) {
		dispatch("runtime-inherited", (event as CustomEvent<Record<string, unknown>>).detail || {});
	}

	function notifySectionControllerResolved(controller: SectionControllerHandle) {
		// Two emit channels for the same event: the engine FSM (for
		// stage progression `booting-section → engine-ready`) and the
		// kernel-level Svelte event consumed by layout CEs (which
		// re-emit it as a DOM event). Both are kept idempotent by the
		// `sectionControllerReadyDispatched` latch; the latch is reset
		// in the engine-driver `$effect` whenever the cohort rolls.
		engine.dispatchInput({ kind: "section-controller-resolved" });
		dispatch("section-controller-ready", {
			sectionId,
			attemptId: attemptId || undefined,
			controller,
		});
	}

	async function emitSectionControllerReadyIfNeeded() {
		if (sectionControllerReadyDispatched) return;
		const controller = await scaffoldRef?.waitForSectionController?.(2500);
		if (!controller) return;
		sectionControllerReadyDispatched = true;
		notifySectionControllerResolved(controller);
	}

	function handleToolkitReady(_event: Event) {
		void emitSectionControllerReadyIfNeeded();
	}

	function getNavigationState(): SectionPlayerNavigationSnapshot {
		return (
			scaffoldRef?.getNavigationStateSnapshot?.() || {
				currentIndex: 0,
				totalItems: items.length,
				canNext: items.length > 1,
				canPrevious: false,
				currentItemId: items[0]?.id || undefined,
			}
		);
	}

	export function getSnapshot(): SectionPlayerSnapshot {
		return {
			readiness: readinessDetail,
			composition: {
				itemsCount: items.length,
				passagesCount: passages.length,
			},
			navigation: getNavigationState(),
		};
	}

	export function selectComposition(): SectionPlayerSnapshot["composition"] {
		return {
			itemsCount: items.length,
			passagesCount: passages.length,
		};
	}

	export function selectNavigation(): SectionPlayerNavigationSnapshot {
		return getNavigationState();
	}

	export function selectReadiness() {
		return readinessDetail;
	}

	export function navigateTo(index: number): boolean {
		return scaffoldRef?.navigateToItem?.(index) === true;
	}

	export function navigateNext(): boolean {
		const navigation = getNavigationState();
		if (!navigation.canNext) return false;
		return navigateTo(navigation.currentIndex + 1);
	}

	export function navigatePrevious(): boolean {
		const navigation = getNavigationState();
		if (!navigation.canPrevious) return false;
		return navigateTo(navigation.currentIndex - 1);
	}

	export function focusStart(): boolean {
		return scaffoldRef?.focusStart?.() === true;
	}

	export function getSectionController(): SectionControllerHandle | null {
		const controller = scaffoldRef?.getSectionController?.() || null;
		if (controller && !sectionControllerReadyDispatched) {
			sectionControllerReadyDispatched = true;
			notifySectionControllerResolved(controller);
		}
		return controller;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		const controller = await scaffoldRef?.waitForSectionController?.(timeoutMs);
		if (controller && !sectionControllerReadyDispatched) {
			sectionControllerReadyDispatched = true;
			notifySectionControllerResolved(controller);
		}
		return controller || null;
	}

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error: unknown) => {
			logger.error("Failed to load item player component:", error);
		});
	});

	// Cross-CE engine context provider (M7 PR 6). Connects when the
	// layout CE host is available; disconnects on unmount. The provider
	// value carries this kernel's engine reference so the wrapped
	// toolkit CE can route legacy controller-side calls (`register`,
	// `handleContent*`, `initialize`) and FSM input dispatch
	// (`framework-error`) through the same engine instance the kernel
	// has already attached and is driving.
	$effect(() => {
		if (!host) return;
		engineHostProvider = new ContextProvider(host, {
			context: sectionRuntimeEngineHostContext,
			initialValue: { engine },
		});
		engineHostProvider.connect();
		return () => {
			engineHostProvider?.disconnect();
			engineHostProvider = null;
		};
	});

	// Primary engine-driver effect (M7 PR 5). Replaces the legacy
	// stage-tracker / cohort-change / readiness emit chain. Reads every
	// host-side input the engine cares about so Svelte tracks them as
	// deps; performs the actual `attachHost` / `dispatchInput` calls
	// inside `untrack` so the writes to the (non-reactive) `attached`
	// and `lastCohort` flags do not feed back into this effect.
	//
	// Flow per run:
	//   1. Bail until a host element is available; the layout CE
	//      passes `host = this` after its first render, so this effect
	//      remains a no-op on the very first mount tick.
	//   2. `attachHost` once per `host` reference. The adapter handles
	//      host swaps via `setHost` internally; calling `attachHost`
	//      again with a fresh host updates it without rebuilding the
	//      adapter, which is exactly the post-layout-swap contract.
	//   3. Decide which input to dispatch:
	//        - first cohort                 → `initialize`
	//        - new cohort                   → `cohort-change` (engine
	//                                         emits `disposed` for the
	//                                         outgoing cohort and
	//                                         re-arms latches for the
	//                                         new one)
	//        - same cohort                  → `update-runtime` so the
	//                                         engine records the
	//                                         latest resolver output
	//        - cohort cleared (non-empty
	//          → empty, e.g. host clears
	//          `sectionId` while still
	//          mounted)                     → no-op. Pre-PR-5 the
	//                                         legacy stage tracker
	//                                         emitted `disposed` here;
	//                                         the engine path
	//                                         intentionally does not.
	//                                         Hosts that need a
	//                                         `disposed` for the
	//                                         outgoing cohort should
	//                                         unmount the layout CE,
	//                                         which routes through the
	//                                         cleanup `$effect` below
	//                                         and dispatches `dispose`
	//                                         to the engine.
	//        - no cohort                    → no-op (engine stays in
	//                                         `idle`)
	//      On any cohort rollover the local
	//      `sectionControllerReadyDispatched` latch is also reset so
	//      `notifySectionControllerResolved` will fire once for the
	//      next cohort.
	//   4. While a cohort is active, push the latest readiness signals
	//      so the engine can re-derive `EngineReadinessDetail`,
	//      advance the phase to `interactive`, and emit
	//      `loading-complete` exactly once per cohort.
	$effect(() => {
		void host;
		void sectionId;
		void attemptId;
		void effectiveRuntime;
		void effectiveToolsConfig;
		void items.length;
		void sectionReady;
		void paneElementsLoaded;
		void runtimeErrorState;
		void policies.readiness.mode;
		untrack(() => {
			if (!host) return;
			engine.attachHost({
				host,
				sourceCe,
				frameworkErrorBus,
			});
			attached = true;

			const nextCohort = makeCohort({ sectionId, attemptId });
			const itemCount = items.length;

			if (!cohortsEqual(lastCohort, nextCohort)) {
				sectionControllerReadyDispatched = false;
				if (nextCohort) {
					if (lastCohort === null) {
						engine.dispatchInput({
							kind: "initialize",
							cohort: nextCohort,
							effectiveRuntime,
							effectiveToolsConfig,
							itemCount,
						});
					} else {
						engine.dispatchInput({
							kind: "cohort-change",
							cohort: nextCohort,
							effectiveRuntime,
							effectiveToolsConfig,
							itemCount,
						});
					}
				}
				lastCohort = nextCohort;
			} else if (nextCohort !== null) {
				engine.dispatchInput({
					kind: "update-runtime",
					effectiveRuntime,
					effectiveToolsConfig,
				});
			}

			if (lastCohort !== null) {
				const signals: EngineReadinessSignals = {
					sectionReady,
					interactionReady: sectionReady,
					allLoadingComplete: paneElementsLoaded,
					runtimeError: runtimeErrorState,
				};
				engine.dispatchInput({
					kind: "update-readiness-signals",
					signals,
					loadedCount: itemCount,
					itemCount,
					mode: policies.readiness.mode,
				});
			}
		});
	});

	// Lockstep runtime callback invocation. The engine's DOM event
	// bridge fires `pie-stage-change` / `pie-loading-complete` directly
	// on the layout CE host; the helper attaches matching listeners so
	// `runtime.onStageChange` / `runtime.onLoadingComplete` fire at the
	// exact same point as the canonical event for the cohort. Lookups
	// read `effectiveRuntime` lazily (handler scope, not reactive
	// scope) so prop reassigns mid-cohort still reach the freshest
	// handler. Extracted to a helper so unit tests can exercise the
	// contract directly with a real `SectionRuntimeEngine`; see
	// `tests/section-player-runtime-callbacks.test.ts`.
	$effect(() => {
		if (!host) return;
		return attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () =>
				effectiveRuntime?.onStageChange as
					| StageChangeHandler
					| undefined,
			getOnLoadingComplete: () =>
				effectiveRuntime?.onLoadingComplete as
					| LoadingCompleteHandler
					| undefined,
			onError: (channel, error) => {
				logger.error(`${channel} handler threw`, error);
			},
		});
	});

	// Tear down the engine + framework-error bus on unmount. Dispatch a
	// `dispose` input first so the engine emits `disposed` for the
	// active cohort through the same DOM/legacy bridges as every other
	// stage transition; then run the async adapter teardown (the
	// promise is fire-and-forget — Svelte cleanup paths cannot await).
	$effect(() => {
		return () => {
			untrack(() => {
				if (attached) {
					engine.dispatchInput({ kind: "dispose" });
				}
				engine.dispose().catch((error: unknown) => {
					logger.error("engine.dispose() failed", error);
				});
				frameworkErrorBus.dispose();
			});
		};
	});
</script>

<SectionPlayerLayoutScaffold
	bind:this={scaffoldRef}
	runtime={effectiveRuntime}
	{section}
	sectionId={sectionId}
	attemptId={attemptId}
	onCompositionChanged={handleBaseCompositionChanged}
	onSectionReady={handleSectionReady}
	onFrameworkErrorEvent={handleFrameworkError}
	onSessionChanged={handleSessionChanged}
	onRuntimeOwned={handleRuntimeOwned}
	onRuntimeInherited={handleRuntimeInherited}
	onToolkitReady={handleToolkitReady}
	showToolbar={normalizedShowToolbar}
	toolbarPosition={toolbarPosition}
	enabledTools={enabledTools}
	{toolRegistry}
	{sectionHostButtons}
	focusPolicy={policies.focus}
	cardRenderContext={cardRenderContextValue}
>
	<slot
		layoutModel={{
			compositionModel,
			passages,
			items,
			preloadedRenderables,
			preloadedRenderablesSignature,
			resolvedPlayerEnv,
			resolvedPlayerAttributes,
			resolvedPlayerProps: effectiveResolvedPlayerProps,
			playerStrategy,
			iifeBundleHost,
			paneElementsLoaded,
			toolRegistry,
			itemHostButtons,
			passageHostButtons,
			readinessDetail,
			preloadEnabled,
			onItemsPaneElementsLoaded: handleItemsPaneElementsLoaded,
			onItemsPanePreloadRetry: handleItemsPanePreloadRetry,
			onItemsPanePreloadError: handleItemsPanePreloadError,
		}}
		{compositionModel}
		{passages}
		{items}
		{preloadedRenderables}
		{preloadedRenderablesSignature}
		{resolvedPlayerEnv}
		{resolvedPlayerAttributes}
		resolvedPlayerProps={effectiveResolvedPlayerProps}
		{playerStrategy}
		{iifeBundleHost}
		{paneElementsLoaded}
		{toolRegistry}
		{itemHostButtons}
		{passageHostButtons}
		{readinessDetail}
		{preloadEnabled}
		onItemsPaneElementsLoaded={handleItemsPaneElementsLoaded}
		onItemsPanePreloadRetry={handleItemsPanePreloadRetry}
		onItemsPanePreloadError={handleItemsPanePreloadError}
	></slot>
</SectionPlayerLayoutScaffold>
