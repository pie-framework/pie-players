<svelte:options
	customElement={{
		tag: 'pie-tool-periodic-table',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">

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
		toolId = 'periodicTable'
	}: {
		visible?: boolean;
		toolId?: string;
	} = $props();

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

</script>

{#if visible}
	<div
		class="pie-tool-periodic-table"
		role="dialog"
		tabindex="-1"
		aria-label="Periodic Table - Click elements to view details"
		data-tool-id={toolId}
	>
		<!-- Content wrapper -->
		<div class="pie-tool-periodic-table__content">
			<div class="pie-tool-periodic-table__wrapper">
				<!-- Main grid -->
				<div
					class="pie-tool-periodic-table__grid"
					role="grid"
					aria-label="Periodic table elements"
				>
					<!-- Category filter badges in row 1 (matching production implementation) -->
					<div
						class="pie-tool-periodic-table__category-header pie-tool-periodic-table__category-badge-row"
						role="presentation"
						style="grid-row: 1; grid-column: 2 / span 16;"
					>
						<!-- "All" category -->
						<button
							class="pie-tool-periodic-table__category-badge"
							class:pie-tool-periodic-table__category-badge--active={selectedCategory === 'All'}
							onclick={() => setCategory('All')}
							aria-label="Show all elements"
							aria-pressed={selectedCategory === 'All'}
						>
							All Elements
						</button>

						<!-- Each category badge -->
						{#each uniqueCategories as category (category)}
							<button
								class="pie-tool-periodic-table__category-badge pie-tool-periodic-table__category--{category.replace(' ', '-').toLowerCase()}"
								class:pie-tool-periodic-table__category-badge--active={selectedCategory === category}
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
							class="pie-tool-periodic-table__element-overview"
							style="grid-row: 2 / span 2; grid-column: 3 / span 10;"
							aria-live="polite"
						>
							<div
								class="pie-tool-periodic-table__selected-element pie-tool-periodic-table__selected-grid pie-tool-periodic-table__category--{normalizeCategory(selectedElement.category).replace(' ', '-').toLowerCase()}"
							>
								<!-- LEFT COLUMN: Large Symbol & Element Name -->
								<div class="pie-tool-periodic-table__left-col">
									<div class="pie-tool-periodic-table__symbol-center">{selectedElement.symbol}</div>
									<div class="pie-tool-periodic-table__element-name">{selectedElement.name}</div>
								</div>

								<!-- RIGHT COLUMN: Two rows with additional info -->
								<div class="pie-tool-periodic-table__right-col">
									<!-- TOP ROW: Atomic Mass, Atomic No -->
									<div class="pie-tool-periodic-table__top-row">
										<div class="pie-tool-periodic-table__info-block">
											<div class="pie-tool-periodic-table__label">Atomic Mass</div>
											<div class="pie-tool-periodic-table__value">{selectedElement.atomic_mass}</div>
										</div>
										<div class="pie-tool-periodic-table__info-block">
											<div class="pie-tool-periodic-table__label">Atomic No</div>
											<div class="pie-tool-periodic-table__value">{selectedElement.number}</div>
										</div>
									</div>
									<!-- BOTTOM ROW: Electron Configuration, Phase -->
									<div class="pie-tool-periodic-table__bottom-row">
										<div class="pie-tool-periodic-table__info-block">
											<div class="pie-tool-periodic-table__label">Electron Config</div>
											<div class="pie-tool-periodic-table__value">{selectedElement.electron_configuration_semantic}</div>
										</div>
										<div class="pie-tool-periodic-table__info-block">
											<div class="pie-tool-periodic-table__label">Phase</div>
											<div class="pie-tool-periodic-table__value">{selectedElement.phase}</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Periodic elements -->
					{#each displayedElements as element (element.symbol)}
						<button
							class="pie-tool-periodic-table__element pie-tool-periodic-table__category--{normalizeCategory(element.category).replace(' ', '-').toLowerCase()}"
							class:pie-tool-periodic-table__element--selected={selectedElement?.symbol === element.symbol}
							class:pie-tool-periodic-table__element--dim={selectedCategory !== 'All' && normalizeCategory(element.category) !== selectedCategory}
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
							<div class="pie-tool-periodic-table__atomic-number">{element.number}</div>
							<div class="pie-tool-periodic-table__symbol">{element.symbol}</div>
							<div class="pie-tool-periodic-table__name">{element.name}</div>
							<div class="pie-tool-periodic-table__atomic-mass">{element.atomic_mass.toFixed(3)}</div>
						</button>
					{/each}
				</div>

				<!-- Overlay for Group (Column) Labels -->
				<div class="pie-tool-periodic-table__group-labels" aria-hidden="true">
					{#each Array(18) as _, i}
						<div
							class="pie-tool-periodic-table__group-label"
							style="left: {(i) * (100 / 18)}%; width: {100 / 18}%;"
						>
							{i + 1}
						</div>
					{/each}
				</div>

				<!-- Overlay for Period (Row) Labels -->
				<!-- Covers the 10 grid rows: rows 1-3 are UI (no labels), rows 4-8 are periods 1-5, rows 9-10 are periods 6-7 -->
				<div class="pie-tool-periodic-table__period-labels" aria-hidden="true">
					{#each Array(10) as _, i}
						<div class="pie-tool-periodic-table__period-label">
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
	.pie-tool-periodic-table {
		position: relative;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Content wrapper */
	.pie-tool-periodic-table__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
		padding: 10px 10px 0 16px; /* top | right | bottom | left */
	}

	/* Wrapper needed for absolute positioning of overlays */
	.pie-tool-periodic-table__wrapper {
		position: relative;
	}

	/* Main grid layout */
	.pie-tool-periodic-table__grid {
		display: grid;
		grid-gap: 3px;
		grid-template-columns: repeat(18, minmax(35px, 1fr));
		grid-template-rows: repeat(10, minmax(35px, 1fr));
		margin: 0 auto;
		width: 100%;
	}

	/* Category badge row (matching production implementation) */
	.pie-tool-periodic-table__category-header.pie-tool-periodic-table__category-badge-row {
		align-items: center;
		background-color: transparent;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		padding: 0.5rem;
	}

	.pie-tool-periodic-table__category-badge {
		border: 1px solid color-mix(in srgb, var(--pie-border-dark, #000) 12%, transparent);
		border-radius: 1rem;
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1;
		padding: 4px 6px;
		transition: background-color 0.2s ease, color 0.2s ease;
		white-space: nowrap;
		background: var(--pie-button-bg, #fff);
		color: var(--pie-button-color, var(--pie-text, #333));
	}

	.pie-tool-periodic-table__category-badge:hover {
		background: var(--pie-button-hover-bg, #f3f4f6);
	}

	.pie-tool-periodic-table__category-badge.pie-tool-periodic-table__category-badge--active {
		background-color: var(--pie-primary-dark, #2c3e50);
		border-color: var(--pie-primary-dark, #2c3e50);
		color: var(--pie-white, #fff);
	}

	/* Element overview section (matching production implementation) */
	.pie-tool-periodic-table__element-overview {
		align-items: center;
		display: flex;
		height: 100%;
		justify-content: center;
		padding: 6px;
		z-index: 2;
	}

	.pie-tool-periodic-table__selected-element.pie-tool-periodic-table__selected-grid {
		/* This panel carries a category class for its label, but takes the theme
		   surface below rather than the category fill — so its ink stays with the
		   theme instead of the dark ink pinned for the pastel-filled cells. */
		color: var(--pie-text, #111827);
		align-items: center;
		border: 2px solid var(--pie-border-dark, #000);
		border-radius: 8px;
		box-sizing: border-box;
		display: flex;
		gap: 16px;
		padding: 12px;
		background: var(--pie-background, #fff);
	}

	.pie-tool-periodic-table__left-col {
		align-items: center;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.pie-tool-periodic-table__symbol-center {
		font-size: 2rem;
		font-weight: bold;
		line-height: 1.2;
		margin-bottom: 4px;
	}

	.pie-tool-periodic-table__element-name {
		/* inherit, not --pie-text: this sits inside a category-filled cell, whose
		   ink is pinned for legibility against a fixed pastel. Outside one it
		   inherits --pie-text from the tool root anyway. */
		color: inherit;
		font-size: 1rem;
		font-weight: 500;
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pie-tool-periodic-table__right-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
		justify-content: space-between;
		min-width: 0;
	}

	.pie-tool-periodic-table__top-row,
	.pie-tool-periodic-table__bottom-row {
		display: flex;
		gap: 8px;
		justify-content: space-between;
		min-width: 0;
	}

	.pie-tool-periodic-table__info-block {
		display: flex;
		flex-direction: column;
		min-width: 0;
		text-align: left;
	}

	.pie-tool-periodic-table__info-block .pie-tool-periodic-table__label {
		/* See __element-name: inside the selected-element panel this sits on the
		   category fill. */
		color: inherit;
		font-size: 0.75rem;
		font-weight: bold;
		margin-bottom: 2px;
	}

	.pie-tool-periodic-table__info-block .pie-tool-periodic-table__value {
		color: inherit;
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Element styles */
	.pie-tool-periodic-table__element {
		background-color: var(--pie-background, #fff);
		border: 1px solid color-mix(in srgb, var(--pie-border-dark, #000) 12%, transparent);
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

	.pie-tool-periodic-table__element:hover {
		border-color: var(--pie-primary-dark, #2c3e50);
		transform: scale(1.03);
		z-index: 10;
	}

	.pie-tool-periodic-table__element:focus {
		outline: 2px solid var(--pie-primary-dark, #2c3e50);
		outline-offset: 2px;
		z-index: 10;
	}

	.pie-tool-periodic-table__element.pie-tool-periodic-table__element--selected {
		border-color: var(--pie-primary-dark, #2c3e50);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--pie-border-dark, #000) 12%, transparent);
		z-index: 11;
	}

	/* Dim out elements not in the selected category */
	.pie-tool-periodic-table__element.pie-tool-periodic-table__element--dim {
		filter: grayscale(80%);
		opacity: 0.4;
	}

	/* Text inside each element box */
	.pie-tool-periodic-table__atomic-number {
		font-size: 9px;
		opacity: 0.8;
		text-align: left;
	}

	.pie-tool-periodic-table__symbol {
		font-size: 14px;
		font-weight: bold;
		margin: 2px 0;
		text-align: center;
	}

	.pie-tool-periodic-table__name {
		font-size: 8px;
		opacity: 0.9;
		overflow: hidden;
		text-align: center;
		white-space: nowrap;
	}

	.pie-tool-periodic-table__atomic-mass {
		font-size: 9px;
		opacity: 0.8;
		text-align: right;
	}

	/* Overlay for Group (column) labels */
	.pie-tool-periodic-table__group-labels {
		color: var(--pie-text, #333);
		display: flex;
		font-size: 0.65rem;
		font-weight: bold;
		left: 0;
		pointer-events: none;
		position: absolute;
		top: -1.2em;
		width: 100%;
	}

	.pie-tool-periodic-table__group-label {
		text-align: center;
	}

	/* Overlay for Period (row) labels */
	.pie-tool-periodic-table__period-labels {
		color: var(--pie-text, #333);
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

	.pie-tool-periodic-table__period-label {
		padding-right: 0.2em;
		text-align: right;
	}

	/*
	 * The category fills below are a fixed data encoding, so their ink has to be
	 * fixed too: everything carrying one otherwise inherits --pie-text, which is
	 * near-white under every dark theme and left the element symbol and name at
	 * about 1.2:1 on a pastel. The tightest pairing this ink leaves is the
	 * 0.8-opacity atomic mass on the darkest fill, #ff9e9e, at 6.0:1; the symbol
	 * on the same fill is 9.0:1.
	 *
	 * A colour scheme takes that encoding away: --pie-fixed-hue-collapse is 100%
	 * under every scheme, which folds each fill into --pie-background-dark and the
	 * ink back into --pie-text — the two colours the learner asked for, plus the
	 * scheme's own recessed surface so a cell still reads as a cell. Category then
	 * lives where it does not depend on hue: the badge row filters by it, the
	 * selected-element panel names it, and each cell's accessible name carries it.
	 * The mixes are exact at both ends, so a Base Theme renders the authored
	 * pastels byte for byte.
	 */
	.pie-tool-periodic-table__category--alkali-metal,
	.pie-tool-periodic-table__category--alkaline-earth-metal,
	.pie-tool-periodic-table__category--alkaline-earth,
	.pie-tool-periodic-table__category--lanthanide,
	.pie-tool-periodic-table__category--actinide,
	.pie-tool-periodic-table__category--transition-metal,
	.pie-tool-periodic-table__category--post-transition-metal,
	.pie-tool-periodic-table__category--metalloid,
	.pie-tool-periodic-table__category--diatomic-nonmetal,
	.pie-tool-periodic-table__category--noble-gas,
	.pie-tool-periodic-table__category--polyatomic-nonmetal,
	.pie-tool-periodic-table__category--nonmetal,
	.pie-tool-periodic-table__category--halogen,
	.pie-tool-periodic-table__category--unknown {
		color: color-mix(
			in srgb,
			var(--pie-text, #111827) var(--pie-fixed-hue-collapse, 0%),
			#111827
		);
		/* Collapsed fills sit on the panel surface at about 1.1:1, so the cell edge
		   has to carry the separation a pastel used to: --pie-border is corrected to
		   3:1 against the page on every palette. */
		border-color: color-mix(
			in srgb,
			var(--pie-border, #646464) var(--pie-fixed-hue-collapse, 0%),
			color-mix(in srgb, var(--pie-border-dark, #000) 12%, transparent)
		);
	}

	/* Category-based background colors (matching production implementation) */
	.pie-tool-periodic-table__category--alkali-metal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#ff9e9e
		);
	}

	.pie-tool-periodic-table__category--alkaline-earth-metal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#ffdc8a
		);
	}

	.pie-tool-periodic-table__category--alkaline-earth {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#ffdc8a
		); /* Also handle without "-metal" suffix */
	}

	.pie-tool-periodic-table__category--lanthanide {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#f9a8d4
		);
	}

	.pie-tool-periodic-table__category--actinide {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#e0aaff
		);
	}

	.pie-tool-periodic-table__category--transition-metal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#a3d8f4
		);
	}

	.pie-tool-periodic-table__category--post-transition-metal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#b4f8c8
		);
	}

	.pie-tool-periodic-table__category--metalloid {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#d9f99d
		);
	}

	.pie-tool-periodic-table__category--diatomic-nonmetal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#f5f5f5
		);
	}

	.pie-tool-periodic-table__category--noble-gas {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#c4b5fd
		);
	}

	.pie-tool-periodic-table__category--polyatomic-nonmetal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#fbcfe8
		);
	}

	.pie-tool-periodic-table__category--nonmetal {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#f0f0f0
		); /* Production implementation also has this */
	}

	.pie-tool-periodic-table__category--halogen {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#8ef5d0
		); /* Production implementation has halogen color */
	}

	.pie-tool-periodic-table__category--unknown {
		background-color: color-mix(
			in srgb,
			var(--pie-background-dark, #f5f5f5) var(--pie-fixed-hue-collapse, 0%),
			#f5f5f5
		);
	}
</style>
