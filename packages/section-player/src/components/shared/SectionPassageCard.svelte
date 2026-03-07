<svelte:options
	customElement={{
		tag: "pie-section-player-passage-card",
		shadow: "none",
		props: {
			passage: { type: "Object", reflect: false },
			resolvedPlayerTag: { attribute: "resolved-player-tag", type: "String" },
			playerAction: { type: "Object", reflect: false },
			playerParams: { attribute: "player-params", type: "Object", reflect: false },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
		},
	}}
/>

<script lang="ts">
	import { onMount } from "svelte";
	import "../passage-shell-element.js";
	import "@pie-players/pie-toolbars/components/item-toolbar-element";
	import { getEntityTitle } from "./composition.js";
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
	import type { PlayerElementParams } from "./player-action.js";
	import {
		connectSectionPlayerCardRenderContext,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";

	let {
		passage,
		resolvedPlayerTag = "div",
		playerAction = (_node: HTMLElement, _params: PlayerElementParams) => undefined,
		playerParams,
		passageToolbarTools,
	} = $props<{
		passage: PassageEntity;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		passageToolbarTools: string;
	}>();

	let contextAnchor = $state<HTMLDivElement | null>(null);
	let contextResolvedPlayerTag = $state<string | null>(null);
	let contextPlayerAction = $state<
		((node: HTMLElement, params: PlayerElementParams) => unknown) | null
	>(null);
	const effectiveResolvedPlayerTag = $derived(contextResolvedPlayerTag || resolvedPlayerTag);
	const effectivePlayerAction = $derived(contextPlayerAction || playerAction);

	function getHostElement(): HTMLElement | null {
		if (!contextAnchor) return null;
		const rootNode = contextAnchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return contextAnchor.parentElement as HTMLElement | null;
	}

	function applyCardRenderContext(value: SectionPlayerCardRenderContext): void {
		if (!value || typeof value !== "object") return;
		if (typeof value.resolvedPlayerTag === "string" && value.resolvedPlayerTag.trim()) {
			contextResolvedPlayerTag = value.resolvedPlayerTag;
		}
		if (typeof value.playerAction === "function") {
			contextPlayerAction = value.playerAction;
		}
	}

	onMount(() => {
		const host = getHostElement();
		if (!host) return;
		return connectSectionPlayerCardRenderContext(host, applyCardRenderContext);
	});
</script>

<div bind:this={contextAnchor} class="pie-section-player-passage-card-anchor" aria-hidden="true"></div>
<pie-passage-shell
	item-id={passage.id}
	content-kind="rubric-block-stimulus"
	item={passage}
>
	<div class="pie-section-player-content-card">
		<div
			class="pie-section-player-content-card-header pie-section-player-passage-header pie-section-player__passage-header"
			data-region="header"
		>
			{#if getEntityTitle(passage)}
				<h2>{getEntityTitle(passage)}</h2>
			{/if}
			<pie-item-toolbar
				item-id={passage.id}
				catalog-id={passage.id}
				tools={passageToolbarTools}
				content-kind="rubric-block-stimulus"
				size="md"
				language="en-US"
			></pie-item-toolbar>
		</div>
		<div
			class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
			data-region="content"
		>
			<svelte:element
				this={effectiveResolvedPlayerTag}
				use:effectivePlayerAction={playerParams}
			></svelte:element>
		</div>
	</div>
</pie-passage-shell>

<style>
	.pie-section-player-passage-card-anchor {
		display: none;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-content-card-header h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header pie-item-toolbar {
		margin-left: auto;
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
		color: var(--pie-text, #111827);
	}
</style>
