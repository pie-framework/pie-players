<script lang="ts">
	/**
	 * Main Calculator Component
	 * Professional, WCAG 2.2 Level AA compliant calculator with DaisyUI theming
	 */
	import { onMount, onDestroy } from 'svelte';
	import type { CalculationHistoryEntry } from '@pie-players/pie-calculator';

	import CalculatorDisplay from './CalculatorDisplay.svelte';
	import ErrorAlert from './ErrorAlert.svelte';
	import MemoryButtons from './MemoryButtons.svelte';
	import ScientificButtons from './ScientificButtons.svelte';
	import CalculatorGrid from './CalculatorGrid.svelte';

	interface Props {
		type?: 'basic' | 'scientific';
		theme?: 'light' | 'dark' | 'auto';
		math: any; // Math.js instance
		onStateChange?: (state: any) => void;
	}

	let {
		type = 'basic',
		theme = 'light',
		math,
		onStateChange
	}: Props = $props();

	// Calculator state
	let currentExpression = $state('');
	let currentValue = $state('0');
	let history: CalculationHistoryEntry[] = $state([]);
	let angleMode: 'deg' | 'rad' = $state('deg');
	let memory = $state(0);

	// UI state
	let errorMessage = $state('');
	let errorVisible = $state(false);
	let historyText = $state('');
	let statusMessage = $state('');

	// Keyboard handler
	let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	// Computed values
	const displayValue = $derived(currentExpression || currentValue);
	const calculatorTitle = $derived(type === 'scientific' ? 'Scientific Calculator' : 'Basic Calculator');
	const instructionsId = $derived(`calc-instructions-${Math.random().toString(36).substring(2, 11)}`);
	const statusId = $derived(`calc-status-${Math.random().toString(36).substring(2, 11)}`);

	// Input handling
	function handleInput(input: string) {
		currentExpression += input;
		announceToScreenReader(input);
	}

	// Action handling
	function handleAction(action: string) {
		switch (action) {
			case 'clear':
				clear();
				announceToScreenReader('Cleared');
				break;

			case 'plusMinus':
				toggleSign();
				break;

			case 'equals':
				calculate();
				break;

			case 'toggleAngle':
				toggleAngleMode();
				break;
		}
	}

	// Function handling
	function handleFunction(func: string) {
		const value = currentExpression || currentValue;

		switch (func) {
			case 'sin':
			case 'cos':
			case 'tan':
				currentExpression = `${func}(${value} ${angleMode})`;
				announceToScreenReader(func);
				break;

			case 'sqrt':
				currentExpression = `sqrt(${value})`;
				announceToScreenReader('Square root');
				break;

			case 'log':
				currentExpression = `log10(${value})`;
				announceToScreenReader('Logarithm base 10');
				break;

			case 'ln':
				currentExpression = `log(${value})`;
				announceToScreenReader('Natural logarithm');
				break;

			case 'pow':
				currentExpression = `${value}^`;
				announceToScreenReader('Power');
				break;
		}
	}

	// Memory operations
	function handleMemoryClear() {
		memory = 0;
		announceToScreenReader('Memory cleared');
	}

	function handleMemoryRecall() {
		if (memory !== 0) {
			currentExpression = String(memory);
			announceToScreenReader(`Recalled ${memory} from memory`);
		}
	}

	function handleMemoryAdd() {
		const addValue = parseFloat(currentValue);
		if (!isNaN(addValue)) {
			memory += addValue;
			announceToScreenReader(`Added ${addValue} to memory`);
		}
	}

	function handleMemorySubtract() {
		const subValue = parseFloat(currentValue);
		if (!isNaN(subValue)) {
			memory -= subValue;
			announceToScreenReader(`Subtracted ${subValue} from memory`);
		}
	}

	// Calculator operations
	function clear() {
		currentExpression = '';
		currentValue = '0';
		historyText = '';
		hideError();
	}

	function toggleSign() {
		if (currentValue !== '0') {
			const num = parseFloat(currentValue);
			currentValue = String(-num);
			announceToScreenReader(`${num > 0 ? 'Negative' : 'Positive'} ${Math.abs(num)}`);
		}
	}

	function toggleAngleMode() {
		angleMode = angleMode === 'deg' ? 'rad' : 'deg';
		announceToScreenReader(`Angle mode: ${angleMode === 'deg' ? 'degrees' : 'radians'}`);
	}

	function calculate() {
		if (!currentExpression) return;

		try {
			const result = math.evaluate(currentExpression);
			const resultStr = formatResult(result);

			history.push({
				expression: currentExpression,
				result: resultStr,
				timestamp: Date.now()
			});

			currentValue = resultStr;
			historyText = `${currentExpression} =`;
			currentExpression = '';

			announceToScreenReader(`Result: ${resultStr}`);
			hideError();

			// Notify parent of state change
			if (onStateChange) {
				onStateChange({
					value: currentValue,
					history,
					expression: currentExpression,
					angleMode,
					memory
				});
			}
		} catch (error) {
			handleError(error as Error);
		}
	}

	function handleError(error: Error) {
		let message = 'An error occurred';

		if (error.message.includes('divide') && error.message.includes('zero')) {
			message = 'Cannot divide by zero';
		} else if (error.message.includes('overflow')) {
			message = 'Result is too large';
		} else if (error.message.includes('syntax') || error.message.includes('Unexpected')) {
			message = 'Invalid expression';
		}

		currentValue = 'Error';
		showError(message);
		announceToScreenReader(message);

		// Auto-hide after 5 seconds
		setTimeout(() => {
			if (currentValue === 'Error') {
				hideError();
				currentValue = '0';
			}
		}, 5000);
	}

	function formatResult(result: any): string {
		if (typeof result === 'number') {
			// Handle zero specially
			if (result === 0) {
				return '0';
			}
			// Handle very large/small numbers (but not zero)
			if (Math.abs(result) > 1e10 || (Math.abs(result) < 1e-10 && result !== 0)) {
				return result.toExponential(6);
			}
			// Remove trailing zeros
			return result.toPrecision(10).replace(/\.?0+$/, '');
		}
		return String(result);
	}

	function showError(message: string) {
		errorMessage = message;
		errorVisible = true;
	}

	function hideError() {
		errorVisible = false;
	}

	function announceToScreenReader(message: string) {
		statusMessage = message;
	}

	// Keyboard handling
	function handleKeyboard(e: KeyboardEvent) {
		// Don't intercept if user is typing in the input field
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT') {
			// Only handle Escape when in input
			if (e.key === 'Escape') {
				clear();
			}
			return;
		}

		const key = e.key;

		// Numbers and basic operators
		if (/[0-9\+\-\*\/\.\(\)]/.test(key)) {
			e.preventDefault();
			handleInput(key);
		} else if (key === 'Enter' || key === '=') {
			e.preventDefault();
			calculate();
		} else if (key === 'Escape' || key.toLowerCase() === 'c') {
			e.preventDefault();
			clear();
		} else if (key === 'Backspace') {
			e.preventDefault();
			currentExpression = currentExpression.slice(0, -1);
		} else if (key === '%') {
			e.preventDefault();
			handleInput('%');
		}
	}

	// Public API (exposed via context or props)
	export function getValue(): string {
		return currentValue;
	}

	export function setValue(value: string) {
		currentValue = value;
		currentExpression = '';
	}

	export function getHistory(): CalculationHistoryEntry[] {
		return [...history];
	}

	export function clearHistory() {
		history = [];
		historyText = '';
	}

	export function exportState() {
		return {
			type,
			provider: 'mathjs',
			value: currentValue,
			history,
			providerState: {
				expression: currentExpression,
				angleMode,
				memory
			}
		};
	}

	export function importState(state: any) {
		if (state.provider !== 'mathjs') {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		currentValue = state.value;
		if (state.history) history = [...state.history];

		if (state.providerState) {
			currentExpression = state.providerState.expression || '';
			angleMode = state.providerState.angleMode || 'deg';
			memory = state.providerState.memory || 0;
		}
	}

	// Lifecycle
	onMount(() => {
		keyboardHandler = handleKeyboard;
		document.addEventListener('keydown', keyboardHandler);
	});

	onDestroy(() => {
		if (keyboardHandler) {
			document.removeEventListener('keydown', keyboardHandler);
		}
	});
</script>

<div
	class="calculator-mathjs card bg-base-100 shadow-xl w-full max-w-md"
	data-theme={theme}
	role="dialog"
	aria-label={calculatorTitle}
	aria-describedby={instructionsId}
>
	<!-- Screen reader instructions -->
	<div id={instructionsId} class="sr-only">
		Type mathematical expressions like sin(45), sqrt(16), or 2+2 directly, or use arrow keys to navigate between buttons. Press Enter or Space to activate a button.
	</div>

	<!-- Calculator header -->
	<div class="card-header bg-primary text-primary-content p-4 rounded-t-2xl">
		<div class="flex justify-between items-center">
			<h2 class="text-lg font-bold">
				{calculatorTitle}
			</h2>
			{#if type === 'scientific'}
				<button
					class="btn btn-ghost btn-sm btn-circle"
					aria-label="Toggle angle mode. Current mode: {angleMode === 'deg'
						? 'degrees'
						: 'radians'}"
					onclick={toggleAngleMode}
				>
					<span class="text-sm font-mono">{angleMode.toUpperCase()}</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Calculator display -->
	<CalculatorDisplay
		bind:currentExpression
		currentValue={displayValue}
		{historyText}
		onEnter={calculate}
	/>

	<!-- Error display -->
	<ErrorAlert message={errorMessage} visible={errorVisible} />

	<!-- Calculator buttons -->
	<div class="card-body p-4">
		<!-- Memory functions -->
		<MemoryButtons
			memoryValue={memory}
			onMemoryClear={handleMemoryClear}
			onMemoryRecall={handleMemoryRecall}
			onMemoryAdd={handleMemoryAdd}
			onMemorySubtract={handleMemorySubtract}
		/>

		<!-- Scientific functions -->
		{#if type === 'scientific'}
			<ScientificButtons onFunction={handleFunction} onInput={handleInput} />
		{/if}

		<!-- Main calculator grid -->
		<CalculatorGrid {type} onInput={handleInput} onAction={handleAction} />
	</div>

	<!-- Screen reader announcements -->
	<div class="sr-only" aria-live="polite" aria-atomic="true" id={statusId}>
		{statusMessage}
	</div>
</div>

<style>
	/* Screen reader only utility */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Calculator specific styles */
	.calculator-mathjs {
		user-select: none;
		-webkit-user-select: none;
	}

	/* Enhanced focus visibility for WCAG 2.4.7 */
	:global(.calculator-mathjs .btn:focus-visible) {
		outline: 3px solid hsl(var(--p));
		outline-offset: 2px;
		z-index: 10;
	}

	/* Touch-friendly button sizing (48x48px minimum) */
	:global(.calculator-mathjs .btn-lg) {
		min-height: 48px;
		min-width: 48px;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		:global(.calculator-mathjs .btn) {
			border: 2px solid currentColor;
		}

		:global(.calculator-display) {
			border: 2px solid currentColor;
		}
	}

	/* Windows High Contrast Mode */
	@media (forced-colors: active) {
		:global(.calculator-mathjs .btn) {
			border: 2px solid ButtonText;
		}

		:global(.calculator-mathjs .btn:focus) {
			outline: 3px solid Highlight;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		:global(.calculator-mathjs .btn) {
			transition: none;
		}
	}

	/* Button press animation */
	@keyframes button-press {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(0.95);
		}
	}

	:global(.calculator-mathjs .btn:active) {
		animation: button-press 150ms ease-out;
	}
</style>
