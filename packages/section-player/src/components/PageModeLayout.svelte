<!--
  PageModeLayout - Internal Component

  Renders page mode (keepTogether: true) - all items and passages visible.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { PassageEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import PassageRenderer from './PassageRenderer.svelte';
	import ItemRenderer from './ItemRenderer.svelte';

	let {
		passages,
		items,
		itemSessions = {},
		mode = 'gather',
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		onsessionchanged
	}: {
		passages: PassageEntity[];
		items: ItemEntity[];
		itemSessions?: Record<string, any>;
		mode?: 'gather' | 'view' | 'evaluate' | 'author';
		bundleHost?: string;
		esmCdnUrl?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		onsessionchanged?: (itemId: string, session: any) => void;
	} = $props();

	function handleItemSessionChanged(itemId: string) {
		return (event: CustomEvent) => {
			if (onsessionchanged) {
				onsessionchanged(itemId, event.detail);
			}
		};
	}
</script>

<div class="page-mode-layout">
	<!-- Passages -->
	{#if passages.length > 0}
		<div class="passages-section">
			{#each passages as passage (passage.id)}
				<PassageRenderer
					{passage}
					{bundleHost}
					{esmCdnUrl}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					class="passage-item"
				/>
			{/each}
		</div>
	{/if}

	<!-- All Items -->
	<div class="items-section">
		{#each items as item, index (item.id || index)}
			<div class="item-wrapper" data-item-index={index}>
				<ItemRenderer
					{item}
					{mode}
					session={itemSessions[item.id || '']}
					{bundleHost}
					{esmCdnUrl}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					onsessionchanged={handleItemSessionChanged(item.id || '')}
					class="item-content"
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.page-mode-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
	}

	.passages-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.passages-section :global(.passage-item) {
		padding: 1rem;
		background: #fafafa;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
	}

	.items-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.item-wrapper {
		padding: 1rem;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page-mode-layout {
			padding: 0.5rem;
			gap: 1rem;
		}

		.items-section {
			gap: 1rem;
		}
	}
</style>
