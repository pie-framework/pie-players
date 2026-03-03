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
	import { createPlayerAction } from "./shared/player-action.js";
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
		mapRenderablesToItems,
		resolveSectionPlayerRuntimeState,
		type RuntimeConfig,
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
	let elementsLoaded = $state(false);
	let lastPreloadSignature = $state("");
	let preloadRunToken = $state(0);

	const passages = $derived(compositionModel.passages || []);
	const items = $derived(compositionModel.items || []);
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
	const verticalPlayerAction = createPlayerAction({
		stateKey: "__verticalAppliedParams",
		includeSessionRefInState: false,
	});

	function handleBaseCompositionChanged(event: Event) {
		compositionModel = getCompositionFromEvent(event);
	}

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error) => {
			console.error("[pie-section-player-vertical] Failed to load item player component:", error);
		});
	});

	$effect(() => {
		orchestratePlayerElementPreload({
			componentTag: "pie-section-player-vertical",
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
			<div class="pie-section-player-vertical-content">
				{#if !elementsLoaded}
					<div class="pie-section-player-content-card">
						<div
							class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
						>
							Loading section content...
						</div>
					</div>
				{:else}
					{#if passages.length > 0}
						<section class="pie-section-player-passages-section" aria-label="Passages">
							{#each passages as passage, passageIndex (passage.id || passageIndex)}
								<SectionPassageCard
									{passage}
									{resolvedPlayerTag}
									playerAction={verticalPlayerAction}
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
						</section>
					{/if}

					<section class="pie-section-player-items-section" aria-label="Items">
						{#each items as item, itemIndex (item.id || itemIndex)}
							<SectionItemCard
								{item}
								canonicalItemId={getCanonicalItemId({ compositionModel, item })}
								{resolvedPlayerTag}
								playerAction={verticalPlayerAction}
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
					</section>
				{/if}
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
	}

	.pie-section-player-passages-section,
	.pie-section-player-items-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

		.pie-section-player-toolbar-pane--left,
		.pie-section-player-toolbar-pane--right {
			border: none;
			padding: 0;
		}
	}
</style>
