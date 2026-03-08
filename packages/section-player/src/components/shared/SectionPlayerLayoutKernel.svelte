<script lang="ts">
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import { createEventDispatcher } from "svelte";
	import type { SectionPlayerReadinessChangeDetail } from "../../contracts/public-events.js";
	import { DEFAULT_SECTION_PLAYER_POLICIES } from "../../policies/index.js";
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

	type PlayerActionConfig = {
		stateKey: string;
		setSkipElementLoadingOnce?: boolean;
		includeSessionRefInState?: boolean;
	};

	type KernelEvents = {
		"readiness-change": SectionPlayerReadinessChangeDetail;
		"interaction-ready": SectionPlayerReadinessChangeDetail;
		ready: SectionPlayerReadinessChangeDetail;
		"runtime-error": Record<string, unknown>;
		"runtime-owned": Record<string, unknown>;
		"runtime-inherited": Record<string, unknown>;
		"session-changed": Record<string, unknown>;
		"composition-changed": { composition: unknown };
		"navigation-change": {
			previousItemId?: string;
			currentItemId?: string;
			itemIndex?: number;
			totalItems?: number;
		};
		"section-controller-ready": {
			sectionId: string;
			attemptId?: string;
			controller: unknown;
		};
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
		playerActionConfig = {
			stateKey: "__sectionPlayerAppliedParams",
			includeSessionRefInState: false,
		} satisfies PlayerActionConfig,
		policies = DEFAULT_SECTION_PLAYER_POLICIES as SectionPlayerPolicies,
	} = $props();

	const dispatch = createEventDispatcher<KernelEvents>();
	let compositionSnapshot = $state<LayoutCompositionSnapshot>(
		deriveLayoutCompositionSnapshot(EMPTY_COMPOSITION),
	);
	let paneElementsLoaded = $state(false);
	let scaffoldRef = $state<{
		navigateToItem?: (index: number) => boolean;
		getCompositionModelSnapshot?: () => unknown;
		getSectionController?: () => unknown | null;
		waitForSectionController?: (timeoutMs?: number) => Promise<unknown | null>;
		getNavigationStateSnapshot?: () => {
			currentIndex: number;
			totalItems: number;
			canNext: boolean;
			canPrevious: boolean;
			currentItemId?: string;
		};
	} | null>(null);
	let sectionReady = $state(false);
	let interactionReadyDispatched = $state(false);
	let finalReadyDispatched = $state(false);
	let runtimeErrorState = $state(false);
	let sectionControllerReadyDispatched = $state(false);
	let previousNavigationState = $state<{
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		currentItemId?: string;
	}>({
		currentIndex: 0,
		totalItems: 0,
		canNext: false,
		canPrevious: false,
		currentItemId: undefined,
	});

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
		}),
	);
	const effectiveRuntime = $derived(runtimeState.effectiveRuntime);
	const playerRuntime = $derived(runtimeState.playerRuntime);
	const resolvedPlayerDefinition = $derived(playerRuntime.resolvedPlayerDefinition);
	const resolvedPlayerTag = $derived(playerRuntime.resolvedPlayerTag);
	const resolvedPlayerAttributes = $derived(playerRuntime.resolvedPlayerAttributes);
	const resolvedPlayerProps = $derived(playerRuntime.resolvedPlayerProps);
	const resolvedPlayerEnv = $derived(playerRuntime.resolvedPlayerEnv);
	const playerStrategy = $derived(playerRuntime.strategy);
	const playerAction = $derived.by(() => createPlayerAction(playerActionConfig));
	const cardRenderContextValue = $derived.by(
		(): SectionPlayerCardRenderContext => ({
			resolvedPlayerTag,
			playerAction,
		}),
	);
	const normalizedShowToolbar = $derived(coerceBooleanLike(showToolbar, false));
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
		const nextNavigationState = getNavigationState();
		if (
			nextNavigationState.currentIndex !== previousNavigationState.currentIndex ||
			nextNavigationState.totalItems !== previousNavigationState.totalItems ||
			nextNavigationState.currentItemId !== previousNavigationState.currentItemId
		) {
			dispatch("navigation-change", {
				previousItemId: previousNavigationState.currentItemId,
				currentItemId: nextNavigationState.currentItemId,
				itemIndex: nextNavigationState.currentIndex,
				totalItems: nextNavigationState.totalItems,
			});
			previousNavigationState = nextNavigationState;
		}
	}

	function handleItemsPaneElementsLoaded(event: Event) {
		const detail = (event as CustomEvent<{ elementsLoaded?: unknown }>).detail;
		paneElementsLoaded = detail?.elementsLoaded === true;
	}

	function handleSectionReady(_event: Event) {
		sectionReady = true;
	}

	function handleRuntimeError(event: Event) {
		runtimeErrorState = true;
		dispatch("runtime-error", (event as CustomEvent<Record<string, unknown>>).detail || {});
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

	function getNavigationState() {
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

	export function getSnapshot() {
		return {
			readiness: readinessDetail,
			composition: {
				itemsCount: items.length,
				passagesCount: passages.length,
			},
			navigation: getNavigationState(),
		};
	}

	export function selectComposition() {
		return {
			itemsCount: items.length,
			passagesCount: passages.length,
		};
	}

	export function selectNavigation() {
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

	export function preloadNow(): void {
		// Items pane preload is signature-driven; this hook remains explicit.
	}

	export function getSectionController(): unknown | null {
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
	): Promise<unknown | null> {
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
			console.error("[section-player-layout-kernel] Failed to load item player component:", error);
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
	onSessionChanged={handleSessionChanged}
	onRuntimeOwned={handleRuntimeOwned}
	onRuntimeInherited={handleRuntimeInherited}
	onToolkitReady={handleToolkitReady}
	showToolbar={normalizedShowToolbar}
	toolbarPosition={toolbarPosition}
	enabledTools={enabledTools}
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
			resolvedPlayerProps,
			playerStrategy,
			iifeBundleHost,
			paneElementsLoaded,
			readinessDetail,
			onItemsPaneElementsLoaded: handleItemsPaneElementsLoaded,
		}}
		{compositionModel}
		{passages}
		{items}
		{preloadedRenderables}
		{preloadedRenderablesSignature}
		{resolvedPlayerEnv}
		{resolvedPlayerAttributes}
		{resolvedPlayerProps}
		{playerStrategy}
		{iifeBundleHost}
		{paneElementsLoaded}
		{readinessDetail}
		onItemsPaneElementsLoaded={handleItemsPaneElementsLoaded}
	></slot>
</SectionPlayerLayoutScaffold>
