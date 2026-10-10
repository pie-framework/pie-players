<script lang="ts">
	import {
		coerceBooleanLike,
		createPieLogger,
		isGlobalDebugEnabled,
	} from "@pie-players/pie-players-shared";
	import {
		dispatchCrossBoundaryEvent,
		toFrameworkErrorModel,
		type FrameworkErrorModel,
		type SectionControllerHandle,
		type ToolRegistry,
		type ToolbarItem,
		type ToolConfigStrictness,
		type ToolkitCoordinatorApi,
	} from "@pie-players/pie-assessment-toolkit";
	import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";
	import {
		SectionRuntimeEngine,
		cohortsEqual,
		makeCohort,
		resolveSectionId,
		type EngineReadinessSignals,
		type LoadingCompleteHandler,
		type RuntimeConfig,
		type StageChangeHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import type {
		AssessmentEntity,
		AssessmentSection,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import { untrack } from "svelte";
	import type {
		SectionPlayerNavigationSnapshot,
		SectionPlayerSnapshot,
	} from "../../contracts/runtime-host-contract.js";
	import {
		DEFAULT_SECTION_PLAYER_POLICIES,
		resolveSectionPlayerPolicies,
	} from "../../policies/index.js";
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
	import { attachRuntimeCallbackBridge } from "./section-player-runtime-callbacks.js";
	import type { SectionPlayerCardRenderContext } from "./section-player-card-context.js";
	import {
		createSectionPlayerPaneRegistry,
		type SectionPlayerLayoutContext,
		type SectionPlayerPaneKind,
		type SectionPlayerPaneReport,
	} from "./section-player-layout-context.js";
	import type {
		ElementPreloadErrorDetail,
		ElementPreloadRetryDetail,
	} from "./player-preload.js";
	import SectionPlayerLayoutScaffold from "./SectionPlayerLayoutScaffold.svelte";
	import {
		announceToolkitCoordinator,
		CLEAR_FRAMEWORK_ERROR_LATCH,
		isFrameworkErrorLatched,
		latchFrameworkError,
		rollFrameworkErrorLatch,
	} from "./framework-error-latch.js";
	import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";

	type PlayerActionConfig = {
		stateKey: string;
		includeSessionRefInState?: boolean;
	};

	let {
		runtime = null as RuntimeConfig | null,
		ndsIcons = undefined as boolean | undefined,
		locale = "",
		section = null as AssessmentSection | null,
		session = null as SectionControllerSessionState | null,
		assessment = null as AssessmentEntity | null,
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
		// The mounting layout CE's canonical tag name (without the
		// `--version-<encoded>` suffix), which labels `pie-stage-change`
		// emissions and the items pane's preload reports. The default keeps
		// events well-formed for a kernel mounted in tests and demos.
		sourceCe = "pie-section-player" as string,
		// The mounting layout CE's own element, on which the engine dispatches
		// `pie-stage-change` and `pie-loading-complete`. `null` until the layout
		// CE has resolved it; the engine attaches once it is set.
		host = null as HTMLElement | null,
	} = $props();

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
	// The active items pane reports where its element pre-warm stands, with the
	// renderables signature the report was made for. It counts only for the
	// composition the kernel holds, and only once the toolkit has published one:
	// before that the pane renders no items and reports its empty pre-warm as
	// loaded.
	let paneReport = $state<SectionPlayerPaneReport | null>(null);
	// The panes under this player's layout element, which register through the
	// layout context. One of each kind renders.
	let activePanes = $state.raw<Record<SectionPlayerPaneKind, Element | null>>({
		items: null,
		passages: null,
	});
	const paneRegistry = createSectionPlayerPaneRegistry({
		onChange: (active) => {
			activePanes = active;
		},
	});
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
	// Latched by the scope each framework error's report site set.
	let frameworkErrorLatch = $state(CLEAR_FRAMEWORK_ERROR_LATCH);
	const runtimeErrorState = $derived(isFrameworkErrorLatched(frameworkErrorLatch));
	// The latest `section-ready` controller, with the cohort it belongs to: that
	// event can arrive before the engine driver rolls to its cohort.
	let readyController: {
		cohort: NonNullable<ReturnType<typeof makeCohort>>;
		controller: SectionControllerHandle;
	} | null = null;
	let controllerResolvedFor: ReturnType<typeof makeCohort> = null;

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
	const paneWarmup = $derived(
		compositionReceived &&
			paneReport?.renderablesSignature === preloadedRenderablesSignature
			? paneReport.warmup
			: "pending",
	);
	const paneElementsLoaded = $derived(paneWarmup === "loaded");
	// Until the cohort's `section-ready`, the composition the kernel holds can be
	// the previous section's, so the section's readiness reads the pane only from
	// then on.
	const sectionElementsLoaded = $derived(sectionReady && paneElementsLoaded);
	const sectionWarmupFailed = $derived(sectionReady && paneWarmup === "failed");
	const runtimeState = $derived.by(() =>
		resolveSectionPlayerRuntimeState({ runtime, toolConfigStrictness }),
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
	const currentCohort = () => makeCohort({ sectionId: cohortSectionId, attemptId });
	const effectiveToolsConfig = $derived(runtimeState.effectiveToolsConfig);
	const defaultToolRegistry = createPackagedToolRegistry();
	const effectiveToolRegistry = $derived(toolRegistry ?? defaultToolRegistry);
	const playerRuntime = $derived(runtimeState.playerRuntime);
	// Hosts set `runtime.tools.placement.{section,item,passage}` as arrays; the
	// card and pane CEs take each level as the comma-separated `tools` attribute
	// of `<pie-item-toolbar>`, so the kernel joins them for the layout context.
	function placementToolsAttribute(level: "section" | "item" | "passage"): string {
		const placement = (
			effectiveToolsConfig as { placement?: Record<string, unknown> } | undefined | null
		)?.placement;
		const tools = placement?.[level];
		return Array.isArray(tools) ? tools.join(",") : "";
	}
	const effectiveSectionToolbarTools = $derived(placementToolsAttribute("section"));
	const effectiveItemToolbarTools = $derived(placementToolsAttribute("item"));
	const effectivePassageToolbarTools = $derived(placementToolsAttribute("passage"));
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
	const layoutContextValue = $derived.by(
		(): SectionPlayerLayoutContext => ({
			componentTag: sourceCe,
			items,
			passages,
			compositionModel,
			preloadedRenderables,
			preloadedRenderablesSignature,
			preloadEnabled,
			resolvedPlayerEnv,
			resolvedPlayerAttributes,
			resolvedPlayerProps: effectiveResolvedPlayerProps,
			playerStrategy,
			baseHeadingLevel: resolvedBaseHeadingLevel,
			iifeBundleHost: iifeBundleHost ?? null,
			toolRegistry: effectiveToolRegistry,
			itemToolbarTools: effectiveItemToolbarTools,
			passageToolbarTools: effectivePassageToolbarTools,
			itemHostButtons,
			passageHostButtons,
			elementsLoaded: paneElementsLoaded,
			activePanes,
			registerPane: paneRegistry.register,
			reportWarmup: handleItemsPaneWarmup,
			reportPreloadRetry: handleItemsPanePreloadRetry,
			reportPreloadError: handleItemsPanePreloadError,
		}),
	);

	function handleBaseCompositionChanged(event: Event) {
		compositionSnapshot = getCompositionSnapshotFromEvent(event);
		compositionReceived = true;
	}

	// Read from the registry, which a registration updates synchronously, so a
	// pane's first report after it takes over is not dropped.
	function isActiveItemsPane(pane: Element): boolean {
		return paneRegistry.active().items === pane;
	}

	function handleItemsPaneWarmup(
		pane: Element,
		report: SectionPlayerPaneReport,
	) {
		if (!isActiveItemsPane(pane)) return;
		paneReport = {
			warmup: report.warmup,
			renderablesSignature: report.renderablesSignature,
		};
	}

	// The active items pane's preload retries and failures go out on the layout
	// host with the section's identity added, bubbling and composed like the
	// player's other events.
	function dispatchPreloadEvent(
		type: "element-preload-retry" | "element-preload-error",
		pane: Element,
		detail: ElementPreloadRetryDetail | ElementPreloadErrorDetail,
	) {
		if (!host || !isActiveItemsPane(pane)) return;
		dispatchCrossBoundaryEvent(host, type, {
			...detail,
			assessmentId: effectiveRuntime.assessmentId,
			sectionId: cohortSectionId,
			attemptId: attemptId || undefined,
		});
	}

	function handleItemsPanePreloadRetry(
		pane: Element,
		detail: ElementPreloadRetryDetail,
	) {
		dispatchPreloadEvent("element-preload-retry", pane, detail);
	}

	function handleItemsPanePreloadError(
		pane: Element,
		detail: ElementPreloadErrorDetail,
	) {
		dispatchPreloadEvent("element-preload-error", pane, detail);
	}

	// The coordinator of the toolkit this layout renders, from its `toolkit-ready`.
	let toolkitCoordinator: ToolkitCoordinatorApi | null = null;

	/**
	 * The toolkit's `section-ready` carries the section's controller and cohort,
	 * which advance that cohort's stage chain past `booting-section`. One without
	 * a controller leaves the chain and the section's readiness where they are,
	 * and reports it.
	 */
	function handleSectionReady(event: Event) {
		const detail = (
			event as CustomEvent<{
				sectionId?: string;
				attemptId?: string;
				controller?: SectionControllerHandle | null;
			}>
		).detail;
		const cohort = makeCohort({
			sectionId: detail?.sectionId,
			attemptId: detail?.attemptId,
		});
		if (!cohort) return;
		if (!detail?.controller) {
			toolkitCoordinator?.reportFrameworkError?.(
				toFrameworkErrorModel({
					kind: "section-controller-init",
					severity: "warning",
					source: sourceCe,
					message:
						"The toolkit's section-ready carried no section controller, so the stage chain stays at booting-section.",
					recoverable: true,
					scope: "cohort",
					cohort,
				}),
			);
			return;
		}
		readyController = { cohort, controller: detail.controller };
		// Readies only the current cohort, whose composition the kernel now holds.
		if (cohortsEqual(cohort, currentCohort())) sectionReady = true;
		resolveReadyController();
	}

	// Advances the engine to `engine-ready` once per cohort, when the driver's
	// cohort is the one the ready controller belongs to. Hosts read the
	// controller with `waitForSectionController(timeoutMs)` or
	// `getSectionController()` on the layout element, or filter
	// `pie-stage-change` for `engine-ready`.
	function resolveReadyController() {
		if (!readyController || !cohortsEqual(readyController.cohort, lastCohort)) return;
		if (cohortsEqual(controllerResolvedFor, lastCohort)) return;
		controllerResolvedFor = lastCohort;
		engine.dispatchInput({ kind: "section-controller-resolved" });
	}


	function handleToolkitReady(event: Event) {
		toolkitCoordinator =
			(event as CustomEvent<{ coordinator?: ToolkitCoordinatorApi }>).detail
				?.coordinator ?? null;
		frameworkErrorLatch = announceToolkitCoordinator(
			frameworkErrorLatch,
			toolkitCoordinator,
		);
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
		frameworkErrorLatch = latchFrameworkError(
			frameworkErrorLatch,
			detail,
			toolkitCoordinator,
			currentCohort(),
		);
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
			composition: {
				itemsCount: items.length,
				passagesCount: passages.length,
			},
			navigation: getNavigationState(),
		};
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

	// Reads only: the stage chain advances on the toolkit's `section-ready`. The
	// base element looks the controller up by the incoming section's id, so a
	// read during a section switch returns null, or on a revisit the incoming
	// section's cached controller.
	export function getSectionController(): SectionControllerHandle | null {
		return scaffoldRef?.getSectionController?.() || null;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		return (await scaffoldRef?.waitForSectionController?.(timeoutMs)) || null;
	}

	// A layout with no items pane leaves the items unrendered and readiness short
	// of `interactive`. Checked a task after the section is ready with items, so a
	// layout that mounts or swaps its pane after the composition arrives is not
	// reported.
	let missingItemsPaneReported = false;
	$effect(() => {
		if (!sectionReady || !compositionReceived) return;
		if (items.length === 0 || activePanes.items) return;
		const itemCount = items.length;
		const handle = setTimeout(() => {
			if (missingItemsPaneReported || paneRegistry.active().items) return;
			missingItemsPaneReported = true;
			console.warn(
				`[pie-section-player] The section has ${itemCount} item(s) and no <pie-section-player-items-pane> inside <${sourceCe}>, so no item renders and pie-loading-complete does not fire. Reported once per section player.`,
			);
		}, 0);
		return () => clearTimeout(handle);
	});

	// Each cohort's content starts clean. Declared ahead of the engine driver, so
	// the driver reads the reset when the cohort rolls. The section is ready again
	// on the toolkit's `section-ready` for it, which follows that section's
	// composition: until then the composition and pane report the kernel holds are
	// the previous section's.
	$effect(() => {
		void cohortSectionId;
		void attemptId;
		untrack(() => {
			frameworkErrorLatch = rollFrameworkErrorLatch(frameworkErrorLatch);
			sectionReady = false;
		});
	});

	// Primary engine driver. Reads every host-side input the engine cares about
	// so Svelte tracks them, and makes the engine calls inside `untrack` so the
	// write to the non-reactive `lastCohort` does not feed back into it.
	//
	// Per run:
	//   1. No-op until the layout CE passes `host`, which it does after its
	//      first render.
	//   2. `attachHost` on every run: the engine builds its adapter on the first
	//      call and only moves it to the new host on later ones, which covers a
	//      layout swap.
	//   3. Dispatch by cohort:
	//        - first cohort → `initialize`
	//        - new cohort   → `cohort-change`; the engine emits `disposed` for
	//                         the outgoing cohort and re-arms its latches
	//        - same cohort  → `update-runtime` with the latest resolver output
	//        - cleared      → nothing, so no `disposed`; a host that needs one
	//                         unmounts the layout CE, whose cleanup `$effect`
	//                         below dispatches `dispose`
	//        - none         → nothing; the engine stays `idle`
	//      After a rollover, a `section-ready` that already arrived for the new
	//      cohort dispatches `section-controller-resolved`.
	//   4. While a cohort is active, push the latest readiness signals so the
	//      engine can reach `interactive` and emit `loading-complete` once per
	//      cohort.
	$effect(() => {
		void host;
		void cohortSectionId;
		void attemptId;
		void effectiveRuntime;
		void effectiveToolsConfig;
		void items.length;
		void sectionReady;
		void sectionElementsLoaded;
		void sectionWarmupFailed;
		void runtimeErrorState;
		void effectivePolicies.readiness.mode;
		untrack(() => {
			if (!host) return;
			engine.attachHost({ host, sourceCe });

			const nextCohort = currentCohort();
			const itemCount = items.length;

			if (!cohortsEqual(lastCohort, nextCohort)) {
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
				resolveReadyController();
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
					interactionReady: sectionElementsLoaded,
					allLoadingComplete: sectionElementsLoaded,
					runtimeError: runtimeErrorState || sectionWarmupFailed,
				};
				engine.dispatchInput({
					kind: "update-readiness-signals",
					signals,
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
				paneRegistry.dispose();
			});
		};
	});
</script>

<SectionPlayerLayoutScaffold
	bind:this={scaffoldRef}
	runtime={effectiveRuntime}
	{ndsIcons}
	{locale}
	{toolConfigStrictness}
	{section}
	{session}
	{assessment}
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
	layoutContext={layoutContextValue}
>
	<slot layoutModel={{ passages, paneElementsLoaded }}></slot>
</SectionPlayerLayoutScaffold>
