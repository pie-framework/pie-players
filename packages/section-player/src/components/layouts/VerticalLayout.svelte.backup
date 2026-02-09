<!--
  VerticalLayout - Internal Component

  Renders vertical layout - passages first, then all items stacked vertically.
  Traditional assessment format with linear reading flow.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { ItemEntity, PassageEntity } from '@pie-players/pie-players-shared/types';
	import ItemRenderer from '../ItemRenderer.svelte';
	import PassageRenderer from '../PassageRenderer.svelte';

	let {
		passages,
		items,
		itemSessions = {},
		env = { mode: 'gather', role: 'student' },
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		playerVersion = 'latest',
		playerType = 'auto',
		assessmentId = '',
		sectionId = '',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		catalogResolver = null,
		elementToolStateStore = null,
		onsessionchanged
	}: {
		passages: PassageEntity[];
		items: ItemEntity[];
		itemSessions?: Record<string, any>;
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		bundleHost?: string;
		esmCdnUrl?: string;
		playerVersion?: string;
		playerType?: 'auto' | 'iife' | 'esm' | 'fixed' | 'inline';
		assessmentId?: string;
		sectionId?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		catalogResolver?: any;
		elementToolStateStore?: any;
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

<div class="vertical-layout">
	<!-- Passages -->
	{#if passages.length > 0}
		<div class="passages-section">
			{#each passages as passage (passage.id)}
				<PassageRenderer
					{passage}
					{bundleHost}
					{esmCdnUrl}
					{assessmentId}
					{sectionId}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					{catalogResolver}
					{elementToolStateStore}
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
					{env}
					session={itemSessions[item.id || '']}
					{bundleHost}
					{esmCdnUrl}
					{playerVersion}
					{playerType}
					{assessmentId}
					{sectionId}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					{catalogResolver}
					{elementToolStateStore}
					onsessionchanged={handleItemSessionChanged(item.id || '')}
					class="item-content"
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.vertical-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.passages-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.items-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.item-wrapper {
		flex-shrink: 0;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.vertical-layout {
			padding: 0.5rem;
			gap: 1rem;
		}

		.items-section {
			gap: 1rem;
		}
	}

	/* Scrollbar styling */
	.vertical-layout::-webkit-scrollbar {
		width: 8px;
	}

	.vertical-layout::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	.vertical-layout::-webkit-scrollbar-thumb {
		background: #c1c1c1;
		border-radius: 4px;
	}

	.vertical-layout::-webkit-scrollbar-thumb:hover {
		background: #a1a1a1;
	}
</style>
