<!--
  ItemModeLayout - Internal Component

  Renders item mode (keepTogether: false) - one item at a time with navigation.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { SectionCompositionModel } from '../controllers/types.js';
	import ItemNavigation from './ItemNavigation.svelte';
	import ItemRenderer from './ItemRenderer.svelte';

	let {
		composition,
		env = { mode: 'gather', role: 'student' },
		toolbarPosition = 'right',
		showToolbar = true,
		onprevious,
		onnext
	}: {
		composition: SectionCompositionModel;
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		toolbarPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none';
		showToolbar?: boolean;
		onprevious?: () => void;
		onnext?: () => void;
	} = $props();

	let passages = $derived(composition?.passages || []);
	let items = $derived(composition?.items || []);
	let currentIndex = $derived(composition?.currentItemIndex || 0);
	let totalItems = $derived(items.length);
	let currentItem = $derived(composition?.currentItem || items[currentIndex] || null);
	let itemSessionsByItemId = $derived(composition?.itemSessionsByItemId || {});
	let itemSession = $derived(currentItem?.id ? itemSessionsByItemId[currentItem.id] : undefined);
	let canPrevious = $derived(currentIndex > 0);
	let canNext = $derived(currentIndex < totalItems - 1);
	let shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== 'none');
	let isToolbarBeforeContent = $derived(
		toolbarPosition === 'top' || toolbarPosition === 'left'
	);
</script>

<div class={`pie-section-player__layout-shell pie-section-player__layout-shell--${toolbarPosition}`}>
	{#if shouldRenderToolbar && isToolbarBeforeContent}
		<pie-section-tools-toolbar
			position={toolbarPosition}
			enabled-tools=""
		></pie-section-tools-toolbar>
	{/if}
	<div class="pie-section-player__item-mode-layout">
		<!-- Passages (visible for all items) -->
		{#if passages.length > 0}
			<div class="pie-section-player__passages-section">
				{#each passages as passage (passage.id)}
					<div class="pie-section-player__passage-wrapper">
						<ItemRenderer
							item={passage}
							contentKind="rubric-block-stimulus"
							env={{ mode: 'view', role: env.role }}
							customClassName="pie-section-player__passage-item"
						/>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Current Item -->
		{#if currentItem}
			<div class="pie-section-player__current-item-section">
				<ItemRenderer
					item={currentItem}
					contentKind="assessment-item"
					{env}
					session={itemSession}
					customClassName="pie-section-player__item-content"
				/>
			</div>
		{:else}
			<div class="pie-section-player__no-item">
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
	{#if shouldRenderToolbar && !isToolbarBeforeContent}
		<pie-section-tools-toolbar
			position={toolbarPosition}
			enabled-tools=""
		></pie-section-tools-toolbar>
	{/if}
</div>

<style>
	.pie-section-player__layout-shell {
		display: flex;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player__layout-shell--top,
	.pie-section-player__layout-shell--bottom,
	.pie-section-player__layout-shell--none {
		flex-direction: column;
	}

	.pie-section-player__layout-shell--left,
	.pie-section-player__layout-shell--right {
		flex-direction: row;
	}

	.pie-section-player__item-mode-layout {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		overflow-y: auto;
	}

	.pie-section-player__passages-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.pie-section-player__passages-section :global(.pie-section-player__passage-item) {
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
	}

	.pie-section-player__passage-wrapper {
		flex-shrink: 0;
		padding: 0.25rem;
		background: var(--pie-white, white);
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 6px;
	}

	.pie-section-player__current-item-section {
		padding: 0.25rem;
		background: var(--pie-white, white);
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 6px;
		min-height: 300px;
	}

	.pie-section-player__no-item {
		padding: 2rem;
		text-align: center;
		color: var(--pie-disabled-secondary, #999);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.pie-section-player__item-mode-layout {
			gap: 1rem;
		}
	}
</style>
