<!--
  ItemModeLayout - Internal Component

  Renders item mode (keepTogether: false) - one item at a time with navigation.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { PassageEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import PassageRenderer from './PassageRenderer.svelte';
	import ItemRenderer from './ItemRenderer.svelte';
	import ItemNavigation from './ItemNavigation.svelte';

	let {
		passages,
		currentItem,
		currentIndex,
		totalItems,
		canNext,
		canPrevious,
		itemSession,
		mode = 'gather',
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		onprevious,
		onnext,
		onsessionchanged
	}: {
		passages: PassageEntity[];
		currentItem: ItemEntity | null;
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		itemSession?: any;
		mode?: 'gather' | 'view' | 'evaluate' | 'author';
		bundleHost?: string;
		esmCdnUrl?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		onprevious?: () => void;
		onnext?: () => void;
		onsessionchanged?: (session: any) => void;
	} = $props();

	function handleSessionChanged(event: CustomEvent) {
		if (onsessionchanged) {
			onsessionchanged(event.detail);
		}
	}
</script>

<div class="item-mode-layout">
	<!-- Passages (visible for all items) -->
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

	<!-- Current Item -->
	{#if currentItem}
		<div class="current-item-section">
			<ItemRenderer
				item={currentItem}
				{mode}
				session={itemSession}
				{bundleHost}
				{esmCdnUrl}
				{ttsService}
				{toolCoordinator}
				{highlightCoordinator}
				onsessionchanged={handleSessionChanged}
				class="item-content"
			/>
		</div>
	{:else}
		<div class="no-item">
			<p>No item to display</p>
		</div>
	{/if}

	<!-- Navigation -->
	<ItemNavigation
		{currentIndex}
		{totalItems}
		{canNext}
		{canPrevious}
		{onprevious}
		{onnext}
	/>
</div>

<style>
	.item-mode-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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

	.current-item-section {
		padding: 1rem;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		min-height: 300px;
	}

	.no-item {
		padding: 2rem;
		text-align: center;
		color: #999;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.item-mode-layout {
			gap: 1rem;
		}
	}
</style>
