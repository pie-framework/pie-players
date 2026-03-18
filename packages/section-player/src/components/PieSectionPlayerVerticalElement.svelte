<svelte:options
	customElement={{
		tag: "pie-section-player-vertical",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			player: { type: "Object", reflect: false },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
			narrowLayoutBreakpoint: { attribute: "narrow-layout-breakpoint", type: "Number" },
		},
	}}
/>

<script lang="ts">
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		SECTION_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import "./section-player-item-card-element.js";
	import "./section-player-passage-card-element.js";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import { createEventDispatcher } from "svelte";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import {
		type RuntimeConfig,
	} from "./shared/section-player-runtime.js";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";

	const DEFAULT_NARROW_BREAKPOINT_PX = 1100;
	const NARROW_BREAKPOINT_MIN_PX = 400;
	const NARROW_BREAKPOINT_MAX_PX = 2000;

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
		narrowLayoutBreakpoint = undefined as number | undefined,
	} = $props();
	const dispatch = createEventDispatcher();
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let isNarrow = $state(false);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			player,
			component: "pie-section-player-vertical",
		}),
	);

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const hostElement = $derived.by(() => getHostElement());

	const clampedBreakpoint = $derived.by(() => {
		const n = narrowLayoutBreakpoint ?? DEFAULT_NARROW_BREAKPOINT_PX;
		const num = typeof n === "number" ? n : Number(n);
		const value = Number.isFinite(num) ? num : DEFAULT_NARROW_BREAKPOINT_PX;
		return Math.max(
			NARROW_BREAKPOINT_MIN_PX,
			Math.min(NARROW_BREAKPOINT_MAX_PX, value),
		);
	});

	$effect(() => {
		const bp = clampedBreakpoint;
		if (typeof window === "undefined") return;
		const query: MediaQueryList = window.matchMedia(`(max-width: ${bp}px)`);
		function update() {
			isNarrow = query.matches;
		}
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	const effectiveToolbarPosition = $derived(isNarrow ? "top" : toolbarPosition);

	function forward(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	export function getSnapshot(): SectionPlayerSnapshot | null {
		return kernelRef?.getSnapshot?.() ?? null;
	}

	export function selectComposition(): SectionPlayerSnapshot["composition"] | null {
		return kernelRef?.selectComposition?.() ?? null;
	}

	export function selectNavigation(): SectionPlayerSnapshot["navigation"] | null {
		return kernelRef?.selectNavigation?.() ?? null;
	}

	export function selectReadiness(): SectionPlayerSnapshot["readiness"] | null {
		return kernelRef?.selectReadiness?.() ?? null;
	}

	export function navigateTo(index: number): boolean {
		return kernelRef?.navigateTo?.(index) === true;
	}

	export function navigateNext(): boolean {
		return kernelRef?.navigateNext?.() === true;
	}

	export function navigatePrevious(): boolean {
		return kernelRef?.navigatePrevious?.() === true;
	}

	export function getSectionController() {
		return kernelRef?.getSectionController?.() || null;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	) {
		const controller = await kernelRef?.waitForSectionController?.(timeoutMs);
		return controller || null;
	}

	$effect(() => {
		if (!hostElement) return;
		const localHost = hostElement;
		return attachInstrumentationEventBridge({
			host: localHost,
			instrumentationProvider,
			component: "pie-section-player-vertical",
			eventMap: SECTION_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "section",
				assessmentId,
				sectionId,
				attemptId: attemptId || undefined,
			},
			shouldTrackEvent: (event: Event) => event.target === localHost,
			dedupeWindowMs: 100,
		});
	});
</script>

<div bind:this={anchor} class="pie-section-player-observability-anchor" aria-hidden="true"></div>
<SectionPlayerLayoutKernel
	bind:this={kernelRef}
	{assessmentId}
	{runtime}
	{section}
	{sectionId}
	{attemptId}
	{playerType}
	{player}
	{lazyInit}
	{tools}
	{accessibility}
	{coordinator}
	{createSectionController}
	{isolation}
	{env}
	{iifeBundleHost}
	{showToolbar}
	toolbarPosition={effectiveToolbarPosition}
	{enabledTools}
	{itemToolbarTools}
	{passageToolbarTools}
	playerActionConfig={{
		stateKey: "__verticalAppliedParams",
		includeSessionRefInState: false,
	}}
	on:readiness-change={forward}
	on:interaction-ready={forward}
	on:ready={forward}
	on:runtime-error={forward}
	on:runtime-owned={forward}
	on:runtime-inherited={forward}
	on:section-controller-ready={forward}
	on:session-changed={forward}
	on:composition-changed={forward}
	let:layoutModel
>
	<div class="pie-section-player-vertical-content">
		{#if layoutModel.passages.length > 0 && layoutModel.paneElementsLoaded}
			<section class="pie-section-player-passages-section" aria-label="Passages">
				<pie-section-player-passages-pane
					passages={layoutModel.passages}
					elementsLoaded={layoutModel.paneElementsLoaded}
					resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
					resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
					resolvedPlayerProps={layoutModel.resolvedPlayerProps}
					playerStrategy={layoutModel.playerStrategy}
					passageToolbarTools={passageToolbarTools}
				></pie-section-player-passages-pane>
			</section>
		{/if}

		<section class="pie-section-player-items-section" aria-label="Items">
			<pie-section-player-items-pane
				items={layoutModel.items}
				compositionModel={layoutModel.compositionModel}
				resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
				resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
				resolvedPlayerProps={layoutModel.resolvedPlayerProps}
				playerStrategy={layoutModel.playerStrategy}
				itemToolbarTools={itemToolbarTools}
				iifeBundleHost={iifeBundleHost}
				preloadedRenderables={layoutModel.preloadedRenderables}
				preloadedRenderablesSignature={layoutModel.preloadedRenderablesSignature}
				preloadComponentTag="pie-section-player-vertical"
				onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
			></pie-section-player-items-pane>
		</section>
	</div>
</SectionPlayerLayoutKernel>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	.pie-section-player-vertical-content {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
	}

	.pie-section-player-passages-section,
	.pie-section-player-items-section {
		min-height: 0;
		/* Prevent flexbox from compressing content sections.
		   Let the vertical container own scrolling instead. */
		flex: 0 0 auto;
	}

	.pie-section-player-passages-section {
		width: 100%;
	}

	.pie-section-player-observability-anchor {
		display: none;
	}
</style>
