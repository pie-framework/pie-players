<script lang="ts">
	/**
	 * Calculator display component
	 * Shows calculation history and editable expression input with ARIA live regions
	 */
	interface Props {
		currentExpression: string;
		currentValue: string;
		historyText?: string;
		onEnter?: () => void;
		disabled?: boolean;
	}

	let {
		currentExpression = $bindable(''),
		currentValue = '0',
		historyText = '',
		onEnter,
		disabled = false
	}: Props = $props();

	let inputElement: HTMLInputElement;

	// Display value - derived from current expression or value
	const displayValue = $derived(currentExpression || currentValue);

	// Local input state for user typing
	let localInput = $state('');
	let isTyping = $state(false);

	// Sync local input with display value when not typing
	$effect(() => {
		if (!isTyping) {
			localInput = displayValue;
		}
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		isTyping = true;
		localInput = target.value;
		// Update parent's expression
		currentExpression = target.value;
	}

	function handleFocus() {
		isTyping = true;
	}

	function handleBlur() {
		isTyping = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onEnter) {
			onEnter();
		}
	}

	// Focus management
	export function focus() {
		inputElement?.focus();
	}
</script>

<div class="calculator-display bg-base-200 p-6" role="region" aria-label="Calculator display">
	<!-- History line -->
	<div
		role="log"
		aria-live="polite"
		aria-label="Calculation history"
		class="calculator-history text-sm opacity-60 font-mono text-right min-h-6 mb-2"
	>
		{historyText}
	</div>

	<!-- Main input (editable expression) -->
	<input
		bind:this={inputElement}
		value={localInput}
		oninput={handleInput}
		onfocus={handleFocus}
		onblur={handleBlur}
		type="text"
		aria-label="Mathematical expression input"
		aria-describedby="calc-help-text"
		placeholder="Enter expression"
		onkeydown={handleKeydown}
		{disabled}
		class="calculator-display-input input w-full text-4xl font-mono text-right bg-transparent border-none focus:outline-offset-2 p-0"
		spellcheck="false"
		autocomplete="off"
		inputmode="text"
	/>

	<!-- Hidden help text for screen readers -->
	<div id="calc-help-text" class="sr-only">
		Type mathematical expressions like 2+2, sin(45), sqrt(16), or use the buttons below
	</div>

	<!-- Result announcement for screen readers -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{#if historyText}
			Result: {currentValue}
		{/if}
	</div>
</div>

<style>
	.calculator-display-input {
		cursor: text;
	}

	.calculator-display-input::placeholder {
		opacity: 0.4;
	}

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
</style>
