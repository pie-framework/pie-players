<svelte:options
	customElement={{
		tag: 'pie-tool-periodic-table',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			coordinator: { type: 'Object' }
		}
	}}
/>

<script lang="ts">
	
	import type { IToolCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';
	import { createFocusTrap, safeLocalStorageGet, safeLocalStorageSet } from '@pie-players/pie-players-shared';
import { onMount } from 'svelte';
	import periodicTableData from './periodic-table-data.json';

	// TypeScript interface matching production data structure
	interface Element {
		name: string;
		atomic_mass: number;
		category: string;
		number: number;
		period: number;
		group: number;
		phase: string;
		symbol: string;
		xpos: number;
		ypos: number;
		electron_configuration_semantic: string;
	}

	// Props
	let {
		visible = false,
		toolId = 'periodicTable',
		coordinator
	}: {
		visible?: boolean;
		toolId?: string;
		coordinator?: IToolCoordinator;
	} = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let isDragging = $state(false);
	let x = $state(isBrowser ? window.innerWidth / 2 : 400);
	let y = $state(isBrowser ? window.innerHeight / 2 : 300);
	let width = $state(1100); // Increased to show all 18 columns without horizontal scrolling
	let height = $state(750); // Increased to show all 10 rows without vertical scrolling
	let dragStartX = $state(0);
	let dragStartY = $state(0);

	// Track registration state
	let registered = $state(false);

	// Get all elements from production JSON data
	const allElements: Element[] = (periodicTableData as any).elements;

	// Tool state
	let selectedElement = $state<Element | null>(allElements[0] || null); // Initialize with Hydrogen
	let selectedCategory = $state<string>('All');

	/**
	 * Normalize category name (matching production implementation)
	 */
	function normalizeCategory(category: string): string {
		const lower = category.toLowerCase();
		if (lower.indexOf('unknown') !== -1) {
			return 'Unknown';
		}
		// Map common category names to standard format
		const mappings: Record<string, string> = {
			'alkali metal': 'Alkali Metal',
			'alkaline earth': 'Alkaline Earth Metal',
			'alkaline earth metal': 'Alkaline Earth Metal',
			'transition metal': 'Transition Metal',
			'post-transition metal': 'Post-transition Metal',
			'metalloid': 'Metalloid',
			'nonmetal': 'Diatomic Nonmetal',
			'polyatomic nonmetal': 'Polyatomic Nonmetal',
			'diatomic nonmetal': 'Diatomic Nonmetal',
			'halogen': 'Diatomic Nonmetal', // Halogens are diatomic nonmetals
			'noble gas': 'Noble Gas',
			'lanthanide': 'Lanthanide',
			'actinide': 'Actinide',
			'metal': 'Post-transition Metal' // Some elements might just be 'metal'
		};
		return mappings[lower] || category;
	}

	/**
	 * Format category name for display
	 */
	function formatCategoryName(category: string): string {
		return category
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Use xpos/ypos directly from production data (no calculation needed)

	/**
	 * Get unique normalized categories
	 */
	let uniqueCategories = $derived.by(() => {
		const categories = new Set<string>();
		allElements.forEach((element) => {
			if (element.category) {
				categories.add(normalizeCategory(element.category));
			}
		});
		return Array.from(categories).sort();
	});

	/**
	 * Filter elements by category
	 */
	let displayedElements: Element[] = $derived.by(() => {
		if (selectedCategory === 'All') {
			return allElements;
		}
		return allElements.filter(
			(element: Element) => normalizeCategory(element.category) === selectedCategory
		);
	});

	/**
	 * Select element
	 */
	function showElementDetails(element: Element) {
		selectedElement = element;
	}

	/**
	 * Set category filter
	 */
	function setCategory(category: string) {
		selectedCategory = category;
	}

	function handleClose() {
		coordinator?.hideTool(toolId);
	}

	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		// Only start drag if clicking the header
		if (!target.closest('.periodic-table-header')) return;

		// Don't drag if clicking buttons
		if (target.closest('button')) return;

		isDragging = true;
		dragStartX = e.clientX - x;
		dragStartY = e.clientY - y;

		if (containerEl) {
			containerEl.setPointerCapture(e.pointerId);
			coordinator?.bringToFront(containerEl);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;

		let newX = e.clientX - dragStartX;
		let newY = e.clientY - dragStartY;

		// Keep calculator on screen
		const halfWidth = (containerEl?.offsetWidth || width) / 2;
		const halfHeight = (containerEl?.offsetHeight || height) / 2;

		x = Math.max(halfWidth, Math.min(newX, window.innerWidth - halfWidth));
		y = Math.max(halfHeight, Math.min(newY, window.innerHeight - halfHeight));
	}

	function handlePointerUp(e: PointerEvent) {
		if (isDragging && containerEl) {
			isDragging = false;
			containerEl.releasePointerCapture(e.pointerId);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			if (containerEl) {
				coordinator.registerTool(toolId, 'Periodic Table', containerEl, ZIndexLayer.MODAL);
			} else {
				coordinator.registerTool(toolId, 'Periodic Table', undefined, ZIndexLayer.MODAL);
			}
			registered = true;
		}
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
			coordinator.bringToFront(containerEl);
		}
	});

	onMount(() => {
		return () => {
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});
</script>

{#if visible}
	<div
		bind:this={containerEl}
		class="periodic-table-container"
		role="dialog"
		tabindex="-1"
		aria-label="Periodic Table - Click elements to view details"
		style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; transform: translate(-50%, -50%);"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onlostpointercapture={handlePointerUp}
		onkeydown={handleKeyDown}
	>
		<!-- Header (matching production implementation: dark teal) -->
		<div class="periodic-table-header">
			<h3 id="periodic-table-title" class="periodic-table-title">Periodic Table</h3>
			<div class="header-controls">
				<button class="close-btn" onclick={handleClose} aria-label="Close periodic table">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Content wrapper -->
		<div class="periodic-table-content">
			<div class="periodic-table-wrapper">
				<!-- Main grid -->
				<div
					class="periodic-table"
					role="grid"
					aria-labelledby="periodic-table-title"
				>
					<!-- Category filter badges in row 1 (matching production implementation) -->
					<div
						class="element-category-header category-badge-row"
						role="presentation"
						style="grid-row: 1; grid-column: 2 / span 16;"
					>
						<!-- "All" category -->
						<button
							class="category-badge"
							class:active={selectedCategory === 'All'}
							onclick={() => setCategory('All')}
							aria-label="Show all elements"
							aria-pressed={selectedCategory === 'All'}
						>
							All Elements
						</button>

						<!-- Each category badge -->
						{#each uniqueCategories as category (category)}
							<button
								class="category-badge {category.replace(' ', '-').toLowerCase()}"
								class:active={selectedCategory === category}
								onclick={() => setCategory(category)}
								aria-label="Filter by {category}"
								aria-pressed={selectedCategory === category}
							>
								{formatCategoryName(category)}
							</button>
						{/each}
					</div>

					<!-- Element overview section (rows 2-3, matching production implementation) -->
					{#if selectedElement}
						<div
							class="element-overview"
							style="grid-row: 2 / span 2; grid-column: 3 / span 10;"
							aria-live="polite"
						>
							<div
								class="selected-element-box grid-layout {normalizeCategory(selectedElement.category).replace(' ', '-').toLowerCase()}"
							>
								<!-- LEFT COLUMN: Large Symbol & Element Name -->
								<div class="left-col">
									<div class="symbol-center">{selectedElement.symbol}</div>
									<div class="element-name">{selectedElement.name}</div>
								</div>

								<!-- RIGHT COLUMN: Two rows with additional info -->
								<div class="right-col">
									<!-- TOP ROW: Atomic Mass, Atomic No -->
									<div class="top-row">
										<div class="info-block">
											<div class="label">Atomic Mass</div>
											<div class="value">{selectedElement.atomic_mass}</div>
										</div>
										<div class="info-block">
											<div class="label">Atomic No</div>
											<div class="value">{selectedElement.number}</div>
										</div>
									</div>
									<!-- BOTTOM ROW: Electron Configuration, Phase -->
									<div class="bottom-row">
										<div class="info-block">
											<div class="label">Electron Config</div>
											<div class="value">{selectedElement.electron_configuration_semantic}</div>
										</div>
										<div class="info-block">
											<div class="label">Phase</div>
											<div class="value">{selectedElement.phase}</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Periodic elements -->
					{#each displayedElements as element (element.symbol)}
						<button
							class="element {normalizeCategory(element.category).replace(' ', '-').toLowerCase()}"
							class:selected={selectedElement?.symbol === element.symbol}
							class:dim={selectedCategory !== 'All' && normalizeCategory(element.category) !== selectedCategory}
							style="grid-row: {element.ypos}; grid-column: {element.xpos};"
							tabindex="0"
								onclick={() => showElementDetails(element)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										showElementDetails(element);
									}
								}}
							title={element.name}
							aria-label="{element.name}, Symbol: {element.symbol}, Atomic number: {element.number}, Atomic mass: {element.atomic_mass.toFixed(3)}, Category: {element.category}"
						>
							<div class="atomic-number">{element.number}</div>
							<div class="symbol">{element.symbol}</div>
							<div class="name">{element.name}</div>
							<div class="atomic-mass">{element.atomic_mass.toFixed(3)}</div>
						</button>
					{/each}
				</div>

				<!-- Overlay for Group (Column) Labels -->
				<div class="group-labels" aria-hidden="true">
					{#each Array(18) as _, i}
						<div
							class="group-label"
							style="left: {(i) * (100 / 18)}%; width: {100 / 18}%;"
						>
							{i + 1}
						</div>
					{/each}
				</div>

				<!-- Overlay for Period (Row) Labels -->
				<!-- Covers the 10 grid rows: rows 1-3 are UI (no labels), rows 4-8 are periods 1-5, rows 9-10 are periods 6-7 -->
				<div class="period-labels" aria-hidden="true">
					{#each Array(10) as _, i}
						<div class="period-label">
							{#if i < 3}
								<!-- Rows 1-3: Category badges and overview (no period label) -->
								
							{:else if i === 8}
								<!-- Row 9 = Period 6 -->
								6
							{:else if i === 9}
								<!-- Row 10 = Period 7 -->
								7
							{:else}
								<!-- Rows 4-8 = Periods 1-5 -->
								{i - 2}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.periodic-table-container {
		position: fixed;
		background: white;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		user-select: none;
		touch-action: none;
		border-radius: 12px;
		overflow: visible; /* Changed from hidden to visible to show all content without clipping */
		z-index: 2000; /* ZIndexLayer.MODAL */
		min-width: 1100px; /* Match default width */
		display: flex;
		flex-direction: column;
	}

	/* Header (matching production implementation: dark teal) */
	.periodic-table-header {
		padding: 12px 16px;
		background: var(--pie-primary-dark, #2c3e50); /* Dark teal-like color */
		color: var(--pie-white, white);
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: move;
		user-select: none;
		border-radius: 12px 12px 0 0;
	}

	.periodic-table-title {
		font-weight: 600;
		font-size: 16px;
		color: var(--pie-white, white);
		margin: 0;
	}

	.header-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--pie-white, white);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: 2px;
	}

	/* Content wrapper */
	.periodic-table-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: visible; /* Changed from auto to visible - no scrolling needed */
		padding: 10px 4px 0 16px; /* top | right | bottom | left */
	}

	/* Wrapper needed for absolute positioning of overlays */
	.periodic-table-wrapper {
		position: relative;
	}

	/* Main grid layout */
	.periodic-table {
		display: grid;
		grid-gap: 3px;
		grid-template-columns: repeat(18, minmax(35px, 1fr));
		grid-template-rows: repeat(10, minmax(35px, 1fr));
		margin: 0 auto;
		width: 100%;
	}

	/* Category badge row (matching production implementation) */
	.element-category-header.category-badge-row {
		align-items: center;
		background-color: transparent;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		padding: 0.5rem;
	}

	.category-badge {
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1;
		padding: 4px 6px;
		transition: background-color 0.2s ease, color 0.2s ease;
		white-space: nowrap;
		background: white;
		color: #333;
	}

	.category-badge:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.category-badge.active {
		background-color: var(--pie-primary-dark, #2c3e50);
		border-color: var(--pie-primary-dark, #2c3e50);
		color: #fff;
	}

	/* Element overview section (matching production implementation) */
	.element-overview {
		align-items: center;
		display: flex;
		height: 100%;
		justify-content: center;
		padding: 6px;
		z-index: 2;
	}

	.selected-element-box.grid-layout {
		align-items: center;
		border: 2px solid #000;
		border-radius: 8px;
		box-sizing: border-box;
		display: flex;
		gap: 16px;
		padding: 12px;
		background: white;
	}

	.left-col {
		align-items: center;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.symbol-center {
		font-size: 2rem;
		font-weight: bold;
		line-height: 1.2;
		margin-bottom: 4px;
	}

	.element-name {
		color: #333;
		font-size: 1rem;
		font-weight: 500;
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.right-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
		justify-content: space-between;
		min-width: 0;
	}

	.top-row,
	.bottom-row {
		display: flex;
		gap: 8px;
		justify-content: space-between;
		min-width: 0;
	}

	.info-block {
		display: flex;
		flex-direction: column;
		min-width: 0;
		text-align: left;
	}

	.info-block .label {
		color: #444;
		font-size: 0.75rem;
		font-weight: bold;
		margin-bottom: 2px;
	}

	.info-block .value {
		color: #000;
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Element styles */
	.element {
		background-color: white;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 4px;
		box-sizing: border-box;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		min-height: 50px;
		padding: 3px;
		position: relative;
		transition: transform 0.1s ease-in-out;
	}

	.element:hover {
		border-color: var(--pie-primary-dark, #2c3e50);
		transform: scale(1.03);
		z-index: 10;
	}

	.element:focus {
		outline: 2px solid var(--pie-primary-dark, #2c3e50);
		outline-offset: 2px;
		z-index: 10;
	}

	.element.selected {
		border-color: var(--pie-primary-dark, #2c3e50);
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
		z-index: 11;
	}

	/* Dim out elements not in the selected category */
	.element.dim {
		filter: grayscale(80%);
		opacity: 0.4;
	}

	/* Text inside each element box */
	.atomic-number {
		font-size: 9px;
		opacity: 0.8;
		text-align: left;
	}

	.symbol {
		font-size: 14px;
		font-weight: bold;
		margin: 2px 0;
		text-align: center;
	}

	.name {
		font-size: 8px;
		opacity: 0.9;
		overflow: hidden;
		text-align: center;
		white-space: nowrap;
	}

	.atomic-mass {
		font-size: 9px;
		opacity: 0.8;
		text-align: right;
	}

	/* Overlay for Group (column) labels */
	.group-labels {
		color: #333;
		display: flex;
		font-size: 0.65rem;
		font-weight: bold;
		left: 0;
		pointer-events: none;
		position: absolute;
		top: -1.2em;
		width: 100%;
	}

	.group-label {
		text-align: center;
	}

	/* Overlay for Period (row) labels */
	.period-labels {
		color: #333;
		display: flex;
		flex-direction: column;
		font-size: 0.65rem;
		font-weight: bold;
		height: 100%;
		justify-content: space-evenly;
		left: -1.2em;
		pointer-events: none;
		position: absolute;
		top: 0;
	}

	.period-label {
		padding-right: 0.2em;
		text-align: right;
	}

	/* Category-based background colors (matching production implementation) */
	.alkali-metal {
		background-color: #ff9e9e;
	}

	.alkaline-earth-metal {
		background-color: #ffdc8a;
	}

	.alkaline-earth {
		background-color: #ffdc8a; /* Also handle without "-metal" suffix */
	}

	.lanthanide {
		background-color: #f9a8d4;
	}

	.actinide {
		background-color: #e0aaff;
	}

	.transition-metal {
		background-color: #a3d8f4;
	}

	.post-transition-metal {
		background-color: #b4f8c8;
	}

	.metalloid {
		background-color: #d9f99d;
	}

	.diatomic-nonmetal {
		background-color: #f5f5f5;
	}

	.noble-gas {
		background-color: #c4b5fd;
	}

	.polyatomic-nonmetal {
		background-color: #fbcfe8;
	}

	.nonmetal {
		background-color: #f0f0f0; /* Production implementation also has this */
	}

	.halogen {
		background-color: #8ef5d0; /* Production implementation has halogen color */
	}

	.unknown {
		background-color: #f5f5f5;
	}
</style>
