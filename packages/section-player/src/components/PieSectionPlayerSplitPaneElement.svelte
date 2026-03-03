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
			showToolbar: { attribute: "show-toolbar", type: "Boolean" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
		},
	}}
/>

<script lang="ts">
	import "./section-player-base-element.js";
	import * as SectionItemCardModule from "./shared/SectionItemCard.svelte";
	import * as SectionPassageCardModule from "./shared/SectionPassageCard.svelte";
	import "@pie-players/pie-toolbars/components/section-toolbar-element";
	import "@pie-players/pie-tool-calculator";
	import "@pie-players/pie-tool-graph";
	import "@pie-players/pie-tool-periodic-table";
	import "@pie-players/pie-tool-protractor";
	import "@pie-players/pie-tool-line-reader";
	import "@pie-players/pie-tool-ruler";
	import type { Component } from "svelte";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import {
		EMPTY_COMPOSITION,
	} from "./shared/composition.js";
	import {
		createPlayerAction,
	} from "./shared/player-action.js";
	import {
		getRenderablesSignature,
		orchestratePlayerElementPreload,
		type PlayerPreloadState,
	} from "./shared/player-preload.js";
	import {
		getCanonicalItemId,
		getCompositionFromEvent,
		getItemPlayerParams,
		getPassagePlayerParams,
	} from "./shared/section-player-view-state.js";
	import {
		type RuntimeConfig,
		mapRenderablesToItems,
		resolveSectionPlayerRuntimeState,
	} from "./shared/section-player-runtime.js";

	const SectionItemCard = (
		SectionItemCardModule as unknown as { default: Component<any, any, any> }
	).default;
	const SectionPassageCard = (
		SectionPassageCardModule as unknown as {
			default: Component<any, any, any>;
		}
	).default;

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
		showToolbar = true,
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
	} = $props();

	let compositionModel = $state<SectionCompositionModel>(EMPTY_COMPOSITION);
	let leftPanelWidth = $state(50);
	let isDragging = $state(false);
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	let elementsLoaded = $state(false);
	let lastPreloadSignature = $state("");
	let preloadRunToken = $state(0);

	const passages = $derived(compositionModel.passages || []);
	const items = $derived(compositionModel.items || []);
	const hasPassages = $derived(passages.length > 0);
	const shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== "none");
	const toolbarBeforeContent = $derived(
		toolbarPosition === "top" || toolbarPosition === "left",
	);
	const toolbarInline = $derived(toolbarPosition === "left" || toolbarPosition === "right");
	const preloadedRenderables = $derived.by(() =>
		mapRenderablesToItems(compositionModel.renderables || []),
	);
	const preloadedRenderablesSignature = $derived.by(() =>
		getRenderablesSignature(compositionModel.renderables || []),
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
	const splitPanePlayerAction = createPlayerAction({
		stateKey: "__splitPaneAppliedParams",
		setSkipElementLoadingOnce: true,
		includeSessionRefInState: true,
	});

	function handleBaseCompositionChanged(event: Event) {
		compositionModel = getCompositionFromEvent(event);
	}

	function handleDividerMouseDown(event: MouseEvent) {
		event.preventDefault();
		isDragging = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}

	function handleDividerMouseMove(event: MouseEvent) {
		if (!isDragging || !splitContainerElement) return;
		const containerRect = splitContainerElement.getBoundingClientRect();
		const offsetX = event.clientX - containerRect.left;
		const newWidth = (offsetX / containerRect.width) * 100;
		if (newWidth >= 20 && newWidth <= 80) {
			leftPanelWidth = newWidth;
		}
	}

	function handleDividerMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}

	function handleDividerKeyDown(event: KeyboardEvent) {
		const step = 5;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			leftPanelWidth = Math.max(20, leftPanelWidth - step);
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			leftPanelWidth = Math.min(80, leftPanelWidth + step);
		}
	}

	$effect(() => {
		if (!isDragging) return;
		window.addEventListener("mousemove", handleDividerMouseMove);
		window.addEventListener("mouseup", handleDividerMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleDividerMouseMove);
			window.removeEventListener("mouseup", handleDividerMouseUp);
		};
	});

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error) => {
			console.error("[pie-section-player-splitpane] Failed to load item player component:", error);
		});
	});

	$effect(() => {
		orchestratePlayerElementPreload({
			componentTag: "pie-section-player-splitpane",
			strategy: playerStrategy,
			renderables: preloadedRenderables,
			renderablesSignature: preloadedRenderablesSignature,
			resolvedPlayerProps: resolvedPlayerProps as Record<string, unknown>,
			resolvedPlayerEnv: resolvedPlayerEnv as Record<string, unknown>,
			iifeBundleHost,
			getState: () =>
				({
					lastPreloadSignature,
					preloadRunToken,
					elementsLoaded,
				}) as PlayerPreloadState,
			setState: (next) => {
				if (next.lastPreloadSignature !== undefined) {
					lastPreloadSignature = next.lastPreloadSignature;
				}
				if (next.preloadRunToken !== undefined) {
					preloadRunToken = next.preloadRunToken;
				}
				if (next.elementsLoaded !== undefined) {
					elementsLoaded = next.elementsLoaded;
				}
			},
		});
	});

</script>

<pie-section-player-base
	runtime={effectiveRuntime}
	{section}
	section-id={sectionId}
	attempt-id={attemptId}
	oncomposition-changed={handleBaseCompositionChanged}
