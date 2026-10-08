<script lang="ts">
	import {
		connectToolRuntimeContext,
		connectToolShellContext,
		type AssessmentToolkitRuntimeContext,
		type AssessmentToolkitShellContext,
		type ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import type { MessageKey } from '@pie-players/pie-players-shared/i18n/types';
	import { untrack } from 'svelte';
	import {
		canOpenInlineCalculator,
		inlineCalculatorInstanceId,
		resolveInlineCalculatorTarget,
		toggleInlineCalculator,
	} from './inline-calculator-target.js';

	let {
		targetToolId = '',
		calculatorType = 'basic',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
	}: {
		targetToolId?: string;
		calculatorType?: string;
		availableTypes?: string;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const isBrowser = typeof window !== 'undefined';
	const UNRESOLVED_TARGET_WARNING_DELAY_MS = 1000;
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
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let calculatorVisible = $state(false);
	let requestable = $state(false);
	let statusMessage = $state('');

	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	const toolkitCoordinator = $derived(runtimeContext?.toolkitCoordinator ?? null);
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
	// Opening goes through the target toolbar's tool request, so the button offers
	// only a calculator that toolbar renders under its policy.
	const target = $derived(resolveInlineCalculatorTarget(targetToolId, shellContext));
	const effectiveTargetToolId = $derived(target ? inlineCalculatorInstanceId(target) : null);
	const sizeClass = $derived(
		size === 'sm'
			? 'pie-tool-calculator-inline__button--sm'
			: size === 'lg'
				? 'pie-tool-calculator-inline__button--lg'
				: 'pie-tool-calculator-inline__button--md',
	);

	$effect(() => {
		if (!containerElement) return;
		const disconnectRuntime = connectToolRuntimeContext(
			containerElement,
			(value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		);
		const disconnectShell = connectToolShellContext(
			containerElement,
			(value: AssessmentToolkitShellContext) => {
				shellContext = value;
			},
		);
		return () => {
			disconnectShell();
			disconnectRuntime();
		};
	});

	// Context values arrive through provider retries, so a missing target is
	// reported only once it has had time to resolve.
	$effect(() => {
		if (!isBrowser || !coordinator || effectiveTargetToolId) return;
		const timer = setTimeout(() => {
			console.warn(
				targetToolId
					? `[pie-tool-calculator-inline] target-tool-id "${targetToolId}" is not a scoped tool id of the form <toolId>:<section|item|passage>:<scopeId>.`
					: '[pie-tool-calculator-inline] No calculator to toggle: place the button inside <pie-item-scope>, or set target-tool-id to the calculator tool id.',
			);
		}, UNRESOLVED_TARGET_WARNING_DELAY_MS);
		return () => clearTimeout(timer);
	});

	// Whether the target toolbar hosts the calculator. Toolbars come and go, a
	// policy change moves what they host, and a toolbar whose calculator failed to
	// load re-announces the targets. The policy re-check waits a microtask, so it
	// reads the toolbar's visible set after the toolbar has followed the change.
	$effect(() => {
		const nextCoordinator = toolkitCoordinator;
		const nextTarget = target;
		if (!isBrowser || !nextCoordinator || !nextTarget) {
			requestable = false;
			return;
		}
		let disposed = false;
		const update = () => {
			if (disposed) return;
			requestable = canOpenInlineCalculator(nextCoordinator, nextTarget);
		};
		const unsubscribeTargets = nextCoordinator.onToolRequestTargetsChange?.(update);
		const unsubscribePolicy = nextCoordinator.onPolicyChange?.(() => queueMicrotask(update));
		untrack(update);
		return () => {
			disposed = true;
			unsubscribeTargets?.();
			unsubscribePolicy?.();
		};
	});

	$effect(() => {
		const nextCoordinator = coordinator;
		const nextTargetToolId = effectiveTargetToolId;
		if (!isBrowser || !nextCoordinator || !nextTargetToolId) return;

		const update = () => {
			calculatorVisible = nextCoordinator.isToolVisible(nextTargetToolId);
		};
		const unsubscribe = nextCoordinator.subscribe(update);
		untrack(update);
		return unsubscribe;
	});

	function handleToggle(): void {
		if (!coordinator || !toolkitCoordinator || !target) return;
		const result = toggleInlineCalculator(coordinator, toolkitCoordinator, target);
		if (result === 'unavailable') {
			requestable = false;
			return;
		}
		statusMessage = interfaceI18n.t(result === 'opened' ? variantKeys.opened : variantKeys.closed);
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
			disabled={!coordinator || !requestable}
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
