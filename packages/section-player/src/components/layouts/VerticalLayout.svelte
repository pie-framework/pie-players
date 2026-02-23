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
		toolkitCoordinator = null,

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
		toolkitCoordinator?: any;

		onsessionchanged?: (itemId: string, session: any) => void;
	} = $props();

	function handleItemSessionChanged(itemId: string) {
		return (event: CustomEvent) => {
			if (onsessionchanged) {
				onsessionchanged(itemId, event.detail);
			}
		};
	}

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

<div
	class="vertical-layout"
	class:is-scrolling={isScrolling}
	onscroll={markScrolling}
>
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
					{toolkitCoordinator}
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
					{toolkitCoordinator}
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
		/* Firefox auto-hide scrollbar */
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
	}

	.vertical-layout.is-scrolling {
		scrollbar-color: var(--pie-blue-grey-300, #c1c1c1) var(--pie-secondary-background, #f1f1f1);
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

	/* Hide scrollbar by default - WebKit (Chrome, Safari, Edge) */
	.vertical-layout::-webkit-scrollbar {
		width: 0px;
		background: transparent;
	}

	/* Show scrollbar while scrolling */
	.vertical-layout.is-scrolling::-webkit-scrollbar {
		width: 8px;
	}

	.vertical-layout.is-scrolling::-webkit-scrollbar-track {
		background: var(--pie-secondary-background, #f1f1f1);
		border-radius: 4px;
	}

	.vertical-layout.is-scrolling::-webkit-scrollbar-thumb {
		background: var(--pie-blue-grey-300, #c1c1c1);
		border-radius: 4px;
	}

	.vertical-layout.is-scrolling::-webkit-scrollbar-thumb:hover {
		background: var(--pie-blue-grey-600, #a1a1a1);
	}
</style>