>
	<div
		class={`pie-section-player-shell pie-section-player-shell--${toolbarPosition}`}
	>
		{#if shouldRenderToolbar && toolbarBeforeContent}
			<pie-section-toolbar
				class={`pie-section-player-toolbar pie-section-player-toolbar--${toolbarPosition}`}
				position={toolbarPosition}
				enabled-tools={enabledTools}
			></pie-section-toolbar>
		{/if}

		<div
			class={`pie-section-player-layout-body ${toolbarInline ? "pie-section-player-layout-body--inline" : ""}`}
		>
			<div
				class={`pie-section-player-split-content ${!hasPassages ? "pie-section-player-split-content--no-passages" : ""}`}
				bind:this={splitContainerElement}
				style={hasPassages
					? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
					: "grid-template-columns: 1fr"}
			>
				{#if hasPassages}
					<aside class="pie-section-player-passages-pane" aria-label="Passages">
						{#if !elementsLoaded}
							<div class="pie-section-player-content-card">
								<div
									class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
								>
									Loading passage content...
								</div>
							</div>
						{:else}
							{#each passages as passage, passageIndex (passage.id || passageIndex)}
								<SectionPassageCard
									{passage}
									{resolvedPlayerTag}
									playerAction={splitPanePlayerAction}
									playerParams={getPassagePlayerParams({
										passage,
										resolvedPlayerEnv,
										resolvedPlayerAttributes,
										resolvedPlayerProps,
										playerStrategy,
									})}
									{passageToolbarTools}
								/>
							{/each}
						{/if}
					</aside>

					<button
						type="button"
						class={`pie-section-player-split-divider ${isDragging ? "pie-section-player-split-divider--dragging" : ""}`}
						onmousedown={handleDividerMouseDown}
						onkeydown={handleDividerKeyDown}
						aria-label="Resize panels"
					>
						<span class="pie-section-player-split-divider-handle"></span>
					</button>
				{/if}

				<main class="pie-section-player-items-pane" aria-label="Items">
					{#if !elementsLoaded}
						<div class="pie-section-player-content-card">
							<div
								class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
							>
								Loading section content...
							</div>
						</div>
					{:else}
						{#each items as item, itemIndex (item.id || itemIndex)}
						<SectionItemCard
							{item}
							canonicalItemId={getCanonicalItemId({ compositionModel, item })}
							{resolvedPlayerTag}
							playerAction={splitPanePlayerAction}
							playerParams={getItemPlayerParams({
								item,
								compositionModel,
								resolvedPlayerEnv,
								resolvedPlayerAttributes,
								resolvedPlayerProps,
								playerStrategy,
							})}
							{itemToolbarTools}
						/>
						{/each}
					{/if}
				</main>
			</div>

			{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "right"}
				<aside
					class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--right"
					aria-label="Section tools"
				>
					<pie-section-toolbar
						position="right"
						enabled-tools={enabledTools}
					></pie-section-toolbar>
				</aside>
			{/if}

			{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "left"}
				<aside
					class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--left"
					aria-label="Section tools"
				>
					<pie-section-toolbar
						position="left"
						enabled-tools={enabledTools}
					></pie-section-toolbar>
				</aside>
			{/if}
		</div>

		{#if shouldRenderToolbar && !toolbarBeforeContent && !toolbarInline}
			<pie-section-toolbar
				class={`pie-section-player-toolbar pie-section-player-toolbar--${toolbarPosition}`}
				position={toolbarPosition}
				enabled-tools={enabledTools}
			></pie-section-toolbar>
		{/if}
	</div>
</pie-section-player-base>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	.pie-section-player-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player-shell--left,
	.pie-section-player-shell--right {
		flex-direction: row;
	}

	.pie-section-player-shell--left .pie-section-player-layout-body--inline {
		order: 2;
	}

	.pie-section-player-shell--left .pie-section-player-toolbar-pane--left {
		order: 1;
	}

	.pie-section-player-layout-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player-layout-body--inline {
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
	}

	.pie-section-player-split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.pie-section-player-split-content--no-passages .pie-section-player-items-pane {
		padding-left: 0.5rem;
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
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.pie-section-player-toolbar-pane {
		min-height: 0;
		overflow: auto;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.pie-section-player-toolbar-pane--right {
		border-left: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-toolbar-pane--left {
		border-right: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-toolbar {
		margin: 0.5rem;
	}

	.pie-section-player-toolbar-pane pie-section-toolbar {
		margin: 0.5rem;
	}

	.pie-section-player-split-divider {
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.pie-section-player-split-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-split-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.pie-section-player-split-divider-handle {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.pie-section-player-split-divider-handle::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.pie-section-player-split-divider:hover .pie-section-player-split-divider-handle,
	.pie-section-player-split-divider:focus .pie-section-player-split-divider-handle,
	.pie-section-player-split-divider--dragging .pie-section-player-split-divider-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.pie-section-player-split-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-white, #fff);
	}

	.pie-section-player-content-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
	}

	@media (max-width: 1100px) {
		.pie-section-player-shell--left,
		.pie-section-player-shell--right {
			flex-direction: column;
		}

		.pie-section-player-layout-body--inline {
			grid-template-columns: 1fr;
		}

		.pie-section-player-split-content {
			grid-template-columns: 1fr !important;
		}

		.pie-section-player-split-divider {
			display: none;
		}

		.pie-section-player-toolbar-pane--left,
		.pie-section-player-toolbar-pane--right {
			border: none;
			padding: 0;
		}
	}
</style>
