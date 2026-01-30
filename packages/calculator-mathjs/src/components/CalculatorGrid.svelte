<script lang="ts">
	/**
	 * Calculator button grid component
	 * Number pad and operators with ARIA grid navigation
	 */
	import CalculatorButton from './CalculatorButton.svelte';

	interface Props {
		type: 'basic' | 'scientific';
		onInput: (value: string) => void;
		onAction: (action: string) => void;
	}

	let { type = 'basic', onInput, onAction }: Props = $props();

	let gridEl: HTMLDivElement | undefined = $state();
	let currentRow = $state(0);
	let currentCol = $state(0);
	let grid: HTMLElement[][] = $state([]);

	function buildGrid() {
		if (!gridEl) return;
		const rows = gridEl.querySelectorAll('[role="row"]');
		grid = Array.from(rows).map((row) =>
			Array.from(row.querySelectorAll('[role="gridcell"]'))
		) as HTMLElement[][];
	}

	function handleGridNavigation(e: KeyboardEvent) {
		if (!grid.length) return;

		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				currentRow = Math.max(0, currentRow - 1);
				handled = true;
				break;

			case 'ArrowDown':
				currentRow = Math.min(grid.length - 1, currentRow + 1);
				handled = true;
				break;

			case 'ArrowLeft':
				currentCol = Math.max(0, currentCol - 1);
				handled = true;
				break;

			case 'ArrowRight':
				currentCol = Math.min(grid[currentRow].length - 1, currentCol + 1);
				handled = true;
				break;

			case 'Home':
				currentCol = 0;
				handled = true;
				break;

			case 'End':
				currentCol = grid[currentRow].length - 1;
				handled = true;
				break;

			case 'Enter':
			case ' ': {
				const button = grid[currentRow][currentCol];
				if (button && !button.hasAttribute('disabled')) {
					button.click();
					handled = true;
				}
				break;
			}
		}

		if (handled) {
			e.preventDefault();
			updateGridFocus();
		}
	}

	function updateGridFocus() {
		const button = grid[currentRow]?.[currentCol];
		if (button) {
			button.focus();
			if (gridEl) {
				gridEl.setAttribute('aria-activedescendant', button.id || '');
			}
		}
	}

	$effect(() => {
		buildGrid();
	});
</script>

<div
	bind:this={gridEl}
	role="grid"
	aria-label="Calculator buttons"
	tabindex="0"
	class="calculator-grid"
	onkeydown={handleGridNavigation}
>
	<!-- Row 1 -->
	<div role="row" class="grid grid-cols-4 gap-2 mb-2">
		<CalculatorButton
			label="AC"
			ariaLabel="All clear"
			variant="error"
			onclick={() => onAction('clear')}
		/>
		<CalculatorButton
			label="±"
			ariaLabel="Plus minus"
			variant="warning"
			onclick={() => onAction('plusMinus')}
		/>
		<CalculatorButton
			label="%"
			ariaLabel="Percent"
			variant="warning"
			onclick={() => onInput('%')}
		/>
		<CalculatorButton
			label="÷"
			ariaLabel="Divide"
			variant="primary"
			onclick={() => onInput('/')}
		/>
	</div>

	<!-- Row 2 -->
	<div role="row" class="grid grid-cols-4 gap-2 mb-2">
		<CalculatorButton label="7" ariaLabel="Seven" onclick={() => onInput('7')} />
		<CalculatorButton label="8" ariaLabel="Eight" onclick={() => onInput('8')} />
		<CalculatorButton label="9" ariaLabel="Nine" onclick={() => onInput('9')} />
		<CalculatorButton
			label="×"
			ariaLabel="Multiply"
			variant="primary"
			onclick={() => onInput('*')}
		/>
	</div>

	<!-- Row 3 -->
	<div role="row" class="grid grid-cols-4 gap-2 mb-2">
		<CalculatorButton label="4" ariaLabel="Four" onclick={() => onInput('4')} />
		<CalculatorButton label="5" ariaLabel="Five" onclick={() => onInput('5')} />
		<CalculatorButton label="6" ariaLabel="Six" onclick={() => onInput('6')} />
		<CalculatorButton
			label="−"
			ariaLabel="Subtract"
			variant="primary"
			onclick={() => onInput('-')}
		/>
	</div>

	<!-- Row 4 -->
	<div role="row" class="grid grid-cols-4 gap-2 mb-2">
		<CalculatorButton label="1" ariaLabel="One" onclick={() => onInput('1')} />
		<CalculatorButton label="2" ariaLabel="Two" onclick={() => onInput('2')} />
		<CalculatorButton label="3" ariaLabel="Three" onclick={() => onInput('3')} />
		<CalculatorButton label="+" ariaLabel="Add" variant="primary" onclick={() => onInput('+')} />
	</div>

	<!-- Row 5 -->
	<div role="row" class="grid grid-cols-4 gap-2">
		<CalculatorButton label="0" ariaLabel="Zero" wide onclick={() => onInput('0')} />
		<CalculatorButton label="." ariaLabel="Decimal point" onclick={() => onInput('.')} />
		<CalculatorButton
			label="="
			ariaLabel="Equals"
			variant="success"
			onclick={() => onAction('equals')}
		/>
	</div>
</div>
