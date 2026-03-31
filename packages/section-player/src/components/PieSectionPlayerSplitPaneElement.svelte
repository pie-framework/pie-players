<svelte:options
	customElement={{
		tag: "pie-section-player-splitpane",
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
			debug: { attribute: "debug", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			sectionHostButtons: { type: "Object", reflect: false },
			itemHostButtons: { type: "Object", reflect: false },
			passageHostButtons: { type: "Object", reflect: false },
			policies: { type: "Object", reflect: false },
			hooks: { type: "Object", reflect: false },
			frameworkErrorHook: { type: "Object", reflect: false },
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
	import SectionPlayerVerticalContent from "./shared/SectionPlayerVerticalContent.svelte";
	// TS language service false-positive in this workspace: Svelte component has a default export.
	// @ts-ignore false-positive no-default-export in IDE language service for this import
	import SectionSplitDivider from "./shared/SectionSplitDivider.svelte";
	import { createEventDispatcher } from "svelte";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import {
		type RuntimeConfig,
	} from "./shared/section-player-runtime.js";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerPolicies } from "../policies/types.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";

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
		debug = undefined as string | boolean | undefined,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		policies = undefined as SectionPlayerPolicies | undefined,
		hooks = undefined as SectionPlayerHostHooks | undefined,
		frameworkErrorHook = undefined as
			| undefined
			| ((errorModel: Record<string, unknown>) => void),
		narrowLayoutBreakpoint = undefined as number | undefined,
	} = $props();

	const clampedBreakpoint = $derived.by(() => {
		const n = narrowLayoutBreakpoint ?? DEFAULT_NARROW_BREAKPOINT_PX;
		const num = typeof n === "number" ? n : Number(n);
		const value = Number.isFinite(num) ? num : DEFAULT_NARROW_BREAKPOINT_PX;
		return Math.max(
			NARROW_BREAKPOINT_MIN_PX,
			Math.min(NARROW_BREAKPOINT_MAX_PX, value),
		);
	});

	let leftPanelWidth = $state(50);
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let isStacked = $state(false);
	const dispatch = createEventDispatcher();
	const paneIdBase = $derived.by(() =>
		`pie-section-player-splitpane-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const passagesPaneId = $derived(`${paneIdBase}-passages`);
	const itemsPaneId = $derived(`${paneIdBase}-items`);
	const splitDividerValueText = $derived(`${Math.round(leftPanelWidth)}% passages width`);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			player,
			component: "pie-section-player-splitpane",
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

	$effect(() => {
		const bp = clampedBreakpoint;
		if (typeof window === "undefined") return;
		const query: MediaQueryList = window.matchMedia(`(max-width: ${bp}px)`);
		function update() {
			isStacked = query.matches;
		}
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	function forward(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	function handleSplitResizePreview(event: Event) {
		if (!splitContainerElement) return;
		const detail = (event as CustomEvent<{ value: number }>).detail;
		const next = Number(detail?.value);
		if (Number.isNaN(next)) return;
		leftPanelWidth = Math.max(20, Math.min(80, next));
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
			component: "pie-section-player-splitpane",
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
	{debug}
	{showToolbar}
	toolbarPosition={isStacked ? "top" : toolbarPosition}
	{enabledTools}
	{itemToolbarTools}
	{passageToolbarTools}
	{toolRegistry}
	{sectionHostButtons}
	{itemHostButtons}
	{passageHostButtons}
	{policies}
	{hooks}
	frameworkErrorHook={frameworkErrorHook}
	playerActionConfig={{
		stateKey: "__splitPaneAppliedParams",
		includeSessionRefInState: true,
	}}
	on:readiness-change={forward}
	on:interaction-ready={forward}
	on:ready={forward}
	on:runtime-error={forward}
	on:framework-error={forward}
	on:runtime-owned={forward}
	on:runtime-inherited={forward}
	on:section-controller-ready={forward}
	on:session-changed={forward}
	on:composition-changed={forward}
	on:element-preload-retry={forward}
	on:element-preload-error={forward}
	let:layoutModel
>
	{#if isStacked}
		<SectionPlayerVerticalContent
			{layoutModel}
			{itemToolbarTools}
			{passageToolbarTools}
			toolRegistry={layoutModel.toolRegistry}
			itemHostButtons={layoutModel.itemHostButtons}
			passageHostButtons={layoutModel.passageHostButtons}
			{iifeBundleHost}
			preloadComponentTag="pie-section-player-vertical"
		/>
	{:else}
		<div
			class={`pie-section-player-split-content ${layoutModel.passages.length === 0 ? "pie-section-player-split-content--no-passages" : ""}`}
			bind:this={splitContainerElement}
			style={layoutModel.passages.length === 0
				? "grid-template-columns: 1fr"
				: `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`}
		>
			{#if layoutModel.passages.length > 0}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex scrollable pane needs keyboard focus -->
				<aside
					id={passagesPaneId}
					class="pie-section-player-passages-pane"
					aria-label="Passages"
					tabindex="0"
				>
					<pie-section-player-passages-pane
						passages={layoutModel.passages}
						elementsLoaded={layoutModel.paneElementsLoaded}
						resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
						resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
						resolvedPlayerProps={layoutModel.resolvedPlayerProps}
						playerStrategy={layoutModel.playerStrategy}
						passageToolbarTools={passageToolbarTools}
						toolRegistry={layoutModel.toolRegistry}
						hostButtons={layoutModel.passageHostButtons}
					></pie-section-player-passages-pane>
				</aside>

				<SectionSplitDivider
					value={leftPanelWidth}
					ariaLabel="Resize passages and items panels"
					ariaControls={passagesPaneId}
					ariaValueText={splitDividerValueText}
					on:resize-preview={handleSplitResizePreview}
					on:resize-commit={handleSplitResizePreview}
				/>
			{/if}

			<main
				id={itemsPaneId}
				class="pie-section-player-items-pane"
				aria-label="Items"
			>
				<pie-section-player-items-pane
					items={layoutModel.items}
					compositionModel={layoutModel.compositionModel}
					resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
					resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
					resolvedPlayerProps={layoutModel.resolvedPlayerProps}
					playerStrategy={layoutModel.playerStrategy}
					itemToolbarTools={itemToolbarTools}
					toolRegistry={layoutModel.toolRegistry}
					hostButtons={layoutModel.itemHostButtons}
					iifeBundleHost={iifeBundleHost}
					preloadedRenderables={layoutModel.preloadedRenderables}
					preloadedRenderablesSignature={layoutModel.preloadedRenderablesSignature}
					preloadComponentTag="pie-section-player-splitpane"
					onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
					onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
					onelement-preload-error={layoutModel.onItemsPanePreloadError}
				></pie-section-player-items-pane>
			</main>
		</div>
	{/if}
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

	.pie-section-player-split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.pie-section-player-passages-pane,
	.pie-section-player-items-pane {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		padding: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
		scrollbar-width: thin;
		scrollbar-color:
			var(--pie-scrollbar-thumb, #6b7280) var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-passages-pane:focus-visible,
	.pie-section-player-items-pane:focus-visible {
		outline: 2px solid var(--pie-focus-outline, #1d4ed8);
		outline-offset: -2px;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar,
	.pie-section-player-items-pane::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-track,
	.pie-section-player-items-pane::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, #d1d5db);
		border-radius: 999px;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, #6b7280);
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb:hover,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, #4b5563);
	}

	.pie-section-player-observability-anchor {
		display: none;
	}

</style>
