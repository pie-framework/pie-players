<!--
  ItemModeLayout - Internal Component

  Renders item mode (keepTogether: false) - one item at a time with navigation.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { ItemEntity, PassageEntity } from '@pie-players/pie-players-shared';
	import ItemNavigation from './ItemNavigation.svelte';
	import ItemRenderer from './ItemRenderer.svelte';

	let {
		passages,
		currentItem,
		currentIndex,
		totalItems,
		canNext,
		canPrevious,
		itemSession,
		env = { mode: 'gather', role: 'student' },
		playerVersion = 'latest',

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
		playerVersion?: string;

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
				{playerVersion}
				onsessionchanged={handleSessionChanged}
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

<style>
	.pie-section-player__item-mode-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
