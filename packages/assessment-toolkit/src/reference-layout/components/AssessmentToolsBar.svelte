<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ToolCalculator from '$lib/tags/tool-calculator/tool-calculator.svelte';
	import ToolGraph from '$lib/tags/tool-graph/tool-graph.svelte';
	import ToolLineReader from '$lib/tags/tool-line-reader/tool-line-reader.svelte';
	import ToolMagnifier from '$lib/tags/tool-magnifier/tool-magnifier.svelte';
	import ToolPeriodicTable from '$lib/tags/tool-periodic-table/tool-periodic-table.svelte';
	import ToolProtractor from '$lib/tags/tool-protractor/tool-protractor.svelte';
	import ToolRuler from '$lib/tags/tool-ruler/tool-ruler.svelte';
	import type { AssessmentPlayer } from '../../player/AssessmentPlayer';

	let {
		player,
		enabledTools = [
			'calculator',
			'graph',
			'periodicTable',
			'protractor',
			'lineReader',
			'magnifier',
			'ruler'
		]
	}: {
		player: AssessmentPlayer;
		enabledTools?: string[];
	} = $props();

	const toolCoordinator = $derived(player.getToolCoordinator());

	// Tool visibility state
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

	function toggleTool(toolId: string) {
		toolCoordinator.toggleTool(toolId);
		// Update visibility after toggle
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

	const toolButtons = $derived([
		{ id: 'calculator', label: 'Calculator', icon: '#', visible: showCalculator, enabled: enabledTools.includes('calculator') },
		{ id: 'graph', label: 'Graph', icon: '📈', visible: showGraph, enabled: enabledTools.includes('graph') },
		{ id: 'periodicTable', label: 'Periodic Table', icon: '△', visible: showPeriodicTable, enabled: enabledTools.includes('periodicTable') },
		{ id: 'protractor', label: 'Protractor', icon: '∠', visible: showProtractor, enabled: enabledTools.includes('protractor') },
		{ id: 'lineReader', label: 'Line Reader', icon: '—', visible: showLineReader, enabled: enabledTools.includes('lineReader') },
		{ id: 'magnifier', label: 'Text Magnifier', icon: '🔍', visible: showMagnifier, enabled: enabledTools.includes('magnifier') },
		{ id: 'ruler', label: 'Ruler', icon: '📏', visible: showRuler, enabled: enabledTools.includes('ruler') }
	]);
</script>

<div class="assessment-tools-bar">
	<div class="tools-buttons">
		{#each toolButtons as tool}
			{#if tool.enabled}
				<button
					class="tool-button"
					class:active={tool.visible}
					onclick={() => toggleTool(tool.id)}
					title={tool.label}
					aria-label={tool.label}
					aria-pressed={tool.visible}
				>
					<span class="tool-icon">{tool.icon}</span>
					<span class="tool-label">{tool.label}</span>
				</button>
			{/if}
		{/each}
	</div>
</div>

<!-- Tool Instances - Rendered outside bar for floating modals/overlays -->
{#if enabledTools.includes('calculator')}
	<ToolCalculator visible={showCalculator} toolId="calculator" coordinator={toolCoordinator} desmosProvider={player.getDesmosProvider()} tiProvider={player.getTIProvider()} />
{/if}
{#if enabledTools.includes('graph')}
	<ToolGraph visible={showGraph} toolId="graph" coordinator={toolCoordinator} />
{/if}
{#if enabledTools.includes('periodicTable')}
	<ToolPeriodicTable visible={showPeriodicTable} toolId="periodicTable" coordinator={toolCoordinator} />
{/if}
{#if enabledTools.includes('protractor')}
	<ToolProtractor visible={showProtractor} toolId="protractor" coordinator={toolCoordinator} />
{/if}
{#if enabledTools.includes('lineReader')}
	<ToolLineReader visible={showLineReader} toolId="lineReader" coordinator={toolCoordinator} />
{/if}
{#if enabledTools.includes('magnifier')}
	<ToolMagnifier visible={showMagnifier} toolId="magnifier" coordinator={toolCoordinator} />
{/if}
{#if enabledTools.includes('ruler')}
	<ToolRuler visible={showRuler} toolId="ruler" coordinator={toolCoordinator} />
{/if}

<style>
	.assessment-tools-bar {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border-top: 1px solid var(--pie-border, #e0e0e0);
		min-height: 60px;
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
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #000);
		white-space: nowrap;
	}

	.tool-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.tool-button.active {
		background-color: var(--pie-primary, #3f51b5);
		color: white;
		border-color: var(--pie-primary, #3f51b5);
	}

	.tool-icon {
		font-size: 1rem;
	}

	.tool-label {
		font-size: 0.875rem;
	}
</style>

