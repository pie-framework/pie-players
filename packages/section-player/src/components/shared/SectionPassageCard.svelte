<script lang="ts">
	import "../passage-shell-element.js";
	import "@pie-players/pie-toolbars/components/item-toolbar-element";
	import { getEntityTitle } from "./composition.js";
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
	import type { PlayerElementParams } from "./player-action.js";

	let {
		passage,
		resolvedPlayerTag,
		playerAction,
		playerParams,
		passageToolbarTools,
	} = $props<{
		passage: PassageEntity;
		resolvedPlayerTag: string;
		playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		passageToolbarTools: string;
	}>();
</script>

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
				this={resolvedPlayerTag}
				use:playerAction={playerParams}
			></svelte:element>
		</div>
	</div>
</pie-passage-shell>

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
