<svelte:options
	customElement={{
		tag: "pie-section-player-items-pane",
		// Keep light DOM so rendered item content can inherit assessment/runtime styles.
		shadow: "none",
		props: {
			items: { type: "Object", reflect: false },
			compositionModel: { attribute: "composition-model", type: "Object", reflect: false },
			resolvedPlayerEnv: { attribute: "resolved-player-env", type: "Object", reflect: false },
			resolvedPlayerAttributes: {
				attribute: "resolved-player-attributes",
				type: "Object",
				reflect: false,
			},
			resolvedPlayerProps: { attribute: "resolved-player-props", type: "Object", reflect: false },
			playerStrategy: { attribute: "player-strategy", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			preloadedRenderables: { attribute: "preloaded-renderables", type: "Object", reflect: false },
			preloadedRenderablesSignature: {
				attribute: "preloaded-renderables-signature",
				type: "String",
			},
			preloadComponentTag: { attribute: "preload-component-tag", type: "String" },
		},
	}}
/>

<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import "../section-player-item-card-element.js";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import {
		createPlayerPreloadStateSetter,
		orchestratePlayerElementPreload,
		type PlayerPreloadState,
	} from "./player-preload.js";
	import {
		getCanonicalItemId,
		getItemPlayerParams,
	} from "./section-player-view-state.js";

	let {
		items = [] as ItemEntity[],
		compositionModel,
		resolvedPlayerEnv = {} as Record<string, unknown>,
		resolvedPlayerAttributes = {} as Record<string, string>,
		resolvedPlayerProps = {} as Record<string, unknown>,
		playerStrategy = "preloaded",
		itemToolbarTools = "",
		iifeBundleHost = "",
		preloadedRenderables = [] as ItemEntity[],
		preloadedRenderablesSignature = "",
		preloadComponentTag = "pie-section-player-items-pane",
	} = $props<{
		items: ItemEntity[];
		compositionModel: SectionCompositionModel;
		resolvedPlayerEnv: Record<string, unknown>;
		resolvedPlayerAttributes: Record<string, string>;
		resolvedPlayerProps: Record<string, unknown>;
		playerStrategy: string;
		itemToolbarTools: string;
		iifeBundleHost?: string | null;
		preloadedRenderables: ItemEntity[];
		preloadedRenderablesSignature: string;
		preloadComponentTag?: string;
	}>();

	const dispatch = createEventDispatcher<{
		"elements-loaded-change": { elementsLoaded: boolean };
	}>();
	let elementsLoaded = $state(false);
	let lastPreloadSignature = $state("");
	let preloadRunToken = $state(0);
	const setPreloadState = createPlayerPreloadStateSetter({
		setLastPreloadSignature: (value) => {
			lastPreloadSignature = value;
		},
		setPreloadRunToken: (value) => {
			preloadRunToken = value;
		},
		setElementsLoaded: (value) => {
			elementsLoaded = value;
		},
	});

	$effect(() => {
		dispatch("elements-loaded-change", { elementsLoaded });
	});

	$effect(() => {
		orchestratePlayerElementPreload({
			componentTag: preloadComponentTag,
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
			setState: setPreloadState,
		});
	});
</script>

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
		<pie-section-player-item-card
			{item}
			canonicalItemId={getCanonicalItemId({ compositionModel, item })}
			playerParams={getItemPlayerParams({
				item,
				compositionModel,
				resolvedPlayerEnv,
				resolvedPlayerAttributes,
				resolvedPlayerProps,
				playerStrategy,
			})}
			itemToolbarTools={itemToolbarTools}
		></pie-section-player-item-card>
	{/each}
{/if}

<style>
	:host {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		min-width: 0;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
	}
</style>
