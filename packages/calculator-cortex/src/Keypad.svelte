<script lang="ts">
	import { convertLatexToMarkup } from 'mathlive';
	import type { Snippet } from 'svelte';
	import type { CortexCalculatorLocalization } from './localization.js';
	import type { KeypadKey, KeypadLayer } from './keypad-layouts.js';

	let {
		layers,
		localization,
		activeLayerId = '',
		bleed = false,
		head,
		onInsert,
		onCommit,
	}: {
		layers: readonly KeypadLayer[];
		localization: CortexCalculatorLocalization;
		/**
		 * Bleed the recessed plane to the calculator's own edges. True only where the
		 * keypad is the calculator's last child — in the graphing view it sits inside
		 * the expression rail, where negative margins would spill it across the plot.
		 */
		bleed?: boolean;
		/**
		 * Which layer to show. Owned by the parent, which hands the tabs down through
		 * `head` — they render on this plane, above the grid, but the parent is what
		 * knows the layer set. Empty means "whichever layer comes first".
		 */
		activeLayerId?: string;
		/**
		 * The instrument's own controls — layer tabs, backspace, clear — rendered on
		 * this plane above the grid rather than on the card above it. Both reference
		 * calculators put them here, and on the card they read as a form's buttons
		 * that happen to sit near a keypad instead of as part of one.
		 */
		head?: Snippet;
		onInsert: (key: KeypadKey) => void;
		onCommit: () => void;
	} = $props();
	// Roving tab index. The keypad is one tab stop, not one per key: 25-35 sequential
	// stops between the display and the rest of the tool is a scan step per key for a
	// switch-access user, and the keypad is redundant for anyone who can type. Arrows
	// move within it, Home/End jump to the row's ends.
	let focusedKeyId = $state('');
	let grid = $state<HTMLDivElement | null>(null);

	const activeLayer = $derived(
		layers.find((layer) => layer.id === activeLayerId) ?? layers[0],
	);
	const rows = $derived(activeLayer?.rows ?? []);
	const flatKeys = $derived(rows.flat());
	const rovingKeyId = $derived(
		flatKeys.some((key) => key.id === focusedKeyId)
			? focusedKeyId
			: (flatKeys[0]?.id ?? ''),
	);

	/**
	 * The grid column for a key: the one its position implies, or the one it asks
	 * for. Column 4 is the bare gutter, so key columns 4 and 5 skip over it -- that
	 * skip is what keeps all five keys exactly the same width.
	 */
	function gridColumn(key: KeypadKey, columnIndex: number): string {
		const column = key.column ?? columnIndex + 1;
		return String(column <= 3 ? column : column + 1);
	}

	function keyName(key: KeypadKey): string {
		return localization.t(key.nameKey, key.nameValues ?? {});
	}

	function press(key: KeypadKey): void {
		if (key.role === 'commit') {
			onCommit();
			return;
		}
		onInsert(key);
	}

	function focusKey(id: string): void {
		focusedKeyId = id;
		grid?.querySelector<HTMLButtonElement>(`[data-key-id="${id}"]`)?.focus();
	}

	function move(rowIndex: number, columnIndex: number, deltaRow: number, deltaColumn: number): void {
		const rowCount = rows.length;
		if (rowCount === 0) return;
		let nextRow = (rowIndex + deltaRow + rowCount) % rowCount;
		let row = rows[nextRow];
		if (!row) return;
		// Rows are pruned to what the host permits, so they are not all the same
		// length; clamp rather than wrap into a gap.
		const nextColumn = deltaColumn === 0
			? Math.min(columnIndex, row.length - 1)
			: (columnIndex + deltaColumn + row.length) % row.length;
		const target = row[nextColumn];
		if (target) focusKey(target.id);
	}

	function onKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number): void {
		const row = rows[rowIndex];
		if (!row) return;
		switch (event.key) {
			case 'ArrowRight':
				move(rowIndex, columnIndex, 0, 1);
				break;
			case 'ArrowLeft':
				move(rowIndex, columnIndex, 0, -1);
				break;
			case 'ArrowDown':
				move(rowIndex, columnIndex, 1, 0);
				break;
			case 'ArrowUp':
				move(rowIndex, columnIndex, -1, 0);
				break;
			case 'Home': {
				const first = row[0];
				if (first) focusKey(first.id);
				break;
			}
			case 'End': {
				const last = row[row.length - 1];
				if (last) focusKey(last.id);
				break;
			}
			default:
				return;
		}
		event.preventDefault();
	}
