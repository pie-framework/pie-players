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
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, untrack } from "svelte";
	import type { SectionPlayerReadinessChangeDetail } from "../../contracts/public-events.js";
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
	import type {
		LoadingCompleteDetail,
		StageChangeDetail,
	} from "../../contracts/stages.js";
	import { createPlayerAction } from "./player-action.js";
	import {
		type LayoutCompositionSnapshot,
		deriveLayoutCompositionSnapshot,
		getCompositionSnapshotFromEvent,
	} from "./section-player-view-state.js";
	import { EMPTY_COMPOSITION } from "./composition.js";
	import {
		resolveSectionPlayerRuntimeState,
		type RuntimeConfig,
		type StageChangeHandler,
		type LoadingCompleteHandler,
	} from "./section-player-runtime.js";
	import type { SectionPlayerCardRenderContext } from "./section-player-card-context.js";
	import { coerceBooleanLike } from "./section-player-props.js";
	import { createReadinessDetail } from "./section-player-readiness.js";
	import { createStageTracker } from "./section-player-stage-tracker.js";
	import SectionPlayerLayoutScaffold from "./SectionPlayerLayoutScaffold.svelte";
	import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";

	function createSectionPlayerRuntimeId(): string {
		return `section-player-${Math.random().toString(16).slice(2)}-${Date.now()}`;
	}

	type PlayerActionConfig = {
		stateKey: string;
		includeSessionRefInState?: boolean;
	};

	type KernelEvents = {
		"readiness-change": SectionPlayerReadinessChangeDetail;
		"interaction-ready": SectionPlayerReadinessChangeDetail;
		ready: SectionPlayerReadinessChangeDetail;
		"framework-error": Record<string, unknown>;
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
		// Canonical M6 readiness vocabulary. Layout CEs forward these as the
		// `pie-stage-change` and `pie-loading-complete` DOM events; legacy
		// readiness aliases above keep dual-emitting through one major.
		"pie-stage-change": StageChangeDetail;
		"pie-loading-complete": LoadingCompleteDetail;
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
		createSectionController,
		isolation,
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
	let interactionReadyDispatched = $state(false);
	let finalReadyDispatched = $state(false);
	let runtimeErrorState = $state(false);
	let sectionControllerReadyDispatched = $state(false);

	// Per-cohort latches for the canonical stage progression. Without
	// these, the progression `$effect` would call `stageTracker.enter()`
	// every time any of its tracked dependencies updates, and the
	// tracker's duplicate-detection warning would fire on every
	// re-entry. The latches reset in the cohort-change handler so each
	// cohort sees exactly one `entered` per stage.
	let composedStageEntered = false;
	let engineReadyStageEntered = false;
	let interactiveStageEntered = false;

	// M6 canonical stage tracker. One tracker per kernel mount; cohort
	// resets on `(sectionId, attemptId)` change emit `disposed` for the
	// outgoing cohort and re-arm from `composed` for the incoming one.
	// Post-retro the canonical list is `composed → engine-ready →
	// interactive → disposed` (matching the toolkit CE shape). Initial
	// seed values are captured via `untrack` because the tracker
	// explicitly absorbs subsequent cohort changes through `reset()`,
	// not through prop reactivity at construction time. The tracker's
	// `emit` resolves `onStageChange` from the effective runtime at
	// emit time so the callback and the DOM event stay in lockstep
	// without ever firing against a stale handler reference.
	const runtimeId = createSectionPlayerRuntimeId();
	const stageTracker = createStageTracker({
		sourceCe: untrack(() => sourceCe),
		sourceCeShape: "layout",
		runtimeId,
		sectionId: untrack(() => sectionId || undefined),
		attemptId: untrack(() => attemptId || undefined),
		emit: (detail) => {
			dispatch("pie-stage-change", detail);
			const handler = effectiveRuntime?.onStageChange as
				| StageChangeHandler
				| undefined;
			if (handler) {
				try {
					handler(detail);
				} catch (error) {
					logger.error("onStageChange handler threw", error);
				}
			}
		},
	});
	let lastCohortKey = $state(untrack(() => `${sectionId}|${attemptId}`));
	let loadingCompleteEmittedForCohort = $state<string | null>(null);

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
			createSectionController,
			isolation,
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
		const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
		runtimeErrorState = true;
		dispatch("framework-error", detail);
		// `onFrameworkError` is delivered exactly once by the underlying
		// `pie-assessment-toolkit` — the canonical prop flows through
		// `effectiveRuntime.onFrameworkError → pie-section-player-base →
		// pie-assessment-toolkit` (two-tier precedence: `runtime` wins
		// over the top-level prop, applied in `resolveRuntime`). The
		// kernel intentionally does not invoke any handler here to avoid
		// double-firing.
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

	async function emitSectionControllerReadyIfNeeded() {
		if (sectionControllerReadyDispatched) return;
		const controller = await scaffoldRef?.waitForSectionController?.(2500);
		if (!controller) return;
		sectionControllerReadyDispatched = true;
		dispatch("section-controller-ready", {
			sectionId,
			attemptId: attemptId || undefined,
			controller,
		});
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
			dispatch("section-controller-ready", {
				sectionId,
				attemptId: attemptId || undefined,
				controller,
			});
		}
		return controller;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		const controller = await scaffoldRef?.waitForSectionController?.(timeoutMs);
		if (controller && !sectionControllerReadyDispatched) {
			sectionControllerReadyDispatched = true;
			dispatch("section-controller-ready", {
				sectionId,
				attemptId: attemptId || undefined,
				controller,
			});
		}
		return controller || null;
	}

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error: unknown) => {
			logger.error("Failed to load item player component:", error);
		});
	});

	// Stage: `disposed` — wired on kernel unmount. The four-stage retro
	// dropped `attached` (it had no consumers), so the kernel no longer
	// emits anything on mount; the cohort progression effect below owns
	// the entrance into `composed` once items/passages compose.
	$effect(() => {
		return () => {
			untrack(() => {
				if (stageTracker.getCurrent() !== null) {
					stageTracker.enter("disposed");
				}
			});
		};
	});

	// Cohort change handler: when `(sectionId, attemptId)` changes, emit
	// `disposed` for the outgoing cohort and reset the tracker so the
	// new cohort begins emitting from `composed` for the same DOM
	// element. Also re-arms `pie-loading-complete` emission.
	$effect(() => {
		const nextKey = `${sectionId}|${attemptId}`;
		untrack(() => {
			if (nextKey === lastCohortKey) return;
			if (stageTracker.getCurrent() !== null) {
				stageTracker.enter("disposed");
			}
			stageTracker.reset({
				sectionId: sectionId || undefined,
				attemptId: attemptId || undefined,
			});
			lastCohortKey = nextKey;
			loadingCompleteEmittedForCohort = null;
			interactionReadyDispatched = false;
			finalReadyDispatched = false;
			sectionControllerReadyDispatched = false;
			composedStageEntered = false;
			engineReadyStageEntered = false;
			interactiveStageEntered = false;
		});
	});

	// Canonical M6 stage progression (post-retro: 4 stages). Each
	// branch is short-circuited so later stages cannot fire before
	// their predecessors. The local `*StageEntered` latches gate
	// `stageTracker.enter(...)` to exactly one call per cohort per
	// stage — without them, every reactive update on the tracked
	// dependencies would re-call `enter()` and the tracker's
	// duplicate-transition warning would fire on every re-entry.
	$effect(() => {
		const composed = items.length > 0 || passages.length > 0;
		const engineReady = sectionControllerReadyDispatched;
		const interactive = readinessDetail.interactionReady;
		untrack(() => {
			if (!composedStageEntered && composed) {
				composedStageEntered = true;
				stageTracker.enter("composed");
			}
			if (
				!engineReadyStageEntered &&
				composedStageEntered &&
				engineReady
			) {
				engineReadyStageEntered = true;
				stageTracker.enter("engine-ready");
			}
			if (
				!interactiveStageEntered &&
				engineReadyStageEntered &&
				interactive
			) {
				interactiveStageEntered = true;
				stageTracker.enter("interactive");
			}
		});
	});

	// Legacy readiness emit chain (`readiness-change` / `interaction-ready`
	// / `ready` / `pie-loading-complete`). Only `readinessDetail` is a
	// tracked dep — the per-cohort latches and the cohort-key derivation
	// run inside `untrack` so reads/writes of `interactionReadyDispatched`,
	// `finalReadyDispatched`, and `loadingCompleteEmittedForCohort` do not
	// add themselves as tracked deps and re-trigger this effect on every
	// write (Svelte 5 `effect_update_depth_exceeded`). The cohort-change
	// effect above is the single point that resets the latches when
	// `(sectionId, attemptId)` rolls over; this effect only emits.
	$effect(() => {
		const detail = readinessDetail;
		untrack(() => {
			dispatch("readiness-change", detail);
			if (detail.interactionReady && !interactionReadyDispatched) {
				interactionReadyDispatched = true;
				dispatch("interaction-ready", detail);
			}
			if (detail.allLoadingComplete && !finalReadyDispatched) {
				finalReadyDispatched = true;
				dispatch("ready", detail);
				const cohortKey = `${sectionId}|${attemptId}`;
				if (loadingCompleteEmittedForCohort !== cohortKey) {
					loadingCompleteEmittedForCohort = cohortKey;
					const loadedItemCount = items.length;
					const loadingCompleteDetail: LoadingCompleteDetail = {
						runtimeId,
						sectionId,
						attemptId: attemptId || undefined,
						itemCount: loadedItemCount,
						loadedCount: loadedItemCount,
						timestamp: new Date().toISOString(),
						sourceCe,
					};
					dispatch("pie-loading-complete", loadingCompleteDetail);
					// Invoke the resolved `onLoadingComplete` callback at
					// the same emit point so the DOM event and the
					// callback fire in lockstep for the same cohort. The
					// handler is read from the effective runtime on every
					// emit so reassigns (cohort change, host swap) always
					// reach the latest reference.
					const handler = effectiveRuntime?.onLoadingComplete as
						| LoadingCompleteHandler
						| undefined;
					if (handler) {
						try {
							handler(loadingCompleteDetail);
						} catch (error) {
							logger.error("onLoadingComplete handler threw", error);
						}
					}
				}
			}
		});
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
