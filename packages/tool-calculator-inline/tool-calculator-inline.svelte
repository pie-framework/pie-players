<svelte:options
	customElement={{
		tag: 'pie-tool-calculator-inline',
		shadow: 'none',
		props: {
			toolId: { type: 'String', attribute: 'tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'String', attribute: 'available-types' },
			size: { type: 'String', attribute: 'size' },

			// Services (passed as JS properties, not attributes)
			coordinator: { type: 'Object', reflect: false }
		}
	}}
/>

<script lang="ts">
	import type { IToolCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

	// Props
	let {
		toolId = 'calculator-inline',
		calculatorType = 'scientific',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
		coordinator
	}: {
		toolId?: string;
		calculatorType?: string;
		availableTypes?: string;
		size?: 'sm' | 'md' | 'lg';
		coordinator?: IToolCoordinator;
	} = $props();

	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let registered = $state(false);
	let calculatorVisible = $state(false);
	let statusMessage = $state('');

	// Register with coordinator
	$effect(() => {
		if (coordinator && toolId && containerEl && !registered) {
			coordinator.registerTool(toolId, 'Calculator Inline', containerEl, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	// Subscribe to coordinator to track calculator visibility
	$effect(() => {
		if (!isBrowser || !coordinator) return;

		const unsubscribe = coordinator.subscribe(() => {
			// The calculator tool uses the base toolId without the "-inline" suffix
			const calculatorToolId = toolId.replace('-inline', '');
			calculatorVisible = coordinator.isToolVisible(calculatorToolId);
		});

		// Initial update
		const calculatorToolId = toolId.replace('-inline', '');
		calculatorVisible = coordinator.isToolVisible(calculatorToolId);

		return unsubscribe;
	});

	// Cleanup when component unmounts
	$effect(() => {
		return () => {
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Handle toggle click
	function handleToggle() {
		if (!coordinator) return;

		// Toggle the calculator tool visibility
		const calculatorToolId = toolId.replace('-inline', '');
		coordinator.toggleTool(calculatorToolId);

		statusMessage = calculatorVisible
			? 'Calculator closed'
			: 'Calculator opened';
	}

	// Size classes
	const sizeClass = $derived(
		size === 'sm'
			? 'pie-tool-calculator-inline__button--sm'
			: size === 'lg'
				? 'pie-tool-calculator-inline__button--lg'
				: 'pie-tool-calculator-inline__button--md'
	);
</script>

{#if isBrowser}
	<div bind:this={containerEl} class="pie-tool-calculator-inline">
		<!-- Calculator Toggle Button -->
		<button
			type="button"
			class="pie-tool-calculator-inline__button {sizeClass}"
			class:pie-tool-calculator-inline__button--active={calculatorVisible}
			onclick={handleToggle}
			aria-label={calculatorVisible ? 'Close calculator' : 'Open calculator'}
			aria-pressed={calculatorVisible}
			title={calculatorVisible ? 'Close calculator' : 'Open calculator'}
			disabled={!coordinator}
		>
			<!-- Material Design Calculator Icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				class="pie-tool-calculator-inline__icon"
				aria-hidden="true"
			>
				<path
					d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V8H17V4H7M7,10V12H9V10H7M11,10V12H13V10H11M15,10V12H17V10H15M7,14V16H9V14H7M11,14V16H13V14H11M15,14V16H17V14H15M7,18V20H9V18H7M11,18V20H13V18H11M15,18V20H17V18H15Z"
				/>
			</svg>
		</button>

		<!-- Screen reader status announcements -->
		<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
			{statusMessage}
		</div>
	</div>
{/if}

<style>
	.pie-tool-calculator-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.pie-tool-calculator-inline__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--pie-border, #ccc);
		background-color: var(--pie-background, white);
		color: var(--pie-text, #333);
		border-radius: 4px;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			transform 0.1s ease,
			box-shadow 0.15s ease;
		padding: 0.25rem;
		position: relative;
	}

	.pie-tool-calculator-inline__button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.pie-tool-calculator-inline__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	/* Focus indicator - WCAG 2.4.7, 2.4.13 */
	.pie-tool-calculator-inline__button:focus-visible {
		outline: 2px solid #0066cc;
		outline-offset: 2px;
		box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.2);
		z-index: 1;
	}

	.pie-tool-calculator-inline__button--active {
		background-color: var(--pie-primary, #1976d2);
		color: white;
		border-color: var(--pie-primary, #1976d2);
	}

	.pie-tool-calculator-inline__button--active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.pie-tool-calculator-inline__button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Size variants */
	.pie-tool-calculator-inline__button--sm {
		width: 1.5rem;
		height: 1.5rem;
		/* Increase padding to meet 44px touch target - WCAG 2.5.2 */
		padding: 0.625rem;
	}

	.pie-tool-calculator-inline__button--sm .pie-tool-calculator-inline__icon {
		width: 1rem;
		height: 1rem;
	}

	.pie-tool-calculator-inline__button--md {
		width: 2rem;
		height: 2rem;
	}

	.pie-tool-calculator-inline__button--md .pie-tool-calculator-inline__icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.pie-tool-calculator-inline__button--lg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.pie-tool-calculator-inline__button--lg .pie-tool-calculator-inline__icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	.pie-tool-calculator-inline__icon {
		fill: currentColor;
		color: #555;
	}

	.pie-tool-calculator-inline__button:hover:not(:disabled) .pie-tool-calculator-inline__icon {
		color: #667eea;
	}

	.pie-tool-calculator-inline__button--active .pie-tool-calculator-inline__icon {
		color: white;
	}

	/* Screen reader only content */
	.pie-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.pie-tool-calculator-inline__button {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
