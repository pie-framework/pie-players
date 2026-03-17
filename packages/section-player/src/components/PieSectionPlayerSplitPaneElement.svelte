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
	import { onMount } from "svelte";
	import "./section-player-item-card-element.js";
	import "./section-player-passage-card-element.js";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import SectionSplitDivider from "./shared/SectionSplitDivider.svelte";
	import { createEventDispatcher } from "svelte";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import { manageOuterScrollbars } from "./shared/outer-scrollbars.js";
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
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let isStacked = $state(false);
	const dispatch = createEventDispatcher();
	const paneIdBase = $derived.by(() =>
		`pie-section-player-splitpane-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const passagesPaneId = $derived(`${paneIdBase}-passages`);
	const itemsPaneId = $derived(`${paneIdBase}-items`);
	const splitDividerValueText = $derived(`${Math.round(leftPanelWidth)}% passages width`);

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

	onMount(() => {
		return manageOuterScrollbars();
	});

</script>

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
	toolbarPosition={isStacked ? "top" : toolbarPosition}
	{enabledTools}
	{itemToolbarTools}
	{passageToolbarTools}
	playerActionConfig={{
		stateKey: "__splitPaneAppliedParams",
		includeSessionRefInState: true,
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
	<div
		class={`pie-section-player-split-content ${layoutModel.passages.length === 0 ? "pie-section-player-split-content--no-passages" : ""} ${isStacked ? "pie-section-player-split-content--stacked" : ""}`}
		bind:this={splitContainerElement}
		style={layoutModel.passages.length === 0
			? "grid-template-columns: 1fr"
			: !isStacked
				? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
				: ""}
	>
		{#if layoutModel.passages.length > 0}
			<aside
				id={passagesPaneId}
				class="pie-section-player-passages-pane"
				aria-label="Passages"
			>
				<pie-section-player-passages-pane
					passages={layoutModel.passages}
					elementsLoaded={layoutModel.paneElementsLoaded}
					resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
					resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
					resolvedPlayerProps={layoutModel.resolvedPlayerProps}
					playerStrategy={layoutModel.playerStrategy}
					passageToolbarTools={passageToolbarTools}
				></pie-section-player-passages-pane>
			</aside>

			{#if !isStacked}
				<SectionSplitDivider
					value={leftPanelWidth}
					ariaLabel="Resize passages and items panels"
					ariaControls={passagesPaneId}
					ariaValueText={splitDividerValueText}
					on:resize-preview={handleSplitResizePreview}
					on:resize-commit={handleSplitResizePreview}
				/>
			{/if}
		{/if}

		<main id={itemsPaneId} class="pie-section-player-items-pane" aria-label="Items">
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
				preloadComponentTag="pie-section-player-splitpane"
				onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
			></pie-section-player-items-pane>
		</main>
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

	.pie-section-player-split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	/* Collapsed/stacked: single column, passage(s) then items, no separator (mirrors vertical player) */
	.pie-section-player-split-content--stacked {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		gap: 1rem;
	}

	.pie-section-player-split-content--stacked .pie-section-player-passages-pane,
	.pie-section-player-split-content--stacked .pie-section-player-items-pane {
		flex: 0 0 auto;
		height: auto;
		max-height: none;
		min-height: 0;
		overflow: visible;
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
	}

	:global(html.pie-outer-scrollbars-managed),
	:global(body.pie-outer-scrollbars-managed) {
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
	}

	:global(html.pie-outer-scrollbars-managed.pie-outer-scrolling),
	:global(body.pie-outer-scrollbars-managed.pie-outer-scrolling) {
		scrollbar-color: #c1c1c1 #f1f1f1;
	}

	:global(html.pie-outer-scrollbars-managed::-webkit-scrollbar),
	:global(body.pie-outer-scrollbars-managed::-webkit-scrollbar) {
		width: 0;
		height: 0;
		background: transparent;
	}

	:global(html.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar),
	:global(body.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}

	:global(html.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-track),
	:global(body.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-track) {
		background: #f1f1f1;
		border-radius: 4px;
	}

	:global(html.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-thumb),
	:global(body.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-thumb) {
		background: #c1c1c1;
		border-radius: 4px;
	}

	:global(html.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-thumb:hover),
	:global(body.pie-outer-scrollbars-managed.pie-outer-scrolling::-webkit-scrollbar-thumb:hover) {
		background: #a1a1a1;
	}
</style>
