<!--
  SplitPanelLayout - Internal Component

  Renders split-panel layout - passages on left, items on right, both scrollable.
  Falls back to vertical layout on mobile/narrow screens.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import type { ComponentDefinition } from '../../component-definitions.js';
	import type { ItemEntity, PassageEntity } from '@pie-players/pie-players-shared';
	import ItemRenderer from '../ItemRenderer.svelte';

	let {
		passages,
		items,
		itemSessions = {},
		player = '',
		env = { mode: 'gather', role: 'student' },
		playerVersion = 'latest',
		assessmentId = '',
		sectionId = '',
		toolkitCoordinator = null,
		playerDefinitions = {} as Partial<Record<string, ComponentDefinition>>,

		onsessionchanged
	}: {
		passages: PassageEntity[];
		items: ItemEntity[];
		itemSessions?: Record<string, any>;
		player?: string;
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		playerVersion?: string;
		assessmentId?: string;
		sectionId?: string;
		toolkitCoordinator?: any;
		playerDefinitions?: Partial<Record<string, ComponentDefinition>>;

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
	class={`pie-section-player__split-panel-layout ${!hasPassages ? 'pie-section-player__split-panel-layout--no-passages' : ''}`}
	bind:this={containerElement}
	style={hasPassages ? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%` : 'grid-template-columns: 1fr'}
>
	{#if hasPassages}
		<!-- Left Panel: Passages -->
		<aside
			class={`pie-section-player__passages-panel ${passagesScrolling ? 'pie-section-player__panel--scrolling' : ''}`}
			aria-label="Reading passages"
			onscroll={() => markScrolling('passages')}
		>
			{#each passages as passage (passage.id)}
				<div class="pie-section-player__passage-wrapper">
					<ItemRenderer
						item={passage}
						{player}
						contentKind="rubric-block-stimulus"
						env={{ mode: 'view', role: env.role }}
						{assessmentId}
						{sectionId}
						{toolkitCoordinator}
						{playerDefinitions}
						customClassName="pie-section-player__passage-item"
					/>
				</div>
			{/each}
		</aside>

		<!-- Draggable Divider: focusable resize handle, Arrow keys adjust panel width -->
		<button
			type="button"
			class={`pie-section-player__split-divider ${isDragging ? 'pie-section-player__split-divider--dragging' : ''}`}
			onmousedown={handleMouseDown}
			onkeydown={handleKeyDown}
			aria-label="Resize panels"
		>
			<span class="pie-section-player__split-divider-handle"></span>
		</button>
	{/if}

	<!-- Items Panel -->
	<main
		class={`pie-section-player__items-panel ${itemsScrolling ? 'pie-section-player__panel--scrolling' : ''}`}
		aria-label="Assessment items"
		onscroll={() => markScrolling('items')}
	>
		{#each items as item, index (item.id || index)}
			<div class="pie-section-player__item-wrapper" data-item-index={index}>
				<ItemRenderer
					{item}
					{player}
					contentKind="assessment-item"
					{env}
					session={itemSessions[item.id || '']}
					{playerVersion}
					{assessmentId}
					{sectionId}
					{toolkitCoordinator}
					{playerDefinitions}
					onsessionchanged={handleItemSessionChanged(item.id || '')}
					customClassName="pie-section-player__item-content"
				/>
			</div>
		{/each}
	</main>
</div>

<style>
	.pie-section-player__split-panel-layout {
		display: grid;
		grid-template-rows: 1fr;
		padding: 1rem;
		height: 100%;
		max-height: 100%;
		min-height: 0;
		gap: 0;
	}

	.pie-section-player__split-panel-layout--no-passages {
		padding: 1rem;
	}

	.pie-section-player__split-panel-layout--no-passages .pie-section-player__items-panel {
		padding: 0;
	}

	.pie-section-player__passages-panel,
	.pie-section-player__items-panel {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		/* Firefox auto-hide scrollbar */
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
	}

	.pie-section-player__panel--scrolling {
		scrollbar-color: var(--pie-blue-grey-300, #c1c1c1) var(--pie-secondary-background, #f1f1f1);
	}

	.pie-section-player__split-divider {
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
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.pie-section-player__split-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player__split-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.pie-section-player__split-divider-handle {
		/* Absolutely centered in the divider button (button fills grid cell height) */
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.pie-section-player__split-divider-handle::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.pie-section-player__split-divider:hover .pie-section-player__split-divider-handle,
	.pie-section-player__split-divider:focus .pie-section-player__split-divider-handle,
	.pie-section-player__split-divider--dragging .pie-section-player__split-divider-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.pie-section-player__split-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}

	.pie-section-player__passages-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pie-section-player__items-panel {
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

	/* Mobile/Narrow: Fall back to vertical layout */
	@media (max-width: 768px) {
		.pie-section-player__split-panel-layout {
			grid-template-columns: 1fr !important;
			gap: 1rem;
			min-height: auto;
			padding: 0.5rem;
		}

		.pie-section-player__split-divider {
			display: none;
		}

		.pie-section-player__passages-panel,
		.pie-section-player__items-panel {
			height: auto;
			max-height: none;
			overflow-y: visible;
		}

		.pie-section-player__items-panel {
			gap: 1rem;
		}
	}

	/* Hide scrollbar by default - WebKit (Chrome, Safari, Edge) */
	.pie-section-player__passages-panel::-webkit-scrollbar,
	.pie-section-player__items-panel::-webkit-scrollbar {
		width: 0px;
		background: transparent;
	}

	/* Show scrollbar while scrolling */
	.pie-section-player__panel--scrolling::-webkit-scrollbar {
		width: 8px;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar-track {
		background: var(--pie-secondary-background, #f1f1f1);
		border-radius: 4px;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar-thumb {
		background: var(--pie-blue-grey-300, #c1c1c1);
		border-radius: 4px;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar-thumb:hover {
		background: var(--pie-blue-grey-600, #a1a1a1);
	}
</style>
