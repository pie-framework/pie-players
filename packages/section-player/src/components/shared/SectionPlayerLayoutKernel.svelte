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
	import { createEventDispatcher } from "svelte";
	import type { SectionPlayerReadinessChangeDetail } from "../../contracts/public-events.js";
	import type {
		SectionPlayerNavigationSnapshot,
		SectionPlayerSnapshot,
	} from "../../contracts/runtime-host-contract.js";
	import {
		DEFAULT_SECTION_PLAYER_POLICIES,
		isPreloadEnabled,
	} from "../../policies/index.js";
	import {
		warnDeprecatedOnce,
		type FrameworkErrorModel,
	} from "@pie-players/pie-assessment-toolkit";
	import type { SectionPlayerPolicies } from "../../policies/types.js";
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
	} from "./section-player-runtime.js";
	import type { SectionPlayerCardRenderContext } from "./section-player-card-context.js";
	import { coerceBooleanLike } from "./section-player-props.js";
	import { createReadinessDetail } from "./section-player-readiness.js";
	import SectionPlayerLayoutScaffold from "./SectionPlayerLayoutScaffold.svelte";
	import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";

	type PlayerActionConfig = {
		stateKey: string;
		includeSessionRefInState?: boolean;
	};

	type KernelEvents = {
		"readiness-change": SectionPlayerReadinessChangeDetail;
		"interaction-ready": SectionPlayerReadinessChangeDetail;
		ready: SectionPlayerReadinessChangeDetail;
		"runtime-error": Record<string, unknown>;
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
		frameworkErrorHook = undefined as
			| undefined
			| ((errorModel: Record<string, unknown>) => void),
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
			toolRegistry,
			toolConfigStrictness,
			onFrameworkError,
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

	function handleRuntimeError(event: Event) {
		runtimeErrorState = true;
		dispatch("runtime-error", (event as CustomEvent<Record<string, unknown>>).detail || {});
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
		// kernel intentionally does not invoke `onFrameworkError` here
		// to avoid double-firing.
		// Deprecated `frameworkErrorHook` alias is consumed locally; it
		// has no toolkit-side delivery path.
		if (frameworkErrorHook) {
			warnDeprecatedOnce(
				"section-player-layout-kernel-prop:frameworkErrorHook",
				"<pie-section-player-...>'s `frameworkErrorHook` prop is deprecated; use `onFrameworkError` instead.",
			);
			frameworkErrorHook(detail);
		}
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

	$effect(() => {
		dispatch("readiness-change", readinessDetail);
		if (readinessDetail.interactionReady && !interactionReadyDispatched) {
			interactionReadyDispatched = true;
			dispatch("interaction-ready", readinessDetail);
		}
		if (readinessDetail.allLoadingComplete && !finalReadyDispatched) {
			finalReadyDispatched = true;
			dispatch("ready", readinessDetail);
		}
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
	onRuntimeError={handleRuntimeError}
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
