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
	} = $props();

	let leftPanelWidth = $state(50);
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<{
		getSnapshot?: () => unknown;
		selectComposition?: () => unknown;
		selectNavigation?: () => unknown;
		selectReadiness?: () => unknown;
		navigateTo?: (index: number) => boolean;
		navigateNext?: () => boolean;
		navigatePrevious?: () => boolean;
		preloadNow?: () => void;
	} | null>(null);
	const dispatch = createEventDispatcher();

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

	export function getSnapshot(): unknown {
		return kernelRef?.getSnapshot?.() ?? null;
	}

	export function selectComposition(): unknown {
		return kernelRef?.selectComposition?.() ?? null;
	}

	export function selectNavigation(): unknown {
		return kernelRef?.selectNavigation?.() ?? null;
	}

	export function selectReadiness(): unknown {
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

	export function preloadNow(): void {
		kernelRef?.preloadNow?.();
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
	{toolbarPosition}
	{enabledTools}
	{itemToolbarTools}
	{passageToolbarTools}
	playerActionConfig={{
		stateKey: "__splitPaneAppliedParams",
		setSkipElementLoadingOnce: true,
		includeSessionRefInState: true,
	}}
	on:readiness-change={forward}
	on:interaction-ready={forward}
	on:ready={forward}
	on:runtime-error={forward}
	on:runtime-owned={forward}
	on:runtime-inherited={forward}
	on:session-changed={forward}
	on:composition-changed={forward}
	on:navigation-change={forward}
	let:layoutModel
>
	<div
		class={`pie-section-player-split-content ${layoutModel.passages.length === 0 ? "pie-section-player-split-content--no-passages" : ""}`}
		bind:this={splitContainerElement}
		style={layoutModel.passages.length > 0
			? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
			: "grid-template-columns: 1fr"}
	>
		{#if layoutModel.passages.length > 0}
			<aside class="pie-section-player-passages-pane" aria-label="Passages">
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

			<SectionSplitDivider
				value={leftPanelWidth}
				on:resize-preview={handleSplitResizePreview}
				on:resize-commit={handleSplitResizePreview}
			/>
		{/if}

		<main class="pie-section-player-items-pane" aria-label="Items">
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

	@media (max-width: 1100px) {
		.pie-section-player-split-content {
			grid-template-columns: 1fr !important;
		}

		:global(.pie-section-player-split-divider) {
			display: none;
		}
	}
</style>
