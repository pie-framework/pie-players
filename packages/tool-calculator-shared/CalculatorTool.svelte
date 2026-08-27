<script lang="ts">
	import {
		connectToolRuntimeContext,
		type AssessmentToolkitRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		Calculator,
		CalculatorProviderConfig,
		CalculatorType,
	} from '@pie-players/pie-assessment-toolkit/tools/client';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import { onMount, untrack } from 'svelte';
	import { createCalculatorConfigKey } from './calculator-config-key.js';

	let {
		visible = false,
		toolId = 'calculator',
		providerId = '',
		calculatorType = 'basic' as CalculatorType,
		availableTypes: availableTypesInput = ['basic', 'scientific', 'graphing'] as CalculatorType[],
		calculatorConfig = {} as CalculatorProviderConfig,
		toolkitCoordinator: explicitToolkitCoordinator = null,
	}: {
		visible?: boolean;
		toolId?: string;
		providerId?: string;
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[] | string;
		calculatorConfig?: CalculatorProviderConfig;
		toolkitCoordinator?: AssessmentToolkitRuntimeContext['toolkitCoordinator'] | null;
	} = $props();

	let contextHostElement = $state<HTMLDivElement | null>(null);
	let calculatorContainerElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let calculatorInstance = $state<Calculator | null>(null);
	let isInitializing = $state(false);
	let initializationError = $state<string | null>(null);
	let hasMountedSurface = $state(false);

	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	const toolkitCoordinator = $derived(
		explicitToolkitCoordinator ?? runtimeContext?.toolkitCoordinator,
	);
	const availableTypes = $derived(
		(typeof availableTypesInput === 'string'
			? availableTypesInput.split(',').map((value) => value.trim())
			: availableTypesInput
		).filter(
			(value): value is CalculatorType =>
				value === 'basic' || value === 'scientific' || value === 'graphing',
		),
	);
	const effectiveCalculatorType = $derived(
		availableTypes.includes(calculatorType)
			? calculatorType
			: (availableTypes[0] ?? 'basic'),
	);
	const calculatorConfigKey = $derived(createCalculatorConfigKey(calculatorConfig));

	let activeMountKey: string | null = null;
	let currentMountElement: HTMLDivElement | null = null;
	let mountGeneration = 0;
	let reconcileQueued = false;
	let resizeObserver: ResizeObserver | null = null;
	const resizeTimers = new Set<ReturnType<typeof setTimeout>>();

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolRuntimeContext(
			contextHostElement,
			(value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		);
	});

	function clearResizeWork(): void {
		resizeObserver?.disconnect();
		resizeObserver = null;
		for (const timer of resizeTimers) clearTimeout(timer);
		resizeTimers.clear();
	}

	function destroyCalculator(): void {
		mountGeneration += 1;
		clearResizeWork();
		const instance = calculatorInstance;
		const mountElement = currentMountElement;
		calculatorInstance = null;
		currentMountElement = null;
		try {
			instance?.destroy();
		} catch (error) {
			console.warn('[CalculatorTool] calculator cleanup failed:', error);
		}
		mountElement?.remove();
		activeMountKey = null;
		isInitializing = false;
		hasMountedSurface = false;
	}

	function focusCalculator(): void {
		requestAnimationFrame(() => {
			if (!visible || !calculatorInstance || !currentMountElement?.isConnected) return;
			const activeElement = document.activeElement;
			if (activeElement instanceof Node && currentMountElement.contains(activeElement)) return;
			calculatorInstance.focus?.();
		});
	}

	function startResizeTracking(instance: Calculator, container: HTMLDivElement): void {
		clearResizeWork();
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				if (visible && container.isConnected) instance.resize?.();
			});
			resizeObserver.observe(container);
		}
		for (const delay of [60, 250, 1000]) {
			const timer = setTimeout(() => {
				resizeTimers.delete(timer);
				if (visible && container.isConnected) instance.resize?.();
			}, delay);
			resizeTimers.add(timer);
		}
	}

	async function initializeCalculator(
		generation: number,
		mountKey: string,
		mountElement: HTMLDivElement,
	): Promise<void> {
		isInitializing = true;
		initializationError = null;
		try {
			if (!providerId) throw new Error('Calculator provider id is required');
			const registry = toolkitCoordinator?.toolProviderRegistry;
			if (!registry) throw new Error('Calculator provider registry is unavailable');
			const toolProvider = await registry.getProvider(providerId);
			const calculatorProvider = await toolProvider.createInstance();
			if (generation !== mountGeneration || !visible || !mountElement.isConnected) {
				mountElement.remove();
				return;
			}

			const instance = await calculatorProvider.createCalculator(
				effectiveCalculatorType,
				mountElement,
				calculatorConfig,
			);
			if (generation !== mountGeneration || !visible || !mountElement.isConnected) {
				instance.destroy();
				mountElement.remove();
				return;
			}

			calculatorInstance = instance;
			activeMountKey = mountKey;
			hasMountedSurface = mountElement.childElementCount > 0;
			startResizeTracking(instance, mountElement);
			requestAnimationFrame(() => {
				if (generation !== mountGeneration) return;
				instance.resize?.();
				hasMountedSurface = mountElement.childElementCount > 0;
				focusCalculator();
			});
		} catch (error) {
			if (generation !== mountGeneration) {
				mountElement.remove();
				return;
			}
			initializationError = error instanceof Error ? error.message : String(error);
			calculatorInstance = null;
			if (currentMountElement === mountElement) currentMountElement = null;
			mountElement.remove();
			hasMountedSurface = false;
		} finally {
			if (generation === mountGeneration) isInitializing = false;
		}
	}

	function reconcileCalculator(): void {
		reconcileQueued = false;
		const container = calculatorContainerElement;
		const coordinator = toolkitCoordinator;
		if (!visible || !container || !container.isConnected || !coordinator) {
			if (calculatorInstance || isInitializing || currentMountElement) destroyCalculator();
			initializationError = null;
			return;
		}

		const mountKey = `${providerId}:${effectiveCalculatorType}:${calculatorConfigKey}`;
		if (
			calculatorInstance &&
			activeMountKey === mountKey
		) {
			focusCalculator();
			return;
		}

		if (calculatorInstance || isInitializing || currentMountElement) destroyCalculator();
		const mountElement = document.createElement('div');
		mountElement.className = 'pie-tool-calculator__mount';
		container.replaceChildren(mountElement);
		currentMountElement = mountElement;
		const generation = ++mountGeneration;
		void initializeCalculator(generation, mountKey, mountElement);
	}

	function queueReconcile(): void {
		if (reconcileQueued) return;
		reconcileQueued = true;
		queueMicrotask(reconcileCalculator);
	}

	$effect(() => {
		void visible;
		void providerId;
		void effectiveCalculatorType;
		void calculatorConfig;
		void calculatorConfigKey;
		void calculatorContainerElement;
		void toolkitCoordinator;
		untrack(queueReconcile);
	});

	onMount(() => () => destroyCalculator());
