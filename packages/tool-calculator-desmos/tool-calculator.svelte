<svelte:options
	customElement={{
		tag: 'pie-tool-calculator',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'Array', attribute: 'available-types' },
			toolkitCoordinator: { type: 'Object' }
		}
	}}
/>

<!--
	Calculator Tool Component

	Provides calculator support with the Desmos provider.

	Calculator Types:
	- basic, scientific, graphing: Desmos calculators (requires API key for production)

	Desmos API Key (Required for Production):
	The Desmos calculators (basic, scientific, graphing) require an API key for production use.
	Development and testing work without an API key.

	To obtain a Desmos API key:
	- Visit: https://www.desmos.com/api
	- Contact: partnerships@desmos.com

	To provide the API key, initialize the provider before using this component:

		import { DesmosCalculatorProvider } from '@pie-players/pie-assessment-toolkit/tools/client';

		const provider = new DesmosCalculatorProvider();
		await provider.initialize({
			apiKey: 'your_desmos_api_key_here'
		});

	For more information, see:
	- packages/assessment-toolkit/src/tools/calculators/README.md
	- docs/architecture.md (Calculator Provider System section)
-->

<script lang="ts">
	
	import {
		connectToolRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit';
	import type { Calculator, CalculatorProviderConfig, CalculatorType } from '@pie-players/pie-assessment-toolkit/tools/client';
import { onMount } from 'svelte';

	// ============================================================================
	// Constants
	// ============================================================================

	// ============================================================================
	// Props
	// ============================================================================

	let {
		visible = false,
		toolId = 'calculator',
		calculatorType = 'basic' as CalculatorType,
		availableTypes: availableTypesInput = ['basic', 'scientific', 'graphing'] as CalculatorType[],
		toolkitCoordinator: explicitToolkitCoordinator = null
	}: {
		visible?: boolean;
		toolId?: string;
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[] | string;
		toolkitCoordinator?: AssessmentToolkitRuntimeContext['toolkitCoordinator'] | null;
	} = $props();

	let contextHostElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const effectiveToolkitCoordinator = $derived(
		explicitToolkitCoordinator ?? runtimeContext?.toolkitCoordinator
	);

	// ============================================================================
	// Derived State
	// ============================================================================

	let availableTypes = $derived(
		typeof availableTypesInput === 'string'
			? (availableTypesInput.split(',').map((t) => t.trim()) as CalculatorType[])
			: availableTypesInput
	);

	// ============================================================================
	// Component State
	// ============================================================================

	let calculatorContainerEl = $state<HTMLDivElement | undefined>();
	let calculatorInstance = $state<Calculator | null>(null);
	let currentCalculatorType = $state<CalculatorType>('basic');
	let isInitializing = $state(false);
	let isSwitching = $state(false);
	let initializationFailed = $state(false);
	let lastInitializationError = $state<string | null>(null);
	let hasMountedSurface = $state(false);
	const CALCULATOR_MOUNT_SELECTOR =
		'.dcg-container,.dcg-calculator-api-container,iframe,canvas';

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolRuntimeContext(
			contextHostElement,
			(value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		);
	});

	// ============================================================================
	// Helper Functions
	// ============================================================================

	function getConfiguredProviderId(): 'calculator-desmos' {
		return 'calculator-desmos';
	}

	async function getProvider(type: CalculatorType) {
		console.log('[ToolCalculator] getProvider called', {
			type,
			hasToolkitCoordinator: !!effectiveToolkitCoordinator,
			hasRegistry: !!effectiveToolkitCoordinator?.toolProviderRegistry
		});

		if (!effectiveToolkitCoordinator?.toolProviderRegistry) {
			console.warn('[ToolCalculator] No toolkitCoordinator or registry available');
			return null;
		}

		try {
			const providerId = getConfiguredProviderId();
			console.log(`[ToolCalculator] Requesting ${providerId} provider from registry`);
			const provider = await effectiveToolkitCoordinator.toolProviderRegistry.getProvider(providerId);
			console.log('[ToolCalculator] Got provider from registry:', provider);
			return provider;
		} catch (error) {
			console.error('[ToolCalculator] Failed to get provider:', error);
			return null;
		}
	}

	function hasCalculatorMount(container: HTMLDivElement | null | undefined): boolean {
		if (!container) return false;
		return (
			container.childElementCount > 0 ||
			Boolean(container.querySelector(CALCULATOR_MOUNT_SELECTOR))
		);
	}

	function scheduleResizeNudges(instance: Calculator | null): void {
		if (!instance) return;
		const nudges = [60, 250, 1000, 2500];
		for (const delay of nudges) {
			setTimeout(() => {
				try {
					instance.resize?.();
				} catch {
					// Ignore if instance was destroyed in the meantime.
				}
			}, delay);
		}
	}

	async function ensureCalculatorSurface(
		container: HTMLDivElement | null | undefined,
		instance: Calculator | null,
		timeoutMs = 8000,
	): Promise<boolean> {
		if (!container) return false;
		const mounted = await waitForCalculatorMount(container, timeoutMs);
		if (!mounted) return false;
		hasMountedSurface = true;
		try {
			instance?.resize?.();
		} catch {
			// Ignore resize errors here; consumer lifecycle guards handle teardown.
		}
		return true;
	}

	async function waitForCalculatorMount(
		container: HTMLDivElement | null | undefined,
		timeoutMs = 3000,
	): Promise<boolean> {
		if (!container) return false;
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			if (!container.isConnected) return false;
			if (hasCalculatorMount(container)) return true;
			await new Promise<void>((resolve) => setTimeout(resolve, 100));
		}
		return hasCalculatorMount(container);
	}

	/**
	 * Move keyboard focus to the calculator's input/expression field after
	 * Desmos has rendered its DOM. Skipped if focus has already landed inside
	 * the calculator container (user-initiated focus wins over auto-focus).
	 *
	 * Addresses PIE-95: on open (keyboard or mouse), the input field should
	 * receive focus so the user can begin a calculation immediately.
	 */
	function focusCalculatorInput(): void {
		requestAnimationFrame(() => {
			try {
				if (!visible) return;
				const instance = calculatorInstance;
				const container = calculatorContainerEl;
				if (!instance || !container || !container.isConnected) return;
				const active = document.activeElement;
				if (active instanceof Node && container.contains(active)) {
					// Focus already inside the calculator; don't disrupt the user.
					return;
				}
				instance.focus?.();
			} catch {
				// best-effort; focus is non-critical for functionality
			}
		});
	}

	function waitForAnimationFrames(count: number, signal?: AbortSignal): Promise<void> {
		return new Promise<void>((resolve) => {
			let remaining = count;
			function next() {
				if (signal?.aborted || remaining <= 0) {
					resolve();
					return;
				}
				remaining--;
				requestAnimationFrame(next);
			}
			next();
		});
	}

	// ============================================================================
	// Configuration Management
	// ============================================================================

	function getInitialConfig(type: CalculatorType): CalculatorProviderConfig {
		// Desmos config
		const isGraphing = type === 'graphing';
		return {
			theme: 'light',
			restrictedMode: false,
			desmos: {
				degreeMode: true,
				settingsMenu: isGraphing,
				qwertyKeyboard: false,
				notes: isGraphing,
				folders: isGraphing,
				sliders: isGraphing,
				tables: isGraphing
			}
		};
	}

	let calculatorConfig = $state<CalculatorProviderConfig>(
		getInitialConfig('basic')
	);

	// ============================================================================
	// Calculator Lifecycle
	// ============================================================================

	async function initCalculator() {
		console.log('[ToolCalculator] initCalculator called', {
			isInitializing,
			isSwitching,
			hasCalculatorInstance: !!calculatorInstance,
			hasContainerEl: !!calculatorContainerEl,
			initializationFailed,
			hasToolkitCoordinator: !!effectiveToolkitCoordinator,
			hasRegistry: !!effectiveToolkitCoordinator?.toolProviderRegistry
		});

		if (isInitializing || isSwitching || calculatorInstance || !calculatorContainerEl || initializationFailed) {
			console.log('[ToolCalculator] Early return from initCalculator');
			return;
		}

		isInitializing = true;

		try {
			if (!availableTypes.includes(currentCalculatorType)) {
				console.log('[ToolCalculator] Calculator type not available, using fallback', {
					requested: currentCalculatorType,
					availableTypes,
					fallback: availableTypes[0] || 'basic'
				});
				currentCalculatorType = availableTypes[0] || 'basic';
			}

			console.log('[ToolCalculator] Getting provider for type:', currentCalculatorType);
			// Get tool provider from toolkit coordinator registry
			const toolProvider = await getProvider(currentCalculatorType);
			console.log('[ToolCalculator] Got tool provider:', toolProvider);

			if (!toolProvider) {
				throw new Error('Desmos calculator tool provider not available');
			}

			console.log('[ToolCalculator] Creating calculator provider instance');
			// Get actual calculator provider from tool provider
			const calculatorProvider = await toolProvider.createInstance();
			console.log('[ToolCalculator] Got calculator provider:', calculatorProvider);

			if (!calculatorContainerEl || calculatorInstance || isSwitching) {
				console.log('[ToolCalculator] Aborting due to state change');
				return;
			}

			console.log('[ToolCalculator] Creating calculator with config:', {
				type: currentCalculatorType,
				hasContainer: !!calculatorContainerEl,
				config: calculatorConfig
			});

			const mountContainer = calculatorContainerEl;
			if (!mountContainer || !mountContainer.isConnected) {
				console.warn('[ToolCalculator] Calculator container unavailable before mount');
				return;
			}

			if (!mountContainer.isConnected) {
				console.warn('[ToolCalculator] Calculator container disconnected before init');
				return;
			}

			calculatorInstance = await calculatorProvider.createCalculator(
				currentCalculatorType,
				mountContainer,
				calculatorConfig
			);

			// Force a post-mount layout pass so Desmos paints reliably.
			await waitForAnimationFrames(2);
			calculatorInstance?.resize?.();
			scheduleResizeNudges(calculatorInstance);
			hasMountedSurface = false;

			// Some environments paint calculator DOM late even after successful creation.
			// Keep the same instance alive and monitor for mount rather than tearing down/recreating.
			const mounted = await ensureCalculatorSurface(mountContainer, calculatorInstance, 4000);
			if (!mounted) {
				console.warn('[ToolCalculator] Calculator mount pending after init; keeping instance and monitoring');
				void ensureCalculatorSurface(mountContainer, calculatorInstance, 12000);
			}

			console.log('[ToolCalculator] Calculator instance created:', calculatorInstance);

			initializationFailed = false;
			lastInitializationError = null;
			hasMountedSurface = hasCalculatorMount(mountContainer);
			console.log(`[ToolCalculator] ${currentCalculatorType} calculator initialized successfully`);
			if (hasMountedSurface) {
				focusCalculatorInput();
			}
		} catch (error) {
			initializationFailed = true;
			lastInitializationError = error instanceof Error ? error.message : String(error);
			console.error('[ToolCalculator] Failed to initialize calculator:', error);
			calculatorInstance = null;
			hasMountedSurface = false;
		} finally {
			isInitializing = false;
		}
	}

	// ============================================================================
	// Event Handlers
	// ============================================================================

	// ============================================================================
	// Effects & Lifecycle
	// ============================================================================

	$effect(() => {
		if (!calculatorType || !availableTypes.includes(calculatorType)) return;
		currentCalculatorType = calculatorType;
	});

	onMount(() => {
		if (visible) {
			initCalculator();
		}

		return () => {
			calculatorInstance?.destroy();
		};
	});

	$effect(() => {
		if (!visible) {
			if (calculatorInstance) {
				try {
					calculatorInstance.destroy();
				} catch (error) {
					console.warn('[ToolCalculator] Error destroying calculator on hide:', error);
				} finally {
					calculatorInstance = null;
				}
			}
			initializationFailed = false;
			lastInitializationError = null;
			hasMountedSurface = false;
			return;
		}

		if (!calculatorInstance && !isInitializing && !isSwitching && !initializationFailed) {
			if (calculatorContainerEl?.isConnected) {
				initCalculator();
			} else {
				queueMicrotask(() => {
					if (visible && calculatorContainerEl?.isConnected && !calculatorInstance &&
					    !isInitializing && !isSwitching && !initializationFailed) {
						initCalculator();
					}
				});
			}
		}
	});

	// PIE-95: when the calculator becomes visible and is already mounted (e.g. a
	// rapid hide/show cycle that skipped teardown), move focus to the input so
	// the user can begin typing immediately. initCalculator() handles the
	// fresh-mount path; this covers the reuse path.
	$effect(() => {
		if (visible && calculatorInstance && hasMountedSurface) {
			focusCalculatorInput();
		}
	});

	let resizeObserver: ResizeObserver | null = null;
	$effect(() => {
		if (visible && calculatorContainerEl && calculatorInstance && calculatorContainerEl.isConnected) {
			if (!resizeObserver) {
				resizeObserver = new ResizeObserver((entries) => {
					for (const entry of entries) {
						if (!entry.target.isConnected) {
							resizeObserver?.unobserve(entry.target);
							return;
						}
					}

					if (calculatorInstance?.resize && calculatorContainerEl?.isConnected && visible) {
						try {
							calculatorInstance.resize();
						} catch (error) {
							console.warn('[ToolCalculator] Error during resize:', error);
							if (resizeObserver && calculatorContainerEl) {
								resizeObserver.unobserve(calculatorContainerEl);
							}
						}
					}
				});
			}
			resizeObserver.observe(calculatorContainerEl);

			return () => {
				if (resizeObserver && calculatorContainerEl) {
					resizeObserver.unobserve(calculatorContainerEl);
				}
				resizeObserver?.disconnect();
				resizeObserver = null;
			};
		} else {
			if (resizeObserver) {
				calculatorContainerEl && resizeObserver.unobserve(calculatorContainerEl);
				resizeObserver.disconnect();
				resizeObserver = null;
			}
		}
		return undefined;
	});

