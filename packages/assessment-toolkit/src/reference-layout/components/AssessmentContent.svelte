<script lang="ts">
	
	import type { ItemConfig, ItemEntity, PassageEntity, RubricBlock } from '@pie-framework/pie-players-shared/types';
	import { onDestroy, onMount } from 'svelte';
	import type { AssessmentPlayer } from '../../player/AssessmentPlayer';
	import ItemPanel from './ItemPanel.svelte';
	import PassagePanel from './PassagePanel.svelte';
	import NotesPanel from './NotesPanel.svelte';

	let {
		player,
		currentItem,
		config,
		passage,
		rubricBlocks = [],
		session,
		bundleHost,
		organizationId,
		isLoading = false
	}: {
		player: AssessmentPlayer;
		currentItem: ItemEntity | null;
		config: ItemConfig | null;
		passage: PassageEntity | null;
		rubricBlocks?: RubricBlock[];
		session: { id: string; data: any[] };
		bundleHost?: string;
		organizationId?: string | null;
		isLoading?: boolean;
	} = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let passagePanelEl = $state<HTMLDivElement | null>(null);
	let itemPanelEl = $state<HTMLDivElement | null>(null);
	let dividerEl = $state<HTMLDivElement | null>(null);
	let notesDividerEl = $state<HTMLDivElement | null>(null);

	// Resize state
	let isDragging = $state(false);
	let startX = $state(0);
	let passageWidth = $state(300); // Initial width in pixels
	let minPassageWidth = 200;
	let maxPassageWidth = 800;

	const hasPassage = $derived(
		(passage !== null) || (rubricBlocks?.length ?? 0) > 0,
	);

	// Notes sidebar
	let showNotes = $state(true);
	const notesWidth = 320;

	// Calculate grid columns dynamically
	const gridColumns = $derived.by(() => {
		const parts: string[] = [];

		if (hasPassage) {
			parts.push(`${passageWidth}px`, 'auto');
		}

		// Item column always present
		parts.push('1fr');

		// Notes column (optional)
		if (showNotes) {
			parts.push('auto', `${notesWidth}px`);
		}

		return parts.join(' ');
	});

	function handleDividerMouseDown(e: MouseEvent) {
		if (!hasPassage) return;
		isDragging = true;
		startX = e.clientX;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !containerEl) return;

		const deltaX = e.clientX - startX;
		const containerRect = containerEl.getBoundingClientRect();
		const newWidth = passageWidth + deltaX;
		const constrainedWidth = Math.max(
			minPassageWidth,
			Math.min(maxPassageWidth, newWidth)
		);

		passageWidth = constrainedWidth;
		startX = e.clientX;
	}

	function handleMouseUp() {
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';

		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!hasPassage) return;
		
		const step = 10; // pixels per keypress
		let deltaX = 0;
		
		if (e.key === 'ArrowLeft') {
			deltaX = -step;
		} else if (e.key === 'ArrowRight') {
			deltaX = step;
		} else {
			return; // Ignore other keys
		}
		
		e.preventDefault();
		const newWidth = passageWidth + deltaX;
		const constrainedWidth = Math.max(
			minPassageWidth,
			Math.min(maxPassageWidth, newWidth)
		);
		passageWidth = constrainedWidth;
	}

	onMount(() => {
		// Persist width to localStorage
		const savedWidth = localStorage.getItem('schoolcity-passage-width');
		if (savedWidth) {
			passageWidth = parseInt(savedWidth, 10);
		}
	});

	onDestroy(() => {
		// Save width to localStorage
		localStorage.setItem('schoolcity-passage-width', String(passageWidth));
		handleMouseUp(); // Clean up any active drag
	});
</script>

<div class="assessment-content" bind:this={containerEl} style="grid-template-columns: {gridColumns}">
	{#if hasPassage}
		<!-- Passage Panel -->
		<div class="passage-container" bind:this={passagePanelEl}>
			<PassagePanel {passage} {rubricBlocks} {bundleHost} env={player.getEnv()} />
		</div>

		<!-- Resizable Divider -->
		<div
			class="divider"
			class:dragging={isDragging}
			bind:this={dividerEl}
			onmousedown={handleDividerMouseDown}
			onkeydown={handleKeyDown}
			role="button"
			aria-label="Resize passage panel"
			tabindex="0"
		>
			<div class="divider-handle"></div>
		</div>
	{/if}

	<!-- Item Panel -->
	<div class="item-container" bind:this={itemPanelEl}>
		<ItemPanel
			{currentItem}
			{config}
			{session}
			{bundleHost}
			env={player.getEnv()}
			toolCoordinator={player.getToolCoordinator()}
			{isLoading}
		/>
	</div>

	{#if showNotes}
		<!-- Notes Divider (visual only for now) -->
		<div class="divider notes-divider" bind:this={notesDividerEl} aria-hidden="true">
			<div class="divider-handle"></div>
		</div>

		<!-- Notes Panel -->
		<div class="notes-container">
			<NotesPanel
				itemId={currentItem?.id || ''}
				itemLabel={currentItem?.name || ''}
				onClose={() => (showNotes = false)}
			/>
		</div>
	{/if}
</div>

<style>
	.assessment-content {
		display: grid;
		gap: 0;
		overflow: hidden;
		position: relative;
		min-height: 0;
		height: 100%;
	}

	.passage-container,
	.item-container,
	.notes-container {
		overflow-y: auto;
		overflow-x: hidden;
		background-color: var(--pie-background, #ffffff);
	}

	.divider {
		position: relative;
		width: 4px;
		background-color: var(--pie-border, #e0e0e0);
		cursor: col-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}

	.divider:hover,
	.divider.dragging {
		background-color: var(--pie-primary, #3f51b5);
	}

	.divider-handle {
		width: 2px;
		height: 40px;
		background-color: var(--pie-text-secondary, #666);
		border-radius: 1px;
	}

	.divider.dragging .divider-handle {
		background-color: var(--pie-primary, #3f51b5);
	}

	.divider:focus {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: -2px;
	}

	.notes-divider {
		cursor: default;
	}

	/* On narrow screens, hide notes by default */
	@media (max-width: 1100px) {
		.notes-container,
		.notes-divider {
			display: none;
		}
	}
</style>

