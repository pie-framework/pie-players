<svelte:options
	customElement={{
		tag: 'pie-section-tools-toolbar',
		shadow: 'none',
		props: {
			enabledTools: { type: 'String', attribute: 'enabled-tools' },
			// Services passed as JS properties (not attributes)
			toolCoordinator: { type: 'Object', reflect: false },
			toolProviderRegistry: { type: 'Object', reflect: false }
		}
	}}
/>

<!--
  SectionToolsToolbar - Section-level floating tools toolbar

  Displays tool buttons (calculator, graph, periodic table, etc.) in a toolbar
  positioned at the bottom of the section layout. Tools appear as floating
  overlays managed by the ToolCoordinator.

  Similar to SchoolCity pattern - section-wide tools independent of item navigation.
-->
<script lang="ts">
	import type {
		IToolCoordinator,
		ToolProviderRegistry,
	} from '@pie-players/pie-assessment-toolkit';
	import { onDestroy, onMount } from 'svelte';

	// Import tool web components to register them
	import '@pie-players/pie-tool-calculator';
	import '@pie-players/pie-tool-graph';
	import '@pie-players/pie-tool-periodic-table';
	import '@pie-players/pie-tool-protractor';
	import '@pie-players/pie-tool-line-reader';
	import '@pie-players/pie-tool-magnifier';
	import '@pie-players/pie-tool-ruler';

	const isBrowser = typeof window !== 'undefined';

	// Props
	let {
		enabledTools = 'calculator,graph,periodicTable,protractor,lineReader,magnifier,ruler',
		toolCoordinator,
		toolProviderRegistry
	}: {
		enabledTools?: string;
		toolCoordinator?: IToolCoordinator;
		toolProviderRegistry?: ToolProviderRegistry;
	} = $props();

	// Parse enabled tools from comma-separated string
	let enabledToolsList = $derived(
		enabledTools
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	);

	// Tool visibility state (reactive to coordinator changes)
	let showCalculator = $state(false);
	let showGraph = $state(false);
	let showPeriodicTable = $state(false);
	let showProtractor = $state(false);
	let showLineReader = $state(false);
	let showMagnifier = $state(false);
	let showRuler = $state(false);

	// Update visibility state from coordinator
	function updateToolVisibility() {
		if (!toolCoordinator) return;
		showCalculator = toolCoordinator.isToolVisible('calculator');
		showGraph = toolCoordinator.isToolVisible('graph');
		showPeriodicTable = toolCoordinator.isToolVisible('periodicTable');
		showProtractor = toolCoordinator.isToolVisible('protractor');
		showLineReader = toolCoordinator.isToolVisible('lineReader');
		showMagnifier = toolCoordinator.isToolVisible('magnifier');
		showRuler = toolCoordinator.isToolVisible('ruler');
	}

	// Toggle tool visibility
	function toggleTool(toolId: string) {
		if (!toolCoordinator) return;
		toolCoordinator.toggleTool(toolId);
		updateToolVisibility();
	}

	// Subscribe to tool coordinator changes
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		if (toolCoordinator) {
			updateToolVisibility();
			unsubscribe = toolCoordinator.subscribe(() => {
				updateToolVisibility();
			});
		}
	});

	onDestroy(() => {
		unsubscribe?.();
	});

	// Tool button definitions
	const toolButtons = $derived([
		{
			id: 'calculator',
			label: 'Calculator',
			icon: '🔢',
			ariaLabel: 'Scientific calculator',
			visible: showCalculator,
			enabled: enabledToolsList.includes('calculator')
		},
		{
			id: 'graph',
			label: 'Graph',
			icon: '📈',
			ariaLabel: 'Graphing tool',
			visible: showGraph,
			enabled: enabledToolsList.includes('graph')
		},
		{
			id: 'periodicTable',
			label: 'Periodic Table',
			icon: '⚛️',
			ariaLabel: 'Periodic table of elements',
			visible: showPeriodicTable,
			enabled: enabledToolsList.includes('periodicTable')
		},
		{
			id: 'protractor',
			label: 'Protractor',
			icon: '📐',
			ariaLabel: 'Angle measurement tool',
			visible: showProtractor,
			enabled: enabledToolsList.includes('protractor')
		},
		{
			id: 'lineReader',
			label: 'Line Reader',
			icon: '📏',
			ariaLabel: 'Line reading guide',
			visible: showLineReader,
			enabled: enabledToolsList.includes('lineReader')
		},
		{
			id: 'magnifier',
			label: 'Magnifier',
			icon: '🔍',
			ariaLabel: 'Text magnification tool',
			visible: showMagnifier,
			enabled: enabledToolsList.includes('magnifier')
		},
		{
			id: 'ruler',
			label: 'Ruler',
			icon: '📏',
			ariaLabel: 'Measurement ruler',
			visible: showRuler,
			enabled: enabledToolsList.includes('ruler')
		}
	]);

	// Tool element references for service binding
	let calculatorElement = $state<HTMLElement | null>(null);
	let graphElement = $state<HTMLElement | null>(null);
	let periodicTableElement = $state<HTMLElement | null>(null);
	let protractorElement = $state<HTMLElement | null>(null);
	let lineReaderElement = $state<HTMLElement | null>(null);
	let magnifierElement = $state<HTMLElement | null>(null);
	let rulerElement = $state<HTMLElement | null>(null);

	// Bind coordinator to tool elements
	$effect(() => {
		if (toolCoordinator) {
			if (calculatorElement) {
				(calculatorElement as any).coordinator = toolCoordinator;
			}
			if (graphElement) {
				(graphElement as any).coordinator = toolCoordinator;
			}
			if (periodicTableElement) {
				(periodicTableElement as any).coordinator = toolCoordinator;
			}
			if (protractorElement) {
				(protractorElement as any).coordinator = toolCoordinator;
			}
			if (lineReaderElement) {
				(lineReaderElement as any).coordinator = toolCoordinator;
			}
			if (magnifierElement) {
				(magnifierElement as any).coordinator = toolCoordinator;
			}
			if (rulerElement) {
				(rulerElement as any).coordinator = toolCoordinator;
			}
		}
	});

	// Initialize calculator provider if needed
	$effect(() => {
		if (
			isBrowser &&
			toolProviderRegistry &&
			enabledToolsList.includes('calculator')
		) {
			// Pre-initialize calculator provider on toolbar mount
			toolProviderRegistry.getProvider('calculator-desmos').catch((err) => {
				console.warn(
					'[SectionToolsToolbar] Calculator provider not available:',
					err
				);
			});
		}
	});
