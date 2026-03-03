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
	import { createFocusTrap } from '@pie-players/pie-players-shared';
import { onMount } from 'svelte';

	// ============================================================================
	// Constants
	// ============================================================================

	const DESMOS_CALCULATOR_TYPES: CalculatorType[] = ['basic', 'scientific', 'graphing'];
	const GLOBAL_STYLE_ID = 'pie-tool-calculator-global-styles';
	const GLOBAL_CALCULATOR_CSS = `
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
		.pie-tool-calculator__header {
			padding: 12px 16px;
			background: var(--pie-primary-dark, #2c3e50);
			color: var(--pie-white, white);
			display: flex;
			justify-content: space-between;
			align-items: center;
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
		.pie-tool-calculator__loading {
			position: absolute;
			inset: 56px 0 0 0;
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
		.pie-tool-calculator__container .dcg-container {
			width: 100% !important;
			height: 100% !important;
		}
	`;

	const CALCULATOR_SIZES: Partial<Record<CalculatorType, { width: number; height: number }>> = {
		'basic': { width: 700, height: 600 },
		'scientific': { width: 700, height: 600 },
		'graphing': { width: 700, height: 600 }
	};

	const isBrowser = typeof window !== 'undefined';

	// ============================================================================
	// Props
	// ============================================================================

	let {
		visible = false,
		toolId = 'calculator',
		calculatorType = 'basic' as CalculatorType,
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
	let calculatorInstance = $state<Calculator | null>(null);
	let currentCalculatorType = $state<CalculatorType>('basic');
	let isInitializing = $state(false);
	let isSwitching = $state(false);
	let initializationFailed = $state(false);
	let lastInitializationError = $state<string | null>(null);
	let hasMountedSurface = $state(false);
	let cleanupFocusTrap = $state<(() => void) | null>(null);
	let registeredToolId = $state<string | null>(null);
	let registeredCoordinator = $state<IToolCoordinator | null>(null);
	let tiCalculatedWidth = $state<number | undefined>(undefined);
	let tiCalculatedHeight = $state<number | undefined>(undefined);
	const CALCULATOR_MOUNT_SELECTOR =
		'.dcg-container,.dcg-calculator-api-container,iframe,canvas';

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

	function ensureGlobalCalculatorStyles(): void {
		if (!isBrowser) return;
		if (document.getElementById(GLOBAL_STYLE_ID)) return;
		const styleEl = document.createElement('style');
		styleEl.id = GLOBAL_STYLE_ID;
		styleEl.textContent = GLOBAL_CALCULATOR_CSS;
		document.head.appendChild(styleEl);
	}

	function getConfiguredProviderId(): 'calculator-desmos' | 'calculator-ti' | 'calculator-mathjs' {
		const configuredProvider =
			effectiveToolkitCoordinator?.config?.tools?.providers?.calculator?.provider;
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

	async function waitForBodyMountedContainer(
		container: HTMLDivElement | null | undefined,
		timeoutMs = 2000,
	): Promise<boolean> {
		if (!container) return false;
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			if (!container.isConnected) return false;
			if (container.parentElement === document.body) return true;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return container.parentElement === document.body;
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

	let calculatorSize = $derived(CALCULATOR_SIZES[currentCalculatorType] ?? CALCULATOR_SIZES['basic']!);
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
		getInitialConfig('basic')
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
		const fallbackSize = CALCULATOR_SIZES[currentCalculatorType] ?? CALCULATOR_SIZES['scientific']!;
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

			if (isDesmosCalculator(currentCalculatorType)) {
				const readyInBody = await waitForBodyMountedContainer(containerEl);
				if (!readyInBody) {
					console.warn('[ToolCalculator] Calculator panel not body-mounted before init');
					return;
				}
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

			if (false) {
				await waitForAnimationFrames(2);
				measureTICalculatorSize();
			}

			initializationFailed = false;
			lastInitializationError = null;
			hasMountedSurface = hasCalculatorMount(mountContainer);
			console.log(`[ToolCalculator] ${currentCalculatorType} calculator initialized successfully`);
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
		if (!coordinator || !toolId) return;
		if (
			registeredCoordinator &&
			registeredToolId &&
			(registeredCoordinator !== coordinator || registeredToolId !== toolId)
		) {
			registeredCoordinator.unregisterTool(registeredToolId);
			registeredCoordinator = null;
			registeredToolId = null;
		}
		if (!registeredToolId) {
			coordinator.registerTool(toolId, 'Calculator', containerEl, ZIndexLayer.MODAL);
			registeredCoordinator = coordinator;
			registeredToolId = toolId;
		}
	});

	onMount(() => {
		ensureGlobalCalculatorStyles();
		if (visible) {
			initCalculator();
		}

		return () => {
			cleanupFocusTrap?.();
			calculatorInstance?.destroy();
			if (registeredCoordinator && registeredToolId) {
				registeredCoordinator.unregisterTool(registeredToolId);
				registeredCoordinator = null;
				registeredToolId = null;
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
			lastInitializationError = null;
			hasMountedSurface = false;
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
		return undefined;
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

	$effect(() => {
		if (!isBrowser || !visible || !containerEl) return;

		// Desmos does not reliably mount while nested in a toolbar shadow tree.
		// Move only the floating panel to document body; runtime state still flows via context.
		if (containerEl.parentElement !== document.body) {
			document.body.appendChild(containerEl);
		}

		return () => {
			if (containerEl && containerEl.parentElement === document.body) {
				containerEl.remove();
			}
		};
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

	.pie-tool-calculator__loading {
		position: absolute;
		inset: 56px 0 0 0;
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
</style>
