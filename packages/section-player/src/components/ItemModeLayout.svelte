<!--
  ItemModeLayout - Internal Component

  Renders item mode (keepTogether: false) - one item at a time with navigation.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { ItemEntity, PassageEntity } from '@pie-players/pie-players-shared/types';
	import ItemNavigation from './ItemNavigation.svelte';
	import ItemRenderer from './ItemRenderer.svelte';
	import PassageRenderer from './PassageRenderer.svelte';

	let {
		passages,
		currentItem,
		currentIndex,
		totalItems,
		canNext,
		canPrevious,
		itemSession,
		env = { mode: 'gather', role: 'student' },
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		playerVersion = 'latest',
		assessmentId = '',
		sectionId = '',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		catalogResolver = null,
		elementToolStateStore = null,
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
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		bundleHost?: string;
		esmCdnUrl?: string;
		playerVersion?: string;
		assessmentId?: string;
		sectionId?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		catalogResolver?: any;
		elementToolStateStore?: any;
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

	<!-- Current Item -->
	{#if currentItem}
		<div class="current-item-section">
			<ItemRenderer
				item={currentItem}
				{env}
				session={itemSession}
				{bundleHost}
				{esmCdnUrl}
				{playerVersion}
				{assessmentId}
				{sectionId}
				{ttsService}
				{toolCoordinator}
				{highlightCoordinator}
				{catalogResolver}
				{elementToolStateStore}
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