</script>

{#if isBrowser}
	<div class="section-tools-toolbar" role="toolbar" aria-label="Assessment tools">
		<div class="tools-buttons">
			{#each toolButtons as tool (tool.id)}
				{#if tool.enabled}
					<button
						type="button"
						class="tool-button"
						class:active={tool.visible}
						onclick={() => toggleTool(tool.id)}
						title={tool.ariaLabel}
						aria-label={tool.ariaLabel}
						aria-pressed={tool.visible}
					>
						<span class="tool-icon" aria-hidden="true">{tool.icon}</span>
						<span class="tool-label">{tool.label}</span>
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Tool Instances - Rendered outside toolbar for floating overlays -->
	<!-- These are managed by ToolCoordinator with z-index layering -->

	{#if enabledToolsList.includes('calculator')}
		<pie-tool-calculator
			bind:this={calculatorElement}
			visible={showCalculator}
			tool-id="calculator"
		></pie-tool-calculator>
	{/if}

	{#if enabledToolsList.includes('graph')}
		<pie-tool-graph
			bind:this={graphElement}
			visible={showGraph}
			tool-id="graph"
		></pie-tool-graph>
	{/if}

	{#if enabledToolsList.includes('periodicTable')}
		<pie-tool-periodic-table
			bind:this={periodicTableElement}
			visible={showPeriodicTable}
			tool-id="periodicTable"
		></pie-tool-periodic-table>
	{/if}

	{#if enabledToolsList.includes('protractor')}
		<pie-tool-protractor
			bind:this={protractorElement}
			visible={showProtractor}
			tool-id="protractor"
		></pie-tool-protractor>
	{/if}

	{#if enabledToolsList.includes('lineReader')}
		<pie-tool-line-reader
			bind:this={lineReaderElement}
			visible={showLineReader}
			tool-id="lineReader"
		></pie-tool-line-reader>
	{/if}

	{#if enabledToolsList.includes('magnifier')}
		<pie-tool-magnifier
			bind:this={magnifierElement}
			visible={showMagnifier}
			tool-id="magnifier"
		></pie-tool-magnifier>
	{/if}

	{#if enabledToolsList.includes('ruler')}
		<pie-tool-ruler
			bind:this={rulerElement}
			visible={showRuler}
			tool-id="ruler"
		></pie-tool-ruler>
	{/if}
{/if}

<style>
	.section-tools-toolbar {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border-top: 1px solid var(--pie-border, #e0e0e0);
		min-height: 60px;
		gap: 1rem;
	}

	.tools-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.tool-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border: 1px solid var(--pie-border, #d0d0d0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #333);
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.tool-button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.tool-button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.tool-button.active {
		background-color: var(--pie-primary, #1976d2);
		color: white;
		border-color: var(--pie-primary, #1976d2);
	}

	.tool-button.active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.tool-button:focus-visible {
		outline: 2px solid var(--pie-primary, #1976d2);
		outline-offset: 2px;
	}

	.tool-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tool-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.tool-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	/* Responsive: Hide labels on narrow screens */
	@media (max-width: 640px) {
		.tool-label {
			display: none;
		}

		.tool-button {
			padding: 0.5rem;
		}
	}
</style>