</script>

<div class="pie-cortex-keypad" class:pie-cortex-keypad--bleed={bleed}>
	{@render head?.()}
	<!--
		`dir="ltr"` is not redundant. The root carries the interface direction, and a
		CSS grid in RTL flows columns right to left, so [7][8][9] would render as
		[9][8][7]. Mathematics is left-to-right in every locale.
	-->
	<div
		class="pie-cortex-keypad__grid"
		role="group"
		aria-label={localization.t('keypad')}
		dir="ltr"
		bind:this={grid}
	>
		<!--
			Digits take grid columns 1-3 and operators 5-6; column 4 is a bare gutter, so
			skipping over it keeps all five keys exactly the same width. A
			`margin-inline-start` on the fourth key would instead shrink it inside its own
			column and leave one column 6px narrower than the rest.
		-->
		{#each rows as row, rowIndex (rowIndex)}
			{#each row as key, columnIndex (key.id)}
				<button
					type="button"
					class="pie-cortex-key pie-cortex-key--{key.role}"
					data-key-id={key.id}
					data-column={columnIndex + 1}
					style:grid-column={gridColumn(key, columnIndex)}
					aria-label={keyName(key)}
					tabindex={key.id === rovingKeyId ? 0 : -1}
					onkeydown={(event) => onKeydown(event, rowIndex, columnIndex)}
					onfocus={() => (focusedKeyId = key.id)}
					onpointerdown={(event) => {
						// Keep the caret and the visible focus in the mathfield. Without this
						// the button takes focus, `executeCommand` targets an unfocused field
						// and the rendered caret position stops telling the truth.
						event.preventDefault();
					}}
					onclick={() => press(key)}
				>
					{#if key.labelKind === 'math'}
						<!-- Constant LaTeX from this package's own key table, never host input. -->
						<span class="pie-cortex-key__label" aria-hidden="true"
							>{@html convertLatexToMarkup(key.visualLabel)}</span
						>
					{:else}
						<span class="pie-cortex-key__label" aria-hidden="true">{key.visualLabel}</span>
					{/if}
				</button>
			{/each}
		{/each}
	</div>
</div>

<style>
	.pie-cortex-keypad {
		display: flex;
		flex-direction: column;
		gap: var(--cortex-space-2, 0.5rem);
		/*
		 * Never shrinks. As a shrinkable flex item its rows were painted outside its
		 * box — flex shrinking does not clip — so in a short panel the bottom rows
		 * overlapped whatever followed the keypad instead of pushing the calculator
		 * into its own scroll.
		 */
		flex: 0 0 auto;
		min-width: 0;
		/*
		 * Inline padding equals the calculator root's, so the outermost key columns
		 * line up exactly with the display's left and right edges. Any other value and
		 * the keypad reads as a slightly different width from the thing above it.
		 */
		padding: var(--cortex-space-2, 0.5rem) var(--cortex-space-3, 0.75rem);
		border-radius: var(--cortex-radius-surface, 0.5rem);
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		/*
		 * A recessed plane, one step off the card. This is what makes a block of keys
		 * read as an instrument rather than as a row of form buttons — the device both
		 * Desmos and GeoGebra use. It takes --pie-background-dark, the recessed
		 * surface role. --pie-background is the page token, which a host may point at
		 * its own backdrop, and a plane resolving through it would show the host's
		 * surface through the keypad.
		 */
		background: var(
			--pie-calculator-surface-raised,
			var(--pie-background-dark, var(--cortex-surface-raised))
		);
	}

	/*
	 * Flush to the panel's edges, so the plane reads as the instrument's base rather
	 * than as a floating card: no radius and one rule along the top, which is the
	 * screen's only boundary. The calculator root drops its own padding for these
	 * types, so there is nothing left to cancel with negative margins.
	 */
	.pie-cortex-keypad--bleed {
		border: none;
		border-top: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: 0;
	}

	.pie-cortex-keypad__grid {
		display: grid;
		/*
		 * `minmax(0, 1fr)`, never `1fr`. Bare `1fr` is `minmax(auto, 1fr)`, so one wide
		 * key — `sin^-1`, the nth root — widens its column and every row below it stops
		 * lining up. This single declaration is what keeps the keypad's columns square.
		 */
		/*
		 * Five equal key columns with a bare gutter column between the third and the
		 * fourth. Digits occupy 1-3 and operators 5-6, and that gutter is what
		 * separates the two blocks — position rather than hue, because under the ten
		 * PNP colour schemes --pie-fixed-hue-collapse is 100% and there are
		 * effectively two colours, so a tint would carry nothing there.
		 */
		grid-template-columns:
			repeat(3, minmax(0, 1fr))
			var(--cortex-space-1, 0.375rem)
			repeat(2, minmax(0, 1fr));
		gap: var(--cortex-space-1, 0.375rem);
		min-width: 0;
	}

	.pie-cortex-key {
		display: flex;
		align-items: center;
		justify-content: center;
		/*
		 * min-height, never height: a fixed box clips under 1.4.12 text spacing. The
		 * value is a token because the panel is resizable — see the density tiers in
		 * `CalculatorView.svelte`. 2.75rem is 2.5.5's 44px and is what every shipped
		 * panel size gets; the tiers below it stay clear of 2.5.8's 24px floor.
		 */
		min-height: var(--cortex-key-min-height, 2.75rem);
		padding: 0.25rem;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 1rem;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.pie-cortex-key__label {
		display: block;
		pointer-events: none;
	}

	.pie-cortex-key--operator,
	.pie-cortex-key--function {
		font-weight: 600;
	}

	.pie-cortex-key--commit {
		border-color: var(--pie-primary, var(--cortex-primary));
		background: var(--pie-primary, var(--cortex-primary));
		/*
		 * --pie-white inverts by design (#ffffff light, #000000 dark, redefined per
		 * colour scheme), which is what keeps ink on a --pie-primary fill legible in
		 * every palette rather than only in the light one.
		 */
		color: var(--pie-white, var(--cortex-on-primary));
		font-weight: 700;
		font-size: 1.125rem;
	}

	.pie-cortex-key:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
		border-color: var(--pie-button-hover-border, var(--pie-border-gray, var(--cortex-border-gray)));
	}

	.pie-cortex-key--commit:hover {
		background: var(--pie-primary-dark, var(--pie-primary, var(--cortex-primary)));
		border-color: var(--pie-primary-dark, var(--pie-primary, var(--cortex-primary)));
	}

	.pie-cortex-key:active {
		background: var(--pie-button-active-bg, var(--cortex-button-active-bg));
	}

	.pie-cortex-key:focus-visible {
		/*
		 * The ring stays 3px. It is drawn *inside* the key so a 0.375rem gap can hold
		 * it: an outset 3px ring with a 2px offset needs 10px between neighbours, and
		 * widening every gutter to 10px is what makes a keypad look loose. `z-index`
		 * keeps it above the next key's background, which would otherwise overpaint it.
		 */
		position: relative;
		z-index: 1;
		outline: 3px solid var(--pie-button-focus-outline, var(--cortex-focus-outline));
		outline-offset: -3px;
	}

	/*
	 * Forced colours strip every fill, so the group boundaries and the commit key's
	 * emphasis have to be restated in system colours or the keypad flattens into one
	 * undifferentiated block.
	 */
	@media (forced-colors: active) {
		.pie-cortex-key {
			border-color: ButtonBorder;
			background: ButtonFace;
			color: ButtonText;
			forced-color-adjust: none;
		}

		.pie-cortex-key--commit {
			border-color: Highlight;
			background: Highlight;
			color: HighlightText;
		}

		.pie-cortex-key:focus-visible {
			outline-color: CanvasText;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-cortex-key {
			transition: none;
		}
	}
</style>
