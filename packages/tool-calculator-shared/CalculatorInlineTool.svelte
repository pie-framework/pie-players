<script lang="ts">
	import {
		connectToolRuntimeContext,
		toOverlayToolId,
		ZIndexLayer,
		type AssessmentToolkitRuntimeContext,
		type ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import type { MessageKey } from '@pie-players/pie-players-shared/i18n/types';
	import { untrack } from 'svelte';

	let {
		toolId = 'calculator-inline',
		targetToolId = '',
		calculatorType = 'basic',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
	}: {
		toolId?: string;
		targetToolId?: string;
		calculatorType?: string;
		availableTypes?: string;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const isBrowser = typeof window !== 'undefined';
	const CALCULATOR_VARIANTS = ['basic', 'scientific', 'graphing'] as const;
	type CalculatorVariant = (typeof CALCULATOR_VARIANTS)[number];
	const CALCULATOR_KEYS: Record<
		CalculatorVariant,
		{ name: MessageKey; opened: MessageKey; closed: MessageKey }
	> = {
		basic: {
			name: 'tools.calculator.nameBasic',
			opened: 'tools.calculator.openedBasic',
			closed: 'tools.calculator.closedBasic',
		},
		scientific: {
			name: 'tools.calculator.nameScientific',
			opened: 'tools.calculator.openedScientific',
			closed: 'tools.calculator.closedScientific',
		},
		graphing: {
			name: 'tools.calculator.nameGraphing',
			opened: 'tools.calculator.openedGraphing',
			closed: 'tools.calculator.closedGraphing',
		},
	};

	let containerElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let calculatorVisible = $state(false);
	let statusMessage = $state('');
	let registeredCoordinator: ToolCoordinatorApi | null = null;
	let registeredToolId: string | null = null;

	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	const supportedTypes = $derived(
		new Set(
			availableTypes
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean),
		),
	);
	const effectiveCalculatorType = $derived(
		supportedTypes.has(calculatorType) ? calculatorType : 'basic',
	);
	const variant = $derived(
		(CALCULATOR_VARIANTS as readonly string[]).includes(effectiveCalculatorType)
			? (effectiveCalculatorType as CalculatorVariant)
			: 'basic',
	);
	const variantKeys = $derived(CALCULATOR_KEYS[variant]);
	const calculatorName = $derived(interfaceI18n.t(variantKeys.name));
	const effectiveTargetToolId = $derived(targetToolId || toOverlayToolId(toolId));
	const sizeClass = $derived(
		size === 'sm'
			? 'pie-tool-calculator-inline__button--sm'
			: size === 'lg'
				? 'pie-tool-calculator-inline__button--lg'
				: 'pie-tool-calculator-inline__button--md',
	);

	$effect(() => {
		if (!containerElement) return;
		return connectToolRuntimeContext(
			containerElement,
			(value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		);
	});

	$effect(() => {
		const nextCoordinator = coordinator;
		const nextToolId = toolId;
		const element = containerElement;
		if (!nextCoordinator || !nextToolId || !element) return;

		untrack(() => {
			if (
				registeredCoordinator &&
				registeredToolId &&
				(registeredCoordinator !== nextCoordinator || registeredToolId !== nextToolId)
			) {
				registeredCoordinator.unregisterTool(registeredToolId);
				registeredCoordinator = null;
				registeredToolId = null;
			}
			if (!registeredCoordinator) {
				nextCoordinator.registerTool(
					nextToolId,
					'Calculator Inline',
					element,
					ZIndexLayer.TOOL,
				);
				registeredCoordinator = nextCoordinator;
				registeredToolId = nextToolId;
			}
		});

		return () => {
			if (registeredCoordinator === nextCoordinator && registeredToolId === nextToolId) {
				registeredCoordinator.unregisterTool(registeredToolId);
				registeredCoordinator = null;
				registeredToolId = null;
			}
		};
	});

	$effect(() => {
		const nextCoordinator = coordinator;
		const nextTargetToolId = effectiveTargetToolId;
		if (!isBrowser || !nextCoordinator) return;

		const update = () => {
			calculatorVisible = nextCoordinator.isToolVisible(nextTargetToolId);
		};
		const unsubscribe = nextCoordinator.subscribe(update);
		untrack(update);
		return unsubscribe;
	});

	function handleToggle(): void {
		if (!coordinator) return;
		const wasVisible = coordinator.isToolVisible(effectiveTargetToolId);
		coordinator.toggleTool(effectiveTargetToolId);
		statusMessage = interfaceI18n.t(
			wasVisible ? variantKeys.closed : variantKeys.opened,
		);
	}
</script>

{#if isBrowser}
	<div bind:this={containerElement} class="pie-tool-calculator-inline">
		<button
			type="button"
			class="pie-tool-calculator-inline__button {sizeClass}"
			class:pie-tool-calculator-inline__button--active={calculatorVisible}
			onclick={handleToggle}
			aria-label={calculatorName}
			aria-pressed={calculatorVisible}
			title={calculatorName}
			data-calculator-type={effectiveCalculatorType}
			disabled={!coordinator}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				class="pie-tool-calculator-inline__icon"
				aria-hidden="true"
			>
				<path d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V8H17V4H7M7,10V12H9V10H7M11,10V12H13V10H11M15,10V12H17V10H15M7,14V16H9V14H7M11,14V16H13V14H11M15,14V16H17V14H15M7,18V20H9V18H7M11,18V20H13V18H11M15,18V20H17V18H15Z" />
			</svg>
		</button>
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
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border: 1px solid var(--pie-border, #ccc);
		border-radius: 4px;
		/* Button fills resolve through the button tokens, which every base theme
		   and colour scheme sets opaque. The base light theme ships
		   --pie-background transparent so PIE content reveals the host page. */
		background-color: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-white, #fff)));
		color: var(--pie-text, #333);
		cursor: pointer;
		transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
	}

	.pie-tool-calculator-inline__button:hover:not(:disabled) {
		background-color: var(--pie-button-hover-background-color, var(--pie-button-hover-bg, var(--pie-secondary-background, #f5f5f5)));
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
	}

	.pie-tool-calculator-inline__button:focus-visible {
		z-index: 1;
		outline: 2px solid var(--pie-button-focus-outline, #0066cc);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--pie-button-focus-outline, #0066cc) 20%, transparent);
	}

	.pie-tool-calculator-inline__button--active {
		border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1976d2));
		background-color: var(--pie-tool-trigger-active-background, var(--pie-primary, #1976d2));
		color: var(
			--pie-tool-trigger-active-color,
			color-mix(in srgb, var(--pie-background, #fff) var(--pie-fixed-hue-collapse, 0%), white)
		);
	}

	.pie-tool-calculator-inline__button--active:hover:not(:disabled) {
		border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1976d2));
		background-color: var(
			--pie-tool-trigger-active-background,
			color-mix(
				in srgb,
				var(--pie-primary, #1565c0) var(--pie-fixed-hue-collapse, 0%),
				var(--pie-primary-dark, #1565c0)
			)
		);
		color: var(
			--pie-tool-trigger-active-color,
			color-mix(in srgb, var(--pie-background, #fff) var(--pie-fixed-hue-collapse, 0%), white)
		);
	}

	.pie-tool-calculator-inline__button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.pie-tool-calculator-inline__button--sm {
		width: 1.5rem;
		height: 1.5rem;
		padding: 0.625rem;
	}

	.pie-tool-calculator-inline__button--md {
		width: 2rem;
		height: 2rem;
	}

	.pie-tool-calculator-inline__button--lg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.pie-tool-calculator-inline__icon {
		width: 1.25rem;
		height: 1.25rem;
		fill: currentColor;
	}

	.pie-tool-calculator-inline__button:not(.pie-tool-calculator-inline__button--active):hover:not(:disabled) .pie-tool-calculator-inline__icon {
		color: var(--pie-button-hover-color, #667eea);
	}

	.pie-tool-calculator-inline__button--active .pie-tool-calculator-inline__icon {
		color: var(--pie-tool-trigger-active-color, inherit);
	}

	.pie-tool-calculator-inline__button--sm .pie-tool-calculator-inline__icon {
		width: 1rem;
		height: 1rem;
	}

	.pie-tool-calculator-inline__button--lg .pie-tool-calculator-inline__icon {
		width: 1.5rem;
		height: 1.5rem;
	}

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

	@media (prefers-reduced-motion: reduce) {
		.pie-tool-calculator-inline__button {
			transition: none;
		}
	}
</style>
