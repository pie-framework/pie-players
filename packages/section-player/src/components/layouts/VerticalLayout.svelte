<!--
  VerticalLayout - Internal Component

  Renders vertical layout - passages first, then all items stacked vertically.
  Traditional assessment format with linear reading flow.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { SectionCompositionModel } from '../../controllers/types.js';
	import ItemRenderer from '../ItemRenderer.svelte';

	let {
		composition,
		env = { mode: 'gather', role: 'student' },
		toolbarPosition = 'right',
		showToolbar = true
	}: {
		composition: SectionCompositionModel;
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		toolbarPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none';
		showToolbar?: boolean;
	} = $props();
	let passages = $derived(composition?.passages || []);
	let items = $derived(composition?.items || []);
	let itemSessionsByItemId = $derived(composition?.itemSessionsByItemId || {});
	let shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== 'none');
	let isToolbarBeforeContent = $derived(
		toolbarPosition === 'top' || toolbarPosition === 'left'
	);

	let isScrolling = $state(false);
	let scrollTimer: ReturnType<typeof setTimeout> | null = null;

	function markScrolling() {
		isScrolling = true;
		if (scrollTimer) clearTimeout(scrollTimer);
		scrollTimer = setTimeout(() => {
			isScrolling = false;
		}, 700);
	}
</script>

<div class={`pie-section-player__layout-shell pie-section-player__layout-shell--${toolbarPosition}`}>
	{#if shouldRenderToolbar && isToolbarBeforeContent}
		<pie-section-tools-toolbar
			position={toolbarPosition}
			enabled-tools=""
		></pie-section-tools-toolbar>
	{/if}
	<div
		class={`pie-section-player__vertical-layout ${isScrolling ? 'pie-section-player__vertical-layout--scrolling' : ''}`}
		onscroll={markScrolling}
	>
		<!-- Passages -->
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

		<!-- All Items -->
		<div class="pie-section-player__items-section">
			{#each items as item, index (item.id || index)}
				<div class="pie-section-player__item-wrapper" data-item-index={index}>
					<ItemRenderer
						{item}
						contentKind="assessment-item"
						{env}
						session={itemSessionsByItemId[item.id || '']}
						customClassName="pie-section-player__item-content"
					/>
				</div>
			{/each}
		</div>
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

	.pie-section-player__vertical-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		height: 100%;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		/* Firefox auto-hide scrollbar */
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
	}

	.pie-section-player__vertical-layout--scrolling {
		scrollbar-color: var(--pie-blue-grey-300, #c1c1c1) var(--pie-secondary-background, #f1f1f1);
	}

	.pie-section-player__passages-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pie-section-player__items-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pie-section-player__item-wrapper {
		flex-shrink: 0;
	}

	.pie-section-player__passage-wrapper {
		flex-shrink: 0;
	}

	.pie-section-player__item-wrapper,
	.pie-section-player__passage-wrapper {
		padding: 0.25rem;
		background: var(--pie-white, white);
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 6px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.pie-section-player__vertical-layout {
			padding: 0.5rem;
			gap: 1rem;
		}

		.pie-section-player__items-section {
			gap: 1rem;
		}
	}

	/* Hide scrollbar by default - WebKit (Chrome, Safari, Edge) */
	.pie-section-player__vertical-layout::-webkit-scrollbar {
		width: 0px;
		background: transparent;
	}

	/* Show scrollbar while scrolling */
	.pie-section-player__vertical-layout--scrolling::-webkit-scrollbar {
		width: 8px;
	}

	.pie-section-player__vertical-layout--scrolling::-webkit-scrollbar-track {
		background: var(--pie-secondary-background, #f1f1f1);
		border-radius: 4px;
	}

	.pie-section-player__vertical-layout--scrolling::-webkit-scrollbar-thumb {
		background: var(--pie-blue-grey-300, #c1c1c1);
		border-radius: 4px;
	}

	.pie-section-player__vertical-layout--scrolling::-webkit-scrollbar-thumb:hover {
		background: var(--pie-blue-grey-600, #a1a1a1);
	}
</style>
