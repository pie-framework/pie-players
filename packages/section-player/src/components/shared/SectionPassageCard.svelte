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
	<div class="content-card">
		<div
			class="content-card-header passage-header pie-section-player__passage-header"
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
			class="content-card-body passage-content pie-section-player__passage-content"
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
	.content-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.content-card-header h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.content-card-header pie-item-toolbar {
		margin-left: auto;
	}

	.content-card-body {
		padding: 1rem;
	}
</style>