</script>

<div bind:this={contextHostElement} class="pie-tool-calculator__context-host">
	{#if visible}
		<div
			class="pie-tool-calculator notranslate"
			role="region"
			data-tool-id={toolId}
			data-provider-id={providerId}
			tabindex="-1"
			lang={interfaceI18n.getLocale()}
			dir={interfaceI18n.getDirection?.() ?? 'ltr'}
			aria-label={interfaceI18n.t('tools.calculator.toolA11y')}
			translate="no"
		>
			<div
				bind:this={calculatorContainerElement}
				class="pie-tool-calculator__container"
				data-calculator-type={effectiveCalculatorType}
			></div>
			{#if isInitializing || (!initializationError && !hasMountedSurface)}
				<div class="pie-tool-calculator__loading">
					{interfaceI18n.t('tools.calculator.loading')}
				</div>
			{/if}
			{#if initializationError}
				<div class="pie-tool-calculator__loading pie-tool-calculator__loading--error">
					Calculator failed to initialize.
					<div class="pie-tool-calculator__error-details">{initializationError}</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.pie-tool-calculator__context-host {
		display: flex;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.pie-tool-calculator {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 100%;
		min-height: 0;
		background: var(--pie-white, white);
		overflow: hidden;
	}

	.pie-tool-calculator__container {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 100%;
		min-height: 100%;
		/*
		 * `--pie-white`, not the literal. The token inverts by design (#ffffff light,
		 * #000000 dark, redefined per colour scheme), so a hardcoded white showed
		 * through as a white plate behind a dark calculator the moment a provider's own
		 * surface stopped being opaque — and under a PNP colour scheme it was simply
		 * the wrong colour.
		 */
		background: var(--pie-white, white);
		overflow: hidden;
	}

	:global(.pie-tool-calculator__mount) {
		width: 100%;
		height: 100%;
		min-width: 100%;
		min-height: 100%;
	}

	.pie-tool-calculator__loading {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--pie-white, #fff) 90%, transparent);
		color: var(--pie-text, #334155);
		font-size: 0.9rem;
	}

	.pie-tool-calculator__loading--error {
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		color: var(--pie-incorrect, #b91c1c);
		text-align: center;
	}

	.pie-tool-calculator__error-details {
		max-width: 95%;
		color: var(--pie-incorrect, #7f1d1d);
		font-size: 0.8rem;
		line-height: 1.2;
		word-break: break-word;
	}

	:global(.pie-tool-calculator__mount > *) {
		width: 100% !important;
		height: 100% !important;
	}
</style>
