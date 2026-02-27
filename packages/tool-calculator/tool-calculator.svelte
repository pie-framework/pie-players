<svelte:options
	customElement={{
		tag: 'pie-tool-calculator',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'Array', attribute: 'available-types' }
		}
	}}
/>

<!--
	Calculator Tool Component

	Provides multi-provider calculator support with Math.js and Desmos providers.

	Calculator Types:
	- basic, scientific, graphing: Desmos calculators (requires API key for production)
	- ti-84, ti-108, ti-34-mv: TI emulators (stub implementation)

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
	- docs/ARCHITECTURE.md (Calculator Provider System section)
-->

<script lang="ts">
	
	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import type { Calculator, CalculatorProviderConfig, CalculatorType } from '@pie-players/pie-assessment-toolkit/tools/client';
	import { DesmosCalculatorProvider, TICalculatorProvider } from '@pie-players/pie-assessment-toolkit/tools/client';
	import { createFocusTrap } from '@pie-players/pie-players-shared';
	import ToolSettingsButton from '@pie-players/pie-players-shared/components/ToolSettingsButton.svelte';
import { onMount } from 'svelte';

	// ============================================================================
	// Constants
	// ============================================================================

	const DESMOS_CALCULATOR_TYPES: CalculatorType[] = ['basic', 'scientific', 'graphing'];

	const CALCULATOR_SIZES: Record<CalculatorType, { width: number; height: number }> = {
		'basic': { width: 700, height: 600 },
		'scientific': { width: 700, height: 600 },
		'graphing': { width: 700, height: 600 }
	};

	const CALCULATOR_TYPE_NAMES: Record<CalculatorType, string> = {
		'basic': 'Basic',
		'scientific': 'Scientific',
		'graphing': 'Graphing'
	};

	const isBrowser = typeof window !== 'undefined';

	// ============================================================================
	// Props
	// ============================================================================

	let {
		visible = false,
		toolId = 'calculator',
		calculatorType = 'scientific' as CalculatorType,
		availableTypes: availableTypesInput = ['basic', 'scientific', 'graphing'] as CalculatorType[]
	}: {
		visible?: boolean;
		toolId?: string;
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[] | string;
	} = $props();

	let contextHostElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const effectiveToolkitCoordinator = $derived(runtimeContext?.toolkitCoordinator);
	const coordinator = $derived(
		effectiveToolkitCoordinator?.toolCoordinator as IToolCoordinator | undefined,
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

	let containerEl = $state<HTMLDivElement | undefined>();
	let calculatorContainerEl = $state<HTMLDivElement | undefined>();
	let settingsButtonEl = $state<HTMLButtonElement | undefined>();
	let calculatorInstance = $state<Calculator | null>(null);
	let currentCalculatorType = $state<CalculatorType>('scientific');
	let settingsOpen = $state(false);
	let switchAbortController = $state<AbortController | null>(null);
	let isInitializing = $state(false);
	let isSwitching = $state(false);
	let initializationFailed = $state(false);
	let cleanupFocusTrap = $state<(() => void) | null>(null);
	let registered = $state(false);
	let tiCalculatedWidth = $state<number | undefined>(undefined);
	let tiCalculatedHeight = $state<number | undefined>(undefined);

	// Drag state
	let isDragging = $state(false);
	let dragOffsetX = $state(0);
	let dragOffsetY = $state(0);
	let positionX = $state<number | null>(null);
	let positionY = $state<number | null>(null);

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

	function isDesmosCalculator(type: CalculatorType): boolean {
		return DESMOS_CALCULATOR_TYPES.includes(type);
	}

	function getConfiguredProviderId(): 'calculator-desmos' | 'calculator-ti' | 'calculator-mathjs' {
		const configuredProvider = effectiveToolkitCoordinator?.config?.tools?.floatingTools?.calculator?.provider;
		if (configuredProvider === 'ti') {
			return 'calculator-ti';
		}
		if (configuredProvider === 'mathjs') {
			return 'calculator-mathjs';
		}
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

	function getCalculatorTypeName(type: CalculatorType): string {
		return CALCULATOR_TYPE_NAMES[type] || type;
	}

	function scheduleTask(signal?: AbortSignal): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new DOMException('Operation aborted', 'AbortError'));
				return;
			}
			if ('scheduler' in globalThis && 'postTask' in (globalThis as any).scheduler) {
				(globalThis as any).scheduler.postTask(() => resolve(), { priority: 'user-blocking', signal });
			} else {
				requestAnimationFrame(() => resolve());
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
	// Derived Values
	// ============================================================================

	let calculatorSize = $derived(CALCULATOR_SIZES[currentCalculatorType]);
	let width = $derived(false ? tiCalculatedWidth : calculatorSize.width);
	let height = $derived(false ? tiCalculatedHeight : calculatorSize.height);

	let positionStyle = $derived.by(() => {
		if (!isBrowser) {
			return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
		}

		// Use dragged position if set (absolute positioning, no centering)
		if (positionX !== null && positionY !== null) {
			return { left: `${positionX}px`, top: `${positionY}px`, transform: '' };
		}

		if (false && window.innerHeight < 700) {
			return { left: '50%', top: '1%', transform: 'translateX(-50%) translateY(0)' };
		}

		// Default: centered
		return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
	});

	// ============================================================================
	// Configuration Management
	// ============================================================================

	function getInitialConfig(type: CalculatorType): CalculatorProviderConfig {
		if (false) {
			const placeholderElementId = `ti-calculator-${type.replace(/-/g, '')}-placeholder`;
			const baseConfig: CalculatorProviderConfig = {
				theme: 'light',
				restrictedMode: false,
				ti: {
					elementId: placeholderElementId,
					KeyHistBufferLength: '10'
				}
			};

			// Type-specific TI config
			if (type === 'ti-84') {
				baseConfig.ti = {
					...baseConfig.ti,
					DisplayMode: 'CLASSIC',
					AngleMode: 'RAD',
					setTabOrder: 0,
					setScreenReaderAria: true,
					setAccessibleDisplay: true,
					setupAPIs: { resetEmulator: true }
				};
			} else if (type === 'ti-34-mv') {
				baseConfig.ti = {
					...baseConfig.ti,
					DisplayMode: 'CLASSIC',
					AngleMode: 'DEG'
				};
			}

			return baseConfig;
		}

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
		getInitialConfig('scientific')
	);

	// ============================================================================
	// Calculator Lifecycle
	// ============================================================================

	function measureTICalculatorSize(): void {
		if (!calculatorContainerEl || !false) return;

		// Try calculator div
		const calculatorDiv = calculatorContainerEl.querySelector('[id^="ti-calculator-"]') as HTMLElement;
		if (calculatorDiv) {
			const computedStyle = window.getComputedStyle(calculatorDiv);
			const measuredWidth = calculatorDiv.offsetWidth || parseFloat(computedStyle.width) || calculatorDiv.style.width;
			const measuredHeight = calculatorDiv.offsetHeight || parseFloat(computedStyle.height) || calculatorDiv.style.height;

			if (measuredWidth && measuredHeight) {
				const widthNum = typeof measuredWidth === 'string' ? parseFloat(measuredWidth) : measuredWidth;
				const heightNum = typeof measuredHeight === 'string' ? parseFloat(measuredHeight) : measuredHeight;

				if (widthNum > 0 && heightNum > 0) {
					tiCalculatedWidth = widthNum;
					tiCalculatedHeight = heightNum;
					console.log(`[ToolCalculator] Measured TI calculator size: ${widthNum}x${heightNum}`);
					return;
				}
			}
		}

		// Try SVG fallback
		const svg = calculatorContainerEl.querySelector('svg[class*="TI"]') as SVGSVGElement;
		if (svg) {
			const svgWidth = svg.width?.baseVal?.value || parseFloat(svg.getAttribute('width') || '0');
			const svgHeight = svg.height?.baseVal?.value || parseFloat(svg.getAttribute('height') || '0');

			if (svgWidth > 0 && svgHeight > 0) {
				tiCalculatedWidth = svgWidth;
				tiCalculatedHeight = svgHeight;
				console.log(`[ToolCalculator] Measured TI calculator size from SVG: ${svgWidth}x${svgHeight}`);
				return;
			}
		}

		// Use fallback size
		const fallbackSize = CALCULATOR_SIZES[currentCalculatorType];
		tiCalculatedWidth = fallbackSize.width;
		tiCalculatedHeight = fallbackSize.height;
		console.log(`[ToolCalculator] Using fallback TI calculator size: ${fallbackSize.width}x${fallbackSize.height}`);
	}

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
					fallback: availableTypes[0] || 'scientific'
				});
				currentCalculatorType = availableTypes[0] || 'scientific';
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

			calculatorInstance = await calculatorProvider.createCalculator(
				currentCalculatorType,
				calculatorContainerEl,
				calculatorConfig
			);

			console.log('[ToolCalculator] Calculator instance created:', calculatorInstance);

			if (false) {
				await waitForAnimationFrames(2);
				measureTICalculatorSize();
			}

			initializationFailed = false;
			console.log(`[ToolCalculator] ${currentCalculatorType} calculator initialized successfully`);
		} catch (error) {
			initializationFailed = true;
			console.error('[ToolCalculator] Failed to initialize calculator:', error);
			calculatorInstance = null;
		} finally {
			isInitializing = false;
		}
	}

	async function refreshContainer(signal?: AbortSignal) {
		if (!calculatorContainerEl) return;

		const needsFreshContainer = isDesmosCalculator(currentCalculatorType);

		if (needsFreshContainer && calculatorContainerEl.parentElement) {
			const parent = calculatorContainerEl.parentElement;
			const oldContainer = calculatorContainerEl;
			const newContainer = document.createElement('div');
			newContainer.className = oldContainer.className || 'pie-tool-calculator__container';
			parent.replaceChild(newContainer, oldContainer);
			calculatorContainerEl = newContainer;

			await scheduleTask(signal);

			if (calculatorContainerEl !== newContainer || !calculatorContainerEl.isConnected) {
				console.warn('[ToolCalculator] Container binding mismatch, using new container');
				calculatorContainerEl = newContainer;
			}
		} else {
			calculatorContainerEl.removeAttribute('data-desmos-id');
		}

		if (!calculatorContainerEl?.isConnected) {
			throw new Error('Container was removed before initialization');
		}
	}

	async function handleCalculatorTypeChange(newType: CalculatorType) {
		if (newType === currentCalculatorType || !availableTypes.includes(newType)) return;

		switchAbortController?.abort();
		switchAbortController = new AbortController();
		const signal = switchAbortController.signal;

		closeSettings();
		isSwitching = true;

		try {
			// Cleanup existing calculator
			if (calculatorInstance) {
				try {
					calculatorInstance.destroy();
					await waitForAnimationFrames(4, signal);
				} catch (error) {
					console.warn('[ToolCalculator] Error destroying calculator:', error);
				} finally {
					calculatorInstance = null;
				}
			}

			if (signal.aborted) return;

			// Refresh container if needed
			await refreshContainer(signal);
			if (signal.aborted) return;

			// Update config
			currentCalculatorType = newType;
			const newConfig = structuredClone(getInitialConfig(newType));
			if (calculatorConfig.restrictedMode) {
				newConfig.restrictedMode = true;
			}
			calculatorConfig = newConfig;

			if (signal.aborted) return;

			// Create new calculator
			const toolProvider = await getProvider(newType);
			if (!toolProvider) {
				throw new Error('Calculator tool provider not available');
			}

			// Get actual calculator provider from tool provider
			const calculatorProvider = await toolProvider.createInstance();

			if (signal.aborted) return;

			if (!calculatorContainerEl?.isConnected) {
				throw new Error('Container removed during provider initialization');
			}

			calculatorInstance = await calculatorProvider.createCalculator(
				newType,
				calculatorContainerEl,
				calculatorConfig
			);

			// Measure TI calculator size
			if (false) {
				await waitForAnimationFrames(2);
				measureTICalculatorSize();
			} else {
				tiCalculatedWidth = undefined;
				tiCalculatedHeight = undefined;
			}

			if (signal.aborted) {
				calculatorInstance?.destroy();
				calculatorInstance = null;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				console.log('[ToolCalculator] Switch cancelled');
				return;
			}
			console.error('[ToolCalculator] Failed to create calculator:', error);
			calculatorInstance = null;
		} finally {
			isSwitching = false;
		}
	}

	async function handleConfigChange() {
		if (!calculatorInstance || !calculatorContainerEl) return;

		switchAbortController?.abort();
		const abortController = new AbortController();
		switchAbortController = abortController;
		const signal = abortController.signal;

		try {
			calculatorInstance.destroy();
			calculatorInstance = null;

			if (signal.aborted) return;

			await refreshContainer(signal);
			if (signal.aborted) return;

			await initCalculator();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				console.log('[ToolCalculator] Config update cancelled');
				return;
			}
			console.error('[ToolCalculator] Failed to update config:', error);
			calculatorInstance = null;
		}
	}

	// ============================================================================
	// Event Handlers
	// ============================================================================

	function handleClose() {
		if (calculatorInstance) {
			try {
				calculatorInstance.destroy();
			} catch (error) {
				console.warn('[ToolCalculator] Error destroying calculator on close:', error);
			}
			calculatorInstance = null;
		}

		calculatorContainerEl?.replaceChildren();
		coordinator?.hideTool(toolId);
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('.pie-tool-calculator__header') && containerEl) {
			coordinator?.bringToFront(containerEl);

			// Start dragging if clicking on header (but not buttons)
			if (!target.closest('button') && !target.closest('.pie-tool-calculator__header-buttons')) {
				e.preventDefault();
				isDragging = true;

				// Calculate offset from pointer to element's current position
				const rect = containerEl.getBoundingClientRect();
				dragOffsetX = e.clientX - rect.left;
				dragOffsetY = e.clientY - rect.top;

				containerEl.setPointerCapture(e.pointerId);
			}
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging || !containerEl) return;

		e.preventDefault();

		// Update position - using left/top with transform cleared for smooth GPU-accelerated movement
		const x = e.clientX - dragOffsetX;
		const y = e.clientY - dragOffsetY;

		// Set position directly on element for instant feedback
		containerEl.style.left = `${x}px`;
		containerEl.style.top = `${y}px`;
		containerEl.style.transform = '';
	}

	function handlePointerUp(e: PointerEvent) {
		if (isDragging && containerEl) {
			isDragging = false;
			containerEl.releasePointerCapture(e.pointerId);

			// Commit the position to state
			const left = parseFloat(containerEl.style.left);
			const top = parseFloat(containerEl.style.top);

			if (!isNaN(left) && !isNaN(top)) {
				positionX = left;
				positionY = top;
			}

			// Clear inline styles - will use positionStyle derived
			containerEl.style.left = '';
			containerEl.style.top = '';
			containerEl.style.transform = '';
		}
	}

	// ============================================================================
	// Effects & Lifecycle
	// ============================================================================

	$effect(() => {
		if (!calculatorType || !availableTypes.includes(calculatorType)) return;
		currentCalculatorType = calculatorType;
	});

	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Calculator', containerEl, ZIndexLayer.MODAL);
			registered = true;
		}
	});

	onMount(() => {
		if (visible) {
			initCalculator();
		}

		return () => {
			cleanupFocusTrap?.();
			calculatorInstance?.destroy();
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
			if (!containerEl.style.zIndex) {
				coordinator.bringToFront(containerEl);
			}
		}
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
			tiCalculatedWidth = undefined;
			tiCalculatedHeight = undefined;
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

					if (false) {
						measureTICalculatorSize();
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
	});

	$effect(() => {
		if (containerEl && visible) {
			if (!cleanupFocusTrap) {
				cleanupFocusTrap = createFocusTrap(containerEl);
			}
		} else if (!visible && cleanupFocusTrap) {
			cleanupFocusTrap();
			cleanupFocusTrap = null;
		}
	});
</script>

<div bind:this={contextHostElement}>
{#if visible}
	<div
		bind:this={containerEl}
		class="pie-tool-calculator notranslate"
		class:pie-tool-calculator--dragging={isDragging}
		role="dialog"
		tabindex="-1"
		aria-label="Calculator tool - Drag header to move, Escape to close"
		translate="no"
		style="left: {positionStyle.left}; top: {positionStyle.top}; {width !== undefined ? `width: ${width}px;` : ''} {height !== undefined ? `height: ${height}px;` : ''} transform: {positionStyle.transform};"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onkeydown={handleKeyDown}
	>
		<div class="pie-tool-calculator__header">
			<span class="pie-tool-calculator__title">Calculator</span>
			<div class="pie-tool-calculator__header-buttons">
				<ToolSettingsButton
					bind:buttonEl={settingsButtonEl}
					onClick={toggleSettings}
					ariaLabel="Calculator settings"
					active={settingsOpen}
				/>
				<button class="pie-tool-calculator__close-btn" onclick={handleClose} aria-label="Close calculator">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>

		<div bind:this={calculatorContainerEl} class="pie-tool-calculator__container" data-calculator-type={currentCalculatorType}></div>

		{#if settingsOpen}
			<div class="pie-tool-calculator__settings-overlay">
				<div class="pie-tool-calculator__settings-panel">
					<div class="pie-tool-calculator__settings-header">
						<h2 class="pie-tool-calculator__settings-title">Calculator Settings</h2>
						<button type="button" class="pie-tool-calculator__settings-close-btn" onclick={closeSettings} aria-label="Close settings">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>
					<div class="pie-tool-calculator__settings-content">
		<fieldset class="pie-tool-calculator__setting-group">
			<legend>Calculator Type</legend>
			{#each availableTypes as type (type)}
				<label>
					<input
						type="radio"
						name="calculator-type"
						value={type}
						checked={currentCalculatorType === type}
						onchange={() => handleCalculatorTypeChange(type)}
					/>
					<span>{getCalculatorTypeName(type)}</span>
				</label>
			{/each}
		</fieldset>

		<fieldset class="pie-tool-calculator__setting-group">
			<legend>Configuration</legend>
			<p style="font-size: 0.75rem; color: #666; margin: 0 0 8px 0;">
				These settings are useful for testing. They may be hidden or restricted for students in production.
			</p>

			<label>
				<input
					type="checkbox"
					checked={calculatorConfig.restrictedMode ?? false}
					onchange={(e) => {
						calculatorConfig.restrictedMode = (e.target as HTMLInputElement).checked;
						handleConfigChange();
					}}
				/>
				<span>Restricted Mode (Test Mode)</span>
			</label>

			<label>
				<span class="pie-tool-calculator__setting-label">
					Angle Mode
					<span class="pie-tool-calculator__setting-value">
						{calculatorConfig.desmos?.degreeMode === false ? 'Radians' : 'Degrees'}
					</span>
				</span>
				<select
					value={calculatorConfig.desmos?.degreeMode === false ? 'radian' : 'degree'}
					onchange={(e) => {
						calculatorConfig.desmos = {
							...calculatorConfig.desmos,
							degreeMode: (e.target as HTMLSelectElement).value === 'degree',
						};
						handleConfigChange();
					}}
				>
					<option value="degree">Degrees</option>
					<option value="radian">Radians</option>
				</select>
			</label>

			<label>
				<input
					type="checkbox"
					checked={calculatorConfig.desmos?.qwertyKeyboard ?? false}
					onchange={(e) => {
						calculatorConfig.desmos = {
							...calculatorConfig.desmos,
							qwertyKeyboard: (e.target as HTMLInputElement).checked,
						};
						handleConfigChange();
					}}
				/>
				<span>QWERTY Keyboard</span>
			</label>

			{#if false}
				{#if currentCalculatorType === 'ti-84' || currentCalculatorType === 'ti-34-mv'}
					<label>
						<span class="pie-tool-calculator__setting-label">
							Angle Mode
							<span class="pie-tool-calculator__setting-value">
								{calculatorConfig.ti?.AngleMode === 'DEG' ? 'Degrees' : 'Radians'}
							</span>
						</span>
						<select
							value={calculatorConfig.ti?.AngleMode || (currentCalculatorType === 'ti-84' ? 'RAD' : 'DEG')}
							onchange={(e) => {
								calculatorConfig.ti = {
									...calculatorConfig.ti,
									AngleMode: (e.target as HTMLSelectElement).value === 'degree' ? 'DEG' : 'RAD',
								};
								handleConfigChange();
							}}
						>
							<option value="degree">Degrees</option>
							<option value="radian">Radians</option>
						</select>
					</label>
				{/if}

				{#if currentCalculatorType === 'ti-84' || currentCalculatorType === 'ti-34-mv'}
					<label>
						<span class="pie-tool-calculator__setting-label">
							Display Mode
							<span class="pie-tool-calculator__setting-value">
								{calculatorConfig.ti?.DisplayMode || 'CLASSIC'}
							</span>
						</span>
						<select
							value={calculatorConfig.ti?.DisplayMode || 'CLASSIC'}
							onchange={(e) => {
								calculatorConfig.ti = {
									...calculatorConfig.ti,
									DisplayMode: (e.target as HTMLSelectElement).value === 'MATHPRINT' ? 'MATHPRINT' : 'CLASSIC',
								};
								handleConfigChange();
							}}
						>
							<option value="CLASSIC">Classic</option>
							<option value="MATHPRINT">MathPrint</option>
						</select>
					</label>
				{/if}

				{#if currentCalculatorType === 'ti-84'}
					<label>
						<input
							type="checkbox"
							checked={calculatorConfig.ti?.setScreenReaderAria ?? true}
							onchange={(e) => {
								calculatorConfig.ti = {
									...calculatorConfig.ti,
									setScreenReaderAria: (e.target as HTMLInputElement).checked,
								};
								handleConfigChange();
							}}
						/>
						<span>Screen Reader Support</span>
					</label>

					<label>
						<input
							type="checkbox"
							checked={calculatorConfig.ti?.setAccessibleDisplay ?? true}
							onchange={(e) => {
								calculatorConfig.ti = {
									...calculatorConfig.ti,
									setAccessibleDisplay: (e.target as HTMLInputElement).checked,
								};
								handleConfigChange();
							}}
						/>
						<span>Accessible Display</span>
					</label>
				{/if}
			{/if}

			{#if currentCalculatorType === 'graphing'}
				<label>
					<input
						type="checkbox"
						checked={calculatorConfig.desmos?.settingsMenu ?? true}
						onchange={(e) => {
							calculatorConfig.desmos = {
								...calculatorConfig.desmos,
								settingsMenu: (e.target as HTMLInputElement).checked,
							};
							handleConfigChange();
						}}
					/>
					<span>Settings Menu</span>
				</label>

				<label>
					<input
						type="checkbox"
						checked={calculatorConfig.desmos?.notes ?? true}
						onchange={(e) => {
							calculatorConfig.desmos = {
								...calculatorConfig.desmos,
								notes: (e.target as HTMLInputElement).checked,
							};
							handleConfigChange();
						}}
					/>
					<span>Notes</span>
				</label>

				<label>
					<input
						type="checkbox"
						checked={calculatorConfig.desmos?.folders ?? true}
						onchange={(e) => {
							calculatorConfig.desmos = {
								...calculatorConfig.desmos,
								folders: (e.target as HTMLInputElement).checked,
							};
							handleConfigChange();
						}}
					/>
					<span>Folders</span>
				</label>

				<label>
					<input
						type="checkbox"
						checked={calculatorConfig.desmos?.sliders ?? true}
						onchange={(e) => {
							calculatorConfig.desmos = {
								...calculatorConfig.desmos,
								sliders: (e.target as HTMLInputElement).checked,
							};
							handleConfigChange();
						}}
					/>
					<span>Sliders</span>
				</label>

				<label>
					<input
						type="checkbox"
						checked={calculatorConfig.desmos?.tables ?? true}
						onchange={(e) => {
							calculatorConfig.desmos = {
								...calculatorConfig.desmos,
								tables: (e.target as HTMLInputElement).checked,
							};
							handleConfigChange();
						}}
					/>
					<span>Tables</span>
				</label>
			{/if}
		</fieldset>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
</div>

<style>
	.pie-tool-calculator {
		position: fixed;
		background: white;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		user-select: none;
		touch-action: none;
		border-radius: 12px;
		overflow: hidden;
		z-index: 2000;
		min-width: 320px;
		display: flex;
		flex-direction: column;
	}

	.pie-tool-calculator.pie-tool-calculator--dragging {
		cursor: move;
		will-change: transform;
	}

	.pie-tool-calculator.pie-tool-calculator--dragging * {
		cursor: move !important;
		pointer-events: none; /* Prevent hover effects during drag */
	}

	.pie-tool-calculator__header {
		padding: 12px 16px;
		background: var(--pie-primary-dark, #2c3e50);
		color: var(--pie-white, white);
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: move;
		user-select: none;
		border-radius: 12px 12px 0 0;
	}

	.pie-tool-calculator__title {
		font-weight: 600;
		font-size: 16px;
		color: var(--pie-white, white);
	}

	.pie-tool-calculator__header-buttons {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.pie-tool-calculator__close-btn {
		background: transparent;
		border: none;
		color: var(--pie-white, white);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.pie-tool-calculator__close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.pie-tool-calculator__close-btn:active {
		background: rgba(255, 255, 255, 0.2);
	}

	.pie-tool-calculator__close-btn:focus-visible {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: 2px;
	}

	.pie-tool-calculator__container {
		background: white;
		width: 100%;
		height: 100%;
		min-width: 320px;
		min-height: 400px;
		position: relative;
		overflow: hidden;
	}

	.pie-tool-calculator__container[data-calculator-type="ti-84"],
	.pie-tool-calculator__container[data-calculator-type="ti-108"],
	.pie-tool-calculator__container[data-calculator-type="ti-34-mv"] {
		width: auto;
		height: auto;
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		overflow: visible;
	}

	:global(.pie-tool-calculator__container .dcg-container) {
		width: 100% !important;
		height: 100% !important;
	}

	:global(.pie-tool-calculator .mathjs-btn) {
		pointer-events: auto;
	}

	/* Settings overlay and panel */
	.pie-tool-calculator__settings-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		pointer-events: auto;
	}

	.pie-tool-calculator__settings-panel {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		width: 90%;
		max-width: 400px;
		max-height: 80%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.pie-tool-calculator__settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #e0e0e0;
		background: #f5f5f5;
	}

	.pie-tool-calculator__settings-title {
		font-weight: 600;
		font-size: 14px;
		margin: 0;
		color: #333;
	}

	.pie-tool-calculator__settings-close-btn {
		background: transparent;
		border: none;
		color: #666;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.pie-tool-calculator__settings-close-btn:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #333;
	}

	.pie-tool-calculator__settings-close-btn:active {
		background: rgba(0, 0, 0, 0.1);
	}

	.pie-tool-calculator__settings-content {
		padding: 16px;
		overflow-y: auto;
		font-size: 14px;
	}

	.pie-tool-calculator__settings-content :global(.pie-tool-calculator__setting-group) {
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.pie-tool-calculator__settings-content :global(.pie-tool-calculator__setting-group:last-child) {
		margin-bottom: 0;
	}

	.pie-tool-calculator__settings-content :global(legend) {
		font-weight: 600;
		font-size: 13px;
		color: #333;
		padding: 0 4px;
	}

	.pie-tool-calculator__settings-content :global(label) {
		display: block;
		margin-bottom: 8px;
		cursor: pointer;
		font-size: 13px;
		color: #666;
	}

	.pie-tool-calculator__settings-content :global(label:last-child) {
		margin-bottom: 0;
	}

	.pie-tool-calculator__settings-content :global(input[type="radio"]),
	.pie-tool-calculator__settings-content :global(input[type="checkbox"]) {
		margin-right: 8px;
		cursor: pointer;
	}

	.pie-tool-calculator__settings-content :global(select) {
		width: 100%;
		padding: 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		margin-top: 4px;
		background: white;
		cursor: pointer;
	}

	.pie-tool-calculator__settings-content :global(.pie-tool-calculator__setting-label) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
		font-weight: 500;
		color: #333;
	}

	.pie-tool-calculator__settings-content :global(.pie-tool-calculator__setting-value) {
		font-weight: normal;
		color: #666;
		font-size: 12px;
	}
</style>