</script>

<div bind:this={contextHostElement} class="pie-tool-calculator__context-host">
{#if visible}
	<div
		class="pie-tool-calculator notranslate"
		role="region"
		data-tool-id={toolId}
		tabindex="-1"
		aria-label="Calculator tool"
		translate="no"
		style="width: 100%; height: 100%;"
	>
		<div bind:this={calculatorContainerEl} class="pie-tool-calculator__container" data-calculator-type={currentCalculatorType}></div>
		{#if isInitializing || isSwitching || (visible && !initializationFailed && !hasMountedSurface)}
			<div class="pie-tool-calculator__loading">Loading calculator...</div>
		{/if}
		{#if initializationFailed}
			<div class="pie-tool-calculator__loading pie-tool-calculator__loading--error">
				Calculator failed to initialize.
				{#if lastInitializationError}
					<div class="pie-tool-calculator__error-details">{lastInitializationError}</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
</div>

<style>
	.pie-tool-calculator__context-host {
		width: 100%;
		height: 100%;
		display: flex;
		min-height: 0;
	}

	.pie-tool-calculator {
		position: relative;
		background: white;
		overflow: hidden;
		min-width: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
	}

	.pie-tool-calculator__container {
		background: white;
		width: 100%;
		height: 100%;
		min-width: 100%;
		min-height: 100%;
		position: relative;
		overflow: hidden;
	}

	.pie-tool-calculator__loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.9);
		color: #334155;
		font-size: 0.9rem;
		z-index: 2;
	}

	.pie-tool-calculator__loading--error {
		color: #b91c1c;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		text-align: center;
	}

	.pie-tool-calculator__error-details {
		font-size: 0.8rem;
		line-height: 1.2;
		color: #7f1d1d;
		max-width: 95%;
		word-break: break-word;
	}

	:global(.pie-tool-calculator__container .dcg-container) {
		width: 100% !important;
		height: 100% !important;
	}

</style>
