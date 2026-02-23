<svelte:options
	customElement={{
		tag: 'pie-section-tools-toolbar',
		shadow: 'none',
		props: {
			enabledTools: { type: 'String', attribute: 'enabled-tools' },
			position: { type: 'String', attribute: 'position' },
			// Services passed as JS properties (not attributes)
			toolCoordinator: { type: 'Object', reflect: false },
			toolProviderRegistry: { type: 'Object', reflect: false }
		}
	}}
/>

<!--
  SectionToolsToolbar - Section-level floating tools toolbar

  Displays tool buttons (calculator, graph, periodic table, etc.) in a toolbar
  that can be positioned at the top, right, bottom, or left of the section layout.
  Tools appear as floating overlays managed by the ToolCoordinator.

  Position Best Practices:
  - bottom (default): Recommended for section-level tools, doesn't obstruct content
  - right: Good for persistent tool palettes, familiar application pattern
  - left: Better for RTL languages
  - top: More discoverable but can obstruct reading content

  Similar to SchoolCity pattern - section-wide tools independent of item navigation.
-->
<script lang="ts">
	import type {
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-tool-graph';
	import '@pie-players/pie-tool-line-reader';
	import '@pie-players/pie-tool-magnifier';
	import '@pie-players/pie-tool-periodic-table';
	import '@pie-players/pie-tool-protractor';
	import '@pie-players/pie-tool-ruler';
	import { onDestroy, onMount } from 'svelte';

	const isBrowser = typeof window !== 'undefined';

	// Props
	let {
		enabledTools = 'graph,periodicTable,protractor,lineReader,magnifier,ruler',
		position = 'bottom',
		toolCoordinator,
		toolProviderRegistry: _toolProviderRegistry
	}: {
		enabledTools?: string;
		position?: 'top' | 'right' | 'bottom' | 'left' | 'none';
		toolCoordinator?: IToolCoordinator;
		toolProviderRegistry?: unknown;
	} = $props();

	// Parse enabled tools from comma-separated string
	let enabledToolsList = $derived(
		enabledTools
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	);
	let hasEnabledTools = $derived(enabledToolsList.length > 0);

	// Tool visibility state (reactive to coordinator changes)
	let showGraph = $state(false);
	let showPeriodicTable = $state(false);
	let showProtractor = $state(false);
	let showLineReader = $state(false);
	let showMagnifier = $state(false);
	let showRuler = $state(false);
	let statusMessage = $state('');

	// Update visibility state from coordinator
	function updateToolVisibility() {
		if (!toolCoordinator) return;
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

		// Get tool name for status message
		const tool = toolButtons.find(t => t.id === toolId);
		if (tool) {
			const isVisible = toolCoordinator.isToolVisible(toolId);
			statusMessage = `${tool.ariaLabel} ${isVisible ? 'opened' : 'closed'}`;
		}
	}

	// Subscribe to tool coordinator changes
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		updateToolVisibility();
	});

	$effect(() => {
		unsubscribe?.();
		unsubscribe = null;
		if (!toolCoordinator) return;

		updateToolVisibility();
		unsubscribe = toolCoordinator.subscribe(() => {
			updateToolVisibility();
		});

		return () => {
			unsubscribe?.();
			unsubscribe = null;
		};
	});

	onDestroy(() => {
		unsubscribe?.();
	});

	// Tool button definitions
	const toolButtons = $derived([
		{
			id: 'graph',
			ariaLabel: 'Graphing tool',
			visible: showGraph,
			enabled: enabledToolsList.includes('graph'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4.75 5a.76.76 0 0 1 .75.75v11c0 .438.313.75.75.75h13a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-13C5 19 4 18 4 16.75v-11A.74.74 0 0 1 4.75 5ZM8 8.25a.74.74 0 0 1 .75-.75h6.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-6.5A.722.722 0 0 1 8 8.25Zm.75 2.25h4.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-4.5a.723.723 0 0 1-.75-.75.74.74 0 0 1 .75-.75Zm0 3h8.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-8.5a.723.723 0 0 1-.75-.75.74.74 0 0 1 .75-.75Z" fill="currentColor"/></svg>'
		},
		{
			id: 'periodicTable',
			ariaLabel: 'Periodic table of elements',
			visible: showPeriodicTable,
			enabled: enabledToolsList.includes('periodicTable'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 21c-.85 0-1.454-.38-1.813-1.137-.358-.759-.27-1.463.263-2.113L9 11V5H8a.968.968 0 0 1-.713-.287A.968.968 0 0 1 7 4c0-.283.096-.52.287-.712A.968.968 0 0 1 8 3h8c.283 0 .52.096.712.288.192.191.288.429.288.712s-.096.52-.288.713A.968.968 0 0 1 16 5h-1v6l5.55 6.75c.533.65.62 1.354.262 2.113C20.454 20.62 19.85 21 19 21H5Zm2-3h10l-3.4-4h-3.2L7 18Zm-2 1h14l-6-7.3V5h-2v6.7L5 19Z" fill="currentColor"/></svg>'
		},
		{
			id: 'protractor',
			ariaLabel: 'Angle measurement tool',
			visible: showProtractor,
			enabled: enabledToolsList.includes('protractor'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m6.75 21-.25-2.2 2.85-7.85a3.95 3.95 0 0 0 1.75.95l-2.75 7.55L6.75 21Zm10.5 0-1.6-1.55-2.75-7.55a3.948 3.948 0 0 0 1.75-.95l2.85 7.85-.25 2.2ZM12 11a2.893 2.893 0 0 1-2.125-.875A2.893 2.893 0 0 1 9 8c0-.65.188-1.23.563-1.737A2.935 2.935 0 0 1 11 5.2V3h2v2.2c.583.2 1.063.554 1.438 1.063C14.812 6.77 15 7.35 15 8c0 .833-.292 1.542-.875 2.125A2.893 2.893 0 0 1 12 11Zm0-2c.283 0 .52-.096.713-.287A.967.967 0 0 0 13 8a.967.967 0 0 0-.287-.713A.968.968 0 0 0 12 7a.968.968 0 0 0-.713.287A.967.967 0 0 0 11 8c0 .283.096.52.287.713.192.191.43.287.713.287Z" fill="currentColor"/></svg>'
		},
		{
			id: 'lineReader',
			ariaLabel: 'Line reading guide',
			visible: showLineReader,
			enabled: enabledToolsList.includes('lineReader'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.85 15c.517 0 .98-.15 1.388-.45.408-.3.695-.692.862-1.175l.375-1.15c.267-.8.2-1.537-.2-2.213C8.875 9.337 8.3 9 7.55 9H4.025l.475 3.925c.083.583.346 1.075.787 1.475.442.4.963.6 1.563.6Zm10.3 0c.6 0 1.12-.2 1.563-.6.441-.4.704-.892.787-1.475L19.975 9h-3.5c-.75 0-1.325.342-1.725 1.025-.4.683-.467 1.425-.2 2.225l.35 1.125c.167.483.454.875.862 1.175.409.3.871.45 1.388.45Zm-10.3 2c-1.1 0-2.063-.363-2.887-1.088a4.198 4.198 0 0 1-1.438-2.737L2 9H1V7h6.55c.733 0 1.404.18 2.013.537A3.906 3.906 0 0 1 11 9h2.025c.35-.617.83-1.104 1.438-1.463A3.892 3.892 0 0 1 16.474 7H23v2h-1l-.525 4.175a4.198 4.198 0 0 1-1.438 2.737A4.238 4.238 0 0 1 17.15 17c-.95 0-1.804-.27-2.562-.813A4.234 4.234 0 0 1 13 14.026l-.375-1.125a21.35 21.35 0 0 1-.1-.363 4.926 4.926 0 0 1-.1-.537h-.85c-.033.2-.067.363-.1.488a21.35 21.35 0 0 1-.1.362L11 14a4.3 4.3 0 0 1-1.588 2.175A4.258 4.258 0 0 1 6.85 17Z" fill="currentColor"/></svg>'
		},
		{
			id: 'magnifier',
			ariaLabel: 'Text magnification tool',
			visible: showMagnifier,
			enabled: enabledToolsList.includes('magnifier'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10.5 5.5c-1.813 0-3.438.969-4.344 2.5a4.937 4.937 0 0 0 0 5 4.974 4.974 0 0 0 4.344 2.5 4.96 4.96 0 0 0 4.313-2.5 4.937 4.937 0 0 0 0-5c-.908-1.531-2.533-2.5-4.313-2.5Zm0 11.5A6.495 6.495 0 0 1 4 10.5C4 6.937 6.906 4 10.5 4c3.563 0 6.5 2.938 6.5 6.5a6.597 6.597 0 0 1-1.406 4.063l4.156 4.187a.685.685 0 0 1 0 1.031.685.685 0 0 1-1.031 0l-4.188-4.156A6.548 6.548 0 0 1 10.5 17Zm-.75-3.75v-2h-2A.723.723 0 0 1 7 10.5a.74.74 0 0 1 .75-.75h2v-2A.74.74 0 0 1 10.5 7a.76.76 0 0 1 .75.75v2h2a.76.76 0 0 1 .696 1.039.741.741 0 0 1-.696.461h-2v2a.74.74 0 0 1-.75.75.723.723 0 0 1-.75-.75Z" fill="currentColor"/></svg>'
		},
		{
			id: 'ruler',
			ariaLabel: 'Measurement ruler',
			visible: showRuler,
			enabled: enabledToolsList.includes('ruler'),
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m8.8 10.95 2.15-2.175-1.4-1.425-1.1 1.1-1.4-1.4 1.075-1.1L7 4.825 4.825 7 8.8 10.95Zm8.2 8.225L19.175 17l-1.125-1.125-1.1 1.075-1.4-1.4 1.075-1.1-1.425-1.4-2.15 2.15L17 19.175ZM7.25 21H3v-4.25l4.375-4.375L2 7l5-5 5.4 5.4 3.775-3.8c.2-.2.425-.35.675-.45a2.068 2.068 0 0 1 1.55 0c.25.1.475.25.675.45L20.4 4.95c.2.2.35.425.45.675.1.25.15.508.15.775a1.975 1.975 0 0 1-.6 1.425l-3.775 3.8L22 17l-5 5-5.375-5.375L7.25 21ZM5 19h1.4l9.8-9.775L14.775 7.8 5 17.6V19Z" fill="currentColor"/></svg>'
		}
	]);

	// Tool element references for service binding
	let graphElement = $state<HTMLElement | null>(null);
	let periodicTableElement = $state<HTMLElement | null>(null);
	let protractorElement = $state<HTMLElement | null>(null);
	let lineReaderElement = $state<HTMLElement | null>(null);
	let magnifierElement = $state<HTMLElement | null>(null);
	let rulerElement = $state<HTMLElement | null>(null);

	// Bind coordinator to tool elements
	$effect(() => {
		if (toolCoordinator) {
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
</script>

{#if isBrowser && position !== 'none' && hasEnabledTools}
	<div
		class="section-tools-toolbar section-tools-toolbar--{position}"
		class:section-tools-toolbar--top={position === 'top'}
		class:section-tools-toolbar--right={position === 'right'}
		class:section-tools-toolbar--bottom={position === 'bottom'}
		class:section-tools-toolbar--left={position === 'left'}
		data-position={position}
		role="toolbar"
		aria-label="Assessment tools"
	>
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
						{@html tool.svg}
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Tool Instances - Rendered outside toolbar for floating overlays -->
	<!-- These are managed by ToolCoordinator with z-index layering -->

	{#if enabledToolsList.includes('graph')}
		<pie-tool-graph
			bind:this={graphElement}
			visible={showGraph}
			tool-id="graph"
			coordinator={toolCoordinator}
		></pie-tool-graph>
	{/if}

	{#if enabledToolsList.includes('periodicTable')}
		<pie-tool-periodic-table
			bind:this={periodicTableElement}
			visible={showPeriodicTable}
			tool-id="periodicTable"
			coordinator={toolCoordinator}
		></pie-tool-periodic-table>
	{/if}

	{#if enabledToolsList.includes('protractor')}
		<pie-tool-protractor
			bind:this={protractorElement}
			visible={showProtractor}
			tool-id="protractor"
			coordinator={toolCoordinator}
		></pie-tool-protractor>
	{/if}

	{#if enabledToolsList.includes('lineReader')}
		<pie-tool-line-reader
			bind:this={lineReaderElement}
			visible={showLineReader}
			tool-id="lineReader"
			coordinator={toolCoordinator}
		></pie-tool-line-reader>
	{/if}

	{#if enabledToolsList.includes('magnifier')}
		<pie-tool-magnifier
			bind:this={magnifierElement}
			visible={showMagnifier}
			tool-id="magnifier"
			coordinator={toolCoordinator}
		></pie-tool-magnifier>
	{/if}

	{#if enabledToolsList.includes('ruler')}
		<pie-tool-ruler
			bind:this={rulerElement}
			visible={showRuler}
			tool-id="ruler"
			coordinator={toolCoordinator}
		></pie-tool-ruler>
	{/if}

	<!-- Live region for status announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{statusMessage}
	</div>
{/if}

<style>
	/* Base toolbar styles */
	.section-tools-toolbar {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: var(--pie-background, #ffffff);
		gap: 1rem;
		flex-shrink: 0;
	}

	/* Position-specific styles */
	.section-tools-toolbar--bottom {
		border-top: 1px solid var(--pie-border, #e0e0e0);
		min-height: 60px;
		flex-direction: row;
	}

	.section-tools-toolbar--top {
		border-bottom: 1px solid var(--pie-border, #e0e0e0);
		min-height: 60px;
		flex-direction: row;
	}

	.section-tools-toolbar--left,
	.section-tools-toolbar--right {
		flex-direction: column;
		min-width: 80px;
		padding: 1rem 0.5rem;
	}

	.section-tools-toolbar--left {
		border-right: 1px solid var(--pie-border, #e0e0e0);
	}

	.section-tools-toolbar--right {
		border-left: 1px solid var(--pie-border, #e0e0e0);
		position: sticky;
		top: 0;
		align-self: flex-start;
		max-height: 100vh;
		overflow-y: auto;
	}

	.tools-buttons {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* Horizontal layout for top/bottom */
	.section-tools-toolbar--top .tools-buttons,
	.section-tools-toolbar--bottom .tools-buttons {
		flex-direction: row;
		flex-wrap: wrap;
	}

	/* Vertical layout for left/right */
	.section-tools-toolbar--left .tools-buttons,
	.section-tools-toolbar--right .tools-buttons {
		flex-direction: column;
		flex-wrap: nowrap;
	}

	.tool-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		background-color: var(--pie-background, #ffffff);
		border: 1px solid var(--pie-border, #ccc);
		border-radius: 0.25rem;
		cursor: pointer;
		color: var(--pie-text, #333);
		transition: all 0.15s ease;
	}

	.tool-button :global(svg) {
		width: 100%;
		height: 100%;
	}

	.tool-button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
		border-color: var(--pie-border-hover, #999);
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

	/* Responsive: Adapt for mobile devices */
	@media (max-width: 768px) {
		/* On mobile, force bottom position for better UX */
		.section-tools-toolbar--left,
		.section-tools-toolbar--right {
			flex-direction: row;
			min-width: unset;
			min-height: 60px;
			padding: 0.75rem 1rem;
			border-left: none;
			border-right: none;
			border-top: 1px solid var(--pie-border, #e0e0e0);
		}

		.section-tools-toolbar--left .tools-buttons,
		.section-tools-toolbar--right .tools-buttons {
			flex-direction: row;
			flex-wrap: wrap;
		}
	}

	/* Hide labels on narrow screens */
	@media (max-width: 640px) {
		.tool-label {
			display: none;
		}

		.tool-button {
			padding: 0.5rem;
			min-width: 2.75rem;  /* 44px - WCAG 2.5.2 Level A minimum */
			min-height: 2.75rem;
		}
	}

	/* Screen reader only content */
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
