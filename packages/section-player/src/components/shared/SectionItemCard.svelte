<script lang="ts">
	import "../item-shell-element.js";
	import "@pie-players/pie-toolbars/components/item-toolbar-element";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import { getEntityTitle } from "./composition.js";
	import type { PlayerElementParams } from "./player-action.js";

	let {
		item,
		canonicalItemId,
		resolvedPlayerTag,
		playerAction,
		playerParams,
		itemToolbarTools,
	} = $props<{
		item: ItemEntity;
		canonicalItemId: string;
		resolvedPlayerTag: string;
		playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		itemToolbarTools: string;
	}>();
</script>

<pie-item-shell
	item-id={item.id}
	canonical-item-id={canonicalItemId}
	content-kind="assessment-item"
	item={item}
>
	<div class="pie-section-player-content-card">
		<div
			class="pie-section-player-content-card-header pie-section-player-item-header pie-section-player__item-header"
			data-region="header"
		>
			{#if getEntityTitle(item)}
				<h2>{getEntityTitle(item)}</h2>
			{/if}
			<pie-item-toolbar
				item-id={item.id}
				catalog-id={item.id}
				tools={itemToolbarTools}
				content-kind="assessment-item"
				size="md"
				language="en-US"
			></pie-item-toolbar>
		</div>
		<div
			class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
			data-region="content"
		>
			<svelte:element
				this={resolvedPlayerTag}
				use:playerAction={playerParams}
			></svelte:element>
		</div>
		<div data-region="footer"></div>
	</div>
</pie-item-shell>

<style>
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
