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
		createPackagedToolRegistry,
		DEFAULT_TOOL_MODULE_LOADERS,
	} from "@pie-players/pie-default-tool-loaders";
	import {
		SectionRuntimeEngine,
		cohortsEqual,
		makeCohort,
		resolveSectionId,
		type EngineReadinessSignals,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import type {
		AssessmentSection,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, untrack } from "svelte";
	import type {
		SectionPlayerNavigationSnapshot,
		SectionPlayerSnapshot,
	} from "../../contracts/runtime-host-contract.js";
	import {
		DEFAULT_SECTION_PLAYER_POLICIES,
		resolveSectionPlayerPolicies,
	} from "../../policies/index.js";
	import type { FrameworkErrorModel } from "@pie-players/pie-assessment-toolkit";
	import type { SectionPlayerPolicies } from "../../policies/types.js";
	import { createPlayerAction } from "./player-action.js";
	import {
		type LayoutCompositionSnapshot,
		deriveLayoutCompositionSnapshot,
		getCompositionSnapshotFromEvent,
		normalizeBaseHeadingLevel,
	} from "./section-player-view-state.js";
	import { EMPTY_COMPOSITION } from "./composition.js";
	import { resolveSectionPlayerRuntimeState } from "./section-player-host-runtime.js";
	import type {
		RuntimeConfig,
		StageChangeHandler,
		LoadingCompleteHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import { attachRuntimeCallbackBridge } from "./section-player-runtime-callbacks.js";
	import type { SectionPlayerCardRenderContext } from "./section-player-card-context.js";
	import { coerceBooleanLike } from "@pie-players/pie-players-shared";
	import { createReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import SectionPlayerLayoutScaffold from "./SectionPlayerLayoutScaffold.svelte";
	import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";

	/** Fatal failures that belong to the section's content, not the runtime. */
	const COHORT_SCOPED_ERROR_KINDS = new Set<FrameworkErrorModel["kind"]>([
		"runtime-init",
		"section-controller-init",
		"timed-media",
		"element-preload",
	]);

	type PlayerActionConfig = {
		stateKey: string;
		includeSessionRefInState?: boolean;
	};

	type KernelEvents = {
		// The only Svelte events the kernel dispatches up to the hosting
		// layout CE, which re-dispatches them on its host. The toolkit's own
		// events (`session-changed`, `composition-changed`, `runtime-owned`,
		// `runtime-inherited`, `toolkit-ready`, `section-ready`,
		// `framework-error`) reach the layout host by bubbling from the
		// toolkit, and the section runtime engine dispatches `pie-stage-change`
		// and `pie-loading-complete` on it, bubbling and composed.
		// Re-dispatching a bubbled event here delivered it to the host a
		// second and third time.
		"element-preload-retry": Record<string, unknown>;
		"element-preload-error": Record<string, unknown>;
	};

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		session = null as SectionControllerSessionState | null,
		sectionId = "",
		attemptId = "",
		iifeBundleHost,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		toolConfigStrictness = "error" as ToolConfigStrictness,
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		debug = undefined as string | boolean | undefined,
		// Composition context: the level this player's card headings occupy, from
		// which every descendant's outline derives. See `normalizeBaseHeadingLevel`
		// and `docs/architecture/composition-context.md`.
		baseHeadingLevel = undefined as number | undefined,
		playerActionConfig = {
			stateKey: "__sectionPlayerAppliedParams",
			includeSessionRefInState: false,
		} satisfies PlayerActionConfig,
		policies = DEFAULT_SECTION_PLAYER_POLICIES as Partial<SectionPlayerPolicies>,
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
		// Host element the section runtime engine dispatches
		// `pie-stage-change` and `pie-loading-complete` on. Each layout CE
		// that mounts the kernel passes its own host element (`this`);
		// defaults to `null` so the kernel keeps mounting before the layout
		// CE has resolved its host. The engine attaches once `host` is
		// non-null.
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
	// The items pane reports whether its element pre-warm has resolved, with the
	// renderables signature the report was made for. It counts only for the
	// composition the kernel holds, and only once the toolkit has published one:
	// before that the pane renders no items and reports its empty pre-warm as
	// resolved.
	let paneReport = $state<{
		elementsLoaded: boolean;
		renderablesSignature: string;
	} | null>(null);
	let compositionReceived = $state(false);
	let scaffoldRef = $state<{
		navigateToItem?: (index: number) => boolean;
		getCompositionModelSnapshot?: () => unknown;
		getSectionController?: () => SectionControllerHandle | null;
		waitForSectionController?: (
			timeoutMs?: number,
		) => Promise<SectionControllerHandle | null>;
		getNavigationStateSnapshot?: () => SectionPlayerNavigationSnapshot;
	} | null>(null);
	let sectionReady = $state(false);
	// A fatal failure of the section's own content latches its cohort; one of the
	// coordinator or its tools, a granted accommodation's included, latches the
	// runtime, since the next section runs on the same coordinator.
	let cohortErrorLatched = $state(false);
	let runtimeErrorLatched = $state(false);
	const runtimeErrorState = $derived(cohortErrorLatched || runtimeErrorLatched);
	let sectionControllerReadyDispatched = $state(false);

	// One section runtime engine per kernel mount: the section player's only
	// stage emitter. It dispatches `pie-stage-change` and
	// `pie-loading-complete` on the layout CE host. The kernel feeds it
	// reactive inputs from a single tracked `$effect` wrapped in `untrack`.
	// Construction is side-effect free; `attachHost` builds the adapter.
	const engine = new SectionRuntimeEngine();

	// Non-reactive bookkeeping for the engine-driver effect: `lastCohort`
	// is the previously dispatched cohort, compared with `cohortsEqual` to
	// tell a first `initialize`, a same-cohort `update-runtime` and a
	// `cohort-change` apart. Mutated only inside `untrack(...)` so it never
	// becomes a tracked dep of the effect that maintains it.
	let lastCohort: ReturnType<typeof makeCohort> = null;

	const compositionModel = $derived(compositionSnapshot.compositionModel);
	const passages = $derived(compositionSnapshot.passages);
	const items = $derived(compositionSnapshot.items);
	const preloadedRenderables = $derived(compositionSnapshot.renderables);
	const preloadedRenderablesSignature = $derived(
		compositionSnapshot.renderablesSignature,
	);
	const paneElementsLoaded = $derived(
		compositionReceived &&
			paneReport?.elementsLoaded === true &&
			paneReport.renderablesSignature === preloadedRenderablesSignature,
	);
	const runtimeState = $derived.by(() =>
		resolveSectionPlayerRuntimeState({
			assessmentId,
			runtime,
			toolConfigStrictness,
			onFrameworkError,
			onStageChange,
			onLoadingComplete,
		}),
	);
	const effectiveRuntime = $derived(runtimeState.effectiveRuntime);
	// The stage cohort runs under the id the toolkit keys the section's
	// controller by, and only while there is a section to run.
	const cohortSectionId = $derived(
		section || sectionId
			? resolveSectionId({
					sectionId,
					section,
					assessmentId: effectiveRuntime.assessmentId,
				})
			: "",
	);
	const effectiveToolsConfig = $derived(runtimeState.effectiveToolsConfig);
	const defaultToolRegistry = createPackagedToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
	});
	const effectiveToolRegistry = $derived(toolRegistry ?? defaultToolRegistry);
	const playerRuntime = $derived(runtimeState.playerRuntime);
	// Per-region toolbar-tools strings derived from the canonical
	// `tools.placement.{item,passage}` arrays. Internal card / pane
	// custom elements still consume these as comma-separated strings
	// (the `<pie-item-toolbar tools="...">` attribute), so the kernel
	// joins the canonical placement arrays back into strings and
	// exposes them via the slot. Hosts populate `runtime.tools.placement`.
	const effectiveSectionToolbarTools = $derived.by(() => {
		const tools = effectiveToolsConfig as
			| { placement?: { section?: unknown } }
			| undefined
			| null;
		const section = tools?.placement?.section;
		return Array.isArray(section) ? section.join(",") : "";
	});
	const effectiveItemToolbarTools = $derived.by(() => {
		const tools = effectiveToolsConfig as
			| { placement?: { item?: unknown } }
			| undefined
			| null;
		const item = tools?.placement?.item;
		return Array.isArray(item) ? item.join(",") : "";
	});
	const effectivePassageToolbarTools = $derived.by(() => {
		const tools = effectiveToolsConfig as
			| { placement?: { passage?: unknown } }
			| undefined
			| null;
		const passage = tools?.placement?.passage;
		return Array.isArray(passage) ? passage.join(",") : "";
	});
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
	const resolvedBaseHeadingLevel = $derived(
		normalizeBaseHeadingLevel(baseHeadingLevel),
	);
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
	const effectivePolicies = $derived(resolveSectionPlayerPolicies(policies));
	const preloadEnabled = $derived(effectivePolicies.preload.enabled);
	// Interaction waits for the items to mount, so the progressive and strict
	// modes coincide on these signals.
	const readinessDetail = $derived.by(() =>
		createReadinessDetail({
			mode: effectivePolicies.readiness.mode,
			signals: {
				sectionReady,
				interactionReady: sectionReady && paneElementsLoaded,
				allLoadingComplete: paneElementsLoaded,
				runtimeError: runtimeErrorState,
			},
			reason: `policy:${effectivePolicies.readiness.mode}`,
		}),
	);

	function handleBaseCompositionChanged(event: Event) {
		compositionSnapshot = getCompositionSnapshotFromEvent(event);
		compositionReceived = true;
	}

	function handleItemsPaneElementsLoaded(event: Event) {
		const detail = (
			event as CustomEvent<{
				elementsLoaded?: unknown;
				renderablesSignature?: unknown;
			}>
		).detail;
		paneReport = {
			elementsLoaded: detail?.elementsLoaded === true,
			renderablesSignature:
				typeof detail?.renderablesSignature === "string"
					? detail.renderablesSignature
					: "",
		};
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
		// The toolkit publishes each framework error once: one bubbling
		// `framework-error` event, which continues to the layout host and the
		// document, and one `onFrameworkError` call. The kernel only reads it.
		// Recoverable warnings stay observable without blocking the
		// assessment; a non-recoverable failure latches readiness to `error`,
		// and before `interactive` that ends the cohort's stage chain as
		// `failed`.
		if (detail && detail.recoverable !== true) {
			if (COHORT_SCOPED_ERROR_KINDS.has(detail.kind)) cohortErrorLatched = true;
			else runtimeErrorLatched = true;
		}
	}

	function notifySectionControllerResolved(_controller: SectionControllerHandle) {
		// Drives the engine FSM stage progression
		// `booting-section → engine-ready`. Idempotent per cohort via
		// the `sectionControllerReadyDispatched` latch (reset in the
		// engine-driver `$effect` whenever the cohort rolls). The
		// previously co-emitted kernel `section-controller-ready` Svelte
		// event was removed in the broad architecture review compat
		// sweep; hosts should call `waitForSectionController(timeoutMs)`
		// or `getSectionController()` on the layout CE, or filter
		// `pie-stage-change` for `detail.stage === "engine-ready"`.
		engine.dispatchInput({ kind: "section-controller-resolved" });
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

	// Reads only: the stage chain advances on the toolkit's `toolkit-ready`, and a
	// read during a section switch can return the outgoing section's controller.
	export function getSectionController(): SectionControllerHandle | null {
		return scaffoldRef?.getSectionController?.() || null;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		return (await scaffoldRef?.waitForSectionController?.(timeoutMs)) || null;
	}

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error: unknown) => {
			logger.error("Failed to load item player component:", error);
		});
	});

	// Primary engine-driver effect. Reads every
	// host-side input the engine cares about so Svelte tracks them as
	// deps; performs the actual `attachHost` / `dispatchInput` calls
	// inside `untrack` so the write to the non-reactive `lastCohort`
	// does not feed back into this effect.
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
	//        - cohort cleared (host clears
	//          `section` and `sectionId`
	//          while still mounted)         → no-op. Earlier stage
	//                                         tracking emitted
	//                                         `disposed` here;
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
	// Each cohort's content starts clean. Declared ahead of the engine driver, so
	// the driver reads the reset when the cohort rolls.
	$effect(() => {
		void cohortSectionId;
		void attemptId;
		untrack(() => {
			cohortErrorLatched = false;
		});
	});

	$effect(() => {
		void host;
		void cohortSectionId;
		void attemptId;
		void effectiveRuntime;
		void effectiveToolsConfig;
		void items.length;
		void sectionReady;
		void paneElementsLoaded;
		void runtimeErrorState;
		void effectivePolicies.readiness.mode;
		untrack(() => {
			if (!host) return;
			engine.attachHost({ host, sourceCe });

			const nextCohort = makeCohort({ sectionId: cohortSectionId, attemptId });
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
					interactionReady: sectionReady && paneElementsLoaded,
					allLoadingComplete: paneElementsLoaded,
					runtimeError: runtimeErrorState,
				};
				engine.dispatchInput({
					kind: "update-readiness-signals",
					signals,
					loadedCount: itemCount,
					itemCount,
					mode: effectivePolicies.readiness.mode,
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

	// On unmount the engine emits `disposed` for the active cohort through
	// the same DOM bridge as every other stage, then detaches.
	$effect(() => {
		return () => {
			untrack(() => {
				engine.dispose();
			});
		};
	});
</script>

<SectionPlayerLayoutScaffold
	bind:this={scaffoldRef}
	runtime={effectiveRuntime}
	{section}
	{session}
	sectionId={sectionId}
	attemptId={attemptId}
	onCompositionChanged={handleBaseCompositionChanged}
	onSectionReady={handleSectionReady}
	onFrameworkErrorEvent={handleFrameworkError}
	onToolkitReady={handleToolkitReady}
	showToolbar={normalizedShowToolbar}
	toolbarPosition={toolbarPosition}
	enabledTools={effectiveSectionToolbarTools}
	toolRegistry={effectiveToolRegistry}
	{sectionHostButtons}
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
			baseHeadingLevel: resolvedBaseHeadingLevel,
			iifeBundleHost,
			paneElementsLoaded,
			toolRegistry: effectiveToolRegistry,
			itemHostButtons,
			passageHostButtons,
			readinessDetail,
			preloadEnabled,
			itemToolbarTools: effectiveItemToolbarTools,
			passageToolbarTools: effectivePassageToolbarTools,
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
		baseHeadingLevel={resolvedBaseHeadingLevel}
		{iifeBundleHost}
		{paneElementsLoaded}
		toolRegistry={effectiveToolRegistry}
		{itemHostButtons}
		{passageHostButtons}
		{readinessDetail}
		{preloadEnabled}
		itemToolbarTools={effectiveItemToolbarTools}
		passageToolbarTools={effectivePassageToolbarTools}
		onItemsPaneElementsLoaded={handleItemsPaneElementsLoaded}
		onItemsPanePreloadRetry={handleItemsPanePreloadRetry}
		onItemsPanePreloadError={handleItemsPanePreloadError}
	></slot>
</SectionPlayerLayoutScaffold>
