<!--
  SplitPanelLayout - Internal Component

  Renders split-panel layout - passages on left, items on right, both scrollable.
  Falls back to vertical layout on mobile/narrow screens.
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

	// Resizable panel state
	let leftPanelWidth = $state(50); // percentage
	let isDragging = $state(false);
	let containerElement: HTMLDivElement | null = $state(null);
	let passagesScrolling = $state(false);
	let itemsScrolling = $state(false);
	let passagesScrollTimer: ReturnType<typeof setTimeout> | null = null;
	let itemsScrollTimer: ReturnType<typeof setTimeout> | null = null;

	function handleMouseDown(event: MouseEvent) {
		event.preventDefault();
		isDragging = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !containerElement) return;

		const containerRect = containerElement.getBoundingClientRect();
		const offsetX = event.clientX - containerRect.left;
		const newWidth = (offsetX / containerRect.width) * 100;

		// Constrain between 20% and 80%
		if (newWidth >= 20 && newWidth <= 80) {
			leftPanelWidth = newWidth;
		}
	}

	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		const step = 5; // 5% change per key press
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			leftPanelWidth = Math.max(20, leftPanelWidth - step);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			leftPanelWidth = Math.min(80, leftPanelWidth + step);
		}
	}

	function markScrolling(target: 'passages' | 'items') {
		if (target === 'passages') {
			passagesScrolling = true;
			if (passagesScrollTimer) clearTimeout(passagesScrollTimer);
			passagesScrollTimer = setTimeout(() => {
				passagesScrolling = false;
			}, 700);
		} else {
			itemsScrolling = true;
			if (itemsScrollTimer) clearTimeout(itemsScrollTimer);
			itemsScrollTimer = setTimeout(() => {
				itemsScrolling = false;
			}, 700);
		}
	}

	// Attach global mouse listeners when dragging
	$effect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);

			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}
		return undefined;
	});

	// Check if we have passages to determine layout
	let hasPassages = $derived(passages.length > 0);
</script>

<div
	class="split-panel-layout"
	class:no-passages={!hasPassages}
	bind:this={containerElement}
	style={hasPassages ? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%` : 'grid-template-columns: 1fr'}
>
	{#if hasPassages}
		<!-- Left Panel: Passages -->
		<aside
			class="passages-panel"
			class:is-scrolling={passagesScrolling}
			aria-label="Reading passages"
			onscroll={() => markScrolling('passages')}
		>
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
		</aside>

		<!-- Draggable Divider: focusable resize handle, Arrow keys adjust panel width -->
		<button
			type="button"
			class="divider"
			class:dragging={isDragging}
			onmousedown={handleMouseDown}
			onkeydown={handleKeyDown}
			aria-label="Resize panels"
		>
			<span class="divider-handle"></span>
		</button>
	{/if}

	<!-- Items Panel -->
	<main
		class="items-panel"
		class:is-scrolling={itemsScrolling}
		aria-label="Assessment items"
		onscroll={() => markScrolling('items')}
	>
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
	</main>
</div>

<style>
	.split-panel-layout {
		display: grid;
		grid-template-rows: 1fr;
		padding: 1rem;
		height: 100%;
		max-height: 100%;
		min-height: 0;
		gap: 0;
	}

	.split-panel-layout.no-passages {
		padding: 1rem;
	}

	.split-panel-layout.no-passages .items-panel {
		padding: 0;
	}

	.passages-panel,
	.items-panel {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		/* Firefox auto-hide scrollbar */
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
	}

	.passages-panel.is-scrolling,
	.items-panel.is-scrolling {
		scrollbar-color: #c1c1c1 #f1f1f1;
	}

	.divider {
		/* Reset button defaults so it looks like a divider strip */
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		/* Fill grid cell height so the handle is vertically centered in the visible area */
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.divider:hover {
		background: #e5e7eb;
	}

	.divider:focus {
		outline: 2px solid #1976d2;
		outline-offset: -2px;
	}

	.divider-handle {
		/* Absolutely centered in the divider button (button fills grid cell height) */
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: #9ca3af;
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.divider-handle::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: white;
		border-radius: 1px;
		opacity: 0.8;
	}

	.divider:hover .divider-handle,
	.divider:focus .divider-handle,
	.divider.dragging .divider-handle {
		background: #1976d2;
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.divider.dragging {
		background: #dbeafe;
	}

	.passages-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.items-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.item-wrapper {
		flex-shrink: 0;
	}

	/* Mobile/Narrow: Fall back to vertical layout */
	@media (max-width: 768px) {
		.split-panel-layout {
			grid-template-columns: 1fr !important;
			gap: 1rem;
			min-height: auto;
			padding: 0.5rem;
		}

		.divider {
			display: none;
		}

		.passages-panel,
		.items-panel {
			height: auto;
			max-height: none;
			overflow-y: visible;
		}

		.items-panel {
			gap: 1rem;
		}
	}

	/* Hide scrollbar by default - WebKit (Chrome, Safari, Edge) */
	.passages-panel::-webkit-scrollbar,
	.items-panel::-webkit-scrollbar {
		width: 0px;
		background: transparent;
	}

	/* Show scrollbar while scrolling */
	.passages-panel.is-scrolling::-webkit-scrollbar,
	.items-panel.is-scrolling::-webkit-scrollbar {
		width: 8px;
	}

	.passages-panel.is-scrolling::-webkit-scrollbar-track,
	.items-panel.is-scrolling::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	.passages-panel.is-scrolling::-webkit-scrollbar-thumb,
	.items-panel.is-scrolling::-webkit-scrollbar-thumb {
		background: #c1c1c1;
		border-radius: 4px;
	}

	.passages-panel.is-scrolling::-webkit-scrollbar-thumb:hover,
	.items-panel.is-scrolling::-webkit-scrollbar-thumb:hover {
		background: #a1a1a1;
	}
</style>
