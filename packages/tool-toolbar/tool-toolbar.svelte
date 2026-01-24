<svelte:options
	customElement={{
		tag: 'pie-tool-toolbar',
		shadow: 'none',
		props: {
			tools: { type: 'String', attribute: 'tools' },
			disabled: { type: 'Boolean', attribute: 'disabled' },
			position: { type: 'String', attribute: 'position' },
			showLabels: { type: 'Boolean', attribute: 'show-labels' },
			organizationId: { type: 'String', attribute: 'organization-id' },
			baseUrl: { type: 'String', attribute: 'base-url' },

			// Toolkit coordinators (passed as JS properties)
			toolCoordinator: { type: 'Object', attribute: 'tool-coordinator' },
			highlightCoordinator: { type: 'Object', attribute: 'highlight-coordinator' },

			// Optional callbacks (passed as JS properties)
			ondictionarylookup: { type: 'Object', attribute: 'ondictionarylookup' },
			ontranslationrequest: { type: 'Object', attribute: 'ontranslationrequest' }
		}
	}}
/>

<!-- ToolToolbar - Self-Contained Tool Management Component

  A complete toolbar that:
  - Instantiates configured tools
  - Manages tool visibility via toolCoordinator
  - Renders toolbar UI with buttons
  - Handles tool lifecycle

  Clients just need: <pie-tool-toolbar tools="protractor,ruler,graph"></pie-tool-toolbar>
-->
<script lang="ts">
	
	import type { HighlightCoordinator, ToolCoordinator } from '@pie-framework/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-framework/pie-assessment-toolkit';
import { onMount } from 'svelte';

	const browser = typeof window !== 'undefined';
	const log = (..._args: any[]) => {};

	// Tool packages define custom elements (side-effect imports).
	import '@pie-framework/pie-tool-answer-eliminator';
	import '@pie-framework/pie-tool-calculator';
	import '@pie-framework/pie-tool-color-scheme';
	import '@pie-framework/pie-tool-graph';
	import '@pie-framework/pie-tool-line-reader';
	import '@pie-framework/pie-tool-magnifier';
	import '@pie-framework/pie-tool-periodic-table';
	import '@pie-framework/pie-tool-protractor';
	import '@pie-framework/pie-tool-ruler';

	// Props - using Svelte 5 $props() syntax
	let {
		tools = 'colorScheme,answerEliminator,calculator,ruler,protractor,periodicTable,graph,lineReader,magnifier', // Comma-separated tool IDs (ordered by frequency of use)
		disabled = false,
		position = 'right' as 'left' | 'right' | 'top' | 'bottom',
		showLabels = false,
		className = '',
		organizationId = undefined as string | undefined, // For JWT token generation (can be set at runtime)
		baseUrl = 'http://localhost:5200', // Picture Dictionary API base URL
		answerEliminatorButtonAlignment = 'right' as 'left' | 'right' | 'inline', // Answer Eliminator button placement

		// Coordinators from assessment toolkit
		toolCoordinator = undefined as ToolCoordinator | null | undefined,
		highlightCoordinator = undefined as HighlightCoordinator | null | undefined,

		// Event callbacks for annotation toolbar (dictionary/translation not yet implemented)
		ondictionarylookup = undefined as ((detail: { text: string }) => void) | undefined,
		ontranslationrequest = undefined as ((detail: { text: string }) => void) | undefined
	} = $props();

	// Parse enabled tools from prop
	let enabledToolIds = $derived(tools.split(',').map(t => t.trim()).filter(Boolean));

	// Tool visibility state
	let showColorScheme = $state(false);
	let showAnswerEliminator = $state(false);
	let showCalculator = $state(false);
	let showProtractor = $state(false);
	let showRuler = $state(false);
	let showLineReader = $state(false);
	let showGraph = $state(false);
	let showPeriodicTable = $state(false);
	let showMagnifier = $state(false);

	// Update visibility state from coordinator
	function updateToolVisibility() {
		if (!toolCoordinator) return;
		log('updateToolVisibility called');
		showColorScheme = toolCoordinator.isToolVisible('colorScheme');
		showAnswerEliminator = toolCoordinator.isToolVisible('answerEliminator');
		showCalculator = toolCoordinator.isToolVisible('calculator');
		showProtractor = toolCoordinator.isToolVisible('protractor');
		showRuler = toolCoordinator.isToolVisible('ruler');
		showLineReader = toolCoordinator.isToolVisible('lineReader');
		showGraph = toolCoordinator.isToolVisible('graph');
		showPeriodicTable = toolCoordinator.isToolVisible('periodicTable');
		showMagnifier = toolCoordinator.isToolVisible('magnifier');
		log('Updated visibility - calculator:', showCalculator, 'answerEliminator:', showAnswerEliminator);
	}

	// Picture Dictionary Modal state

	// Handle picture dictionary lookup from annotation toolbar

	// Handle arrow key navigation between toolbar buttons
	function handleKeyDown(e: KeyboardEvent) {
		const isHorizontal = position === 'top' || position === 'bottom';
		const allowed = isHorizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowDown', 'ArrowUp'];
		if (!allowed.includes(e.key)) return;

		e.preventDefault();
		const buttons = document.querySelectorAll('.tool-toolbar__button:not(:disabled)') as NodeListOf<HTMLButtonElement>;
		if (buttons.length === 0) return;

		const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
		let nextIndex: number;

		const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
		nextIndex = forward
			? currentIndex === -1
				? 0
				: (currentIndex + 1) % buttons.length
			: currentIndex === -1
				? buttons.length - 1
				: (currentIndex - 1 + buttons.length) % buttons.length;

		buttons[nextIndex]?.focus();
	}

	// Subscribe to coordinator reactively when it becomes available
	$effect(() => {
		if (!browser || !toolCoordinator) return;

		log('Subscribing to coordinator');

		// Subscribe to tool coordinator changes
		const unsubscribe = toolCoordinator.subscribe(() => {
			log('Coordinator notified, updating visibility');
			updateToolVisibility();
		});

		// Initial update
		updateToolVisibility();

		// Cleanup
		return () => {
			log('Unsubscribing from coordinator');
			unsubscribe();
		};
	});

	// Tool configuration registry - all available tools
	// Using Material Design Icons (inline SVG) for consistency with PIE items
	const TOOL_REGISTRY = {
		colorScheme: {
			id: 'colorScheme',
			name: 'Color Scheme',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z"/></svg>`,
			getVisibility: () => showColorScheme,
			toggle: () => toolCoordinator?.toggleTool('colorScheme'),
			implemented: true
		},
		answerEliminator: {
			id: 'answerEliminator',
			name: 'Answer Eliminator',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"/></svg>`,
			getVisibility: () => showAnswerEliminator,
			toggle: () => toolCoordinator?.toggleTool('answerEliminator'),
			implemented: true
		},
		calculator: {
			id: 'calculator',
			name: 'Calculator',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V8H17V4H7M7,10V12H9V10H7M11,10V12H13V10H11M15,10V12H17V10H15M7,14V16H9V14H7M11,14V16H13V14H11M15,14V16H17V14H15M7,18V20H9V18H7M11,18V20H13V18H11M15,18V20H17V18H15Z"/></svg>`,
			getVisibility: () => showCalculator,
			toggle: () => toolCoordinator?.toggleTool('calculator'),
			implemented: true
		},
		protractor: {
			id: 'protractor',
			name: 'Protractor',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M1,6V7H4V6H1M20,6V7H23V6H20M8.5,6A0.5,0.5 0 0,0 8,6.5A0.5,0.5 0 0,0 8.5,7A0.5,0.5 0 0,0 9,6.5A0.5,0.5 0 0,0 8.5,6M15.5,6A0.5,0.5 0 0,0 15,6.5A0.5,0.5 0 0,0 15.5,7A0.5,0.5 0 0,0 16,6.5A0.5,0.5 0 0,0 15.5,6M5,8V9H7V8H5M17,8V9H19V8H17M8.5,10A0.5,0.5 0 0,0 8,10.5A0.5,0.5 0 0,0 8.5,11A0.5,0.5 0 0,0 9,10.5A0.5,0.5 0 0,0 8.5,10M15.5,10A0.5,0.5 0 0,0 15,10.5A0.5,0.5 0 0,0 15.5,11A0.5,0.5 0 0,0 16,10.5A0.5,0.5 0 0,0 15.5,10M12,11C9.97,11 8.17,12.29 7.35,14.13C7.13,14.63 7,15.17 7,15.75C7,17.43 8.57,19 10.25,19H13.75C15.43,19 17,17.43 17,15.75C17,15.17 16.87,14.63 16.65,14.13C15.83,12.29 14.03,11 12,11M12,13L14.67,15.75H9.33L12,13Z"/></svg>`,
			getVisibility: () => showProtractor,
			toggle: () => toolCoordinator?.toggleTool('protractor'),
			implemented: true
		},
		ruler: {
			id: 'ruler',
			name: 'Ruler',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M1.39,18.36L3.16,16.6L4.58,18L5.64,16.95L4.22,15.54L5.64,14.12L8.11,16.6L9.17,15.54L6.7,13.06L8.11,11.65L9.53,13.06L10.59,12L9.17,10.59L10.59,9.17L13.06,11.65L14.12,10.59L11.65,8.11L13.06,6.7L14.47,8.11L15.54,7.05L14.12,5.64L15.54,4.22L18,6.7L19.07,5.64L16.6,3.16L18.36,1.39L22.61,5.64L5.64,22.61L1.39,18.36Z"/></svg>`,
			getVisibility: () => showRuler,
			toggle: () => toolCoordinator?.toggleTool('ruler'),
			implemented: true
		},
		lineReader: {
			id: 'lineReader',
			name: 'Line Reader',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M3,5H21V7H3V5M3,11H21V13H3V11M3,17H21V19H3V17Z"/></svg>`,
			getVisibility: () => showLineReader,
			toggle: () => toolCoordinator?.toggleTool('lineReader'),
			implemented: true
		},
		graph: {
			id: 'graph',
			name: 'Graph',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"/></svg>`,
			getVisibility: () => showGraph,
			toggle: () => toolCoordinator?.toggleTool('graph'),
			implemented: true
		},
		periodicTable: {
			id: 'periodicTable',
			name: 'Periodic Table',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L16.53,14.47L14,17L8.93,11.93L5.18,18.43C5.07,18.59 5,18.79 5,19Z"/></svg>`,
			getVisibility: () => showPeriodicTable,
			toggle: () => toolCoordinator?.toggleTool('periodicTable'),
			implemented: true
		},
		magnifier: {
			id: 'magnifier',
			name: 'Magnifier',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z"/></svg>`,
			getVisibility: () => showMagnifier,
			toggle: () => toolCoordinator?.toggleTool('magnifier'),
			implemented: true
		},
		highlighter: {
			id: 'highlighter',
			name: 'Highlighter',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6.36,2L7.77,3.39L6.36,4.8L7.77,6.21L3.39,10.59L2,9.18L6.36,2M13.5,7C14.96,7 16.35,7.59 17.35,8.65L14.59,11.41L9.91,6.73C10.97,6.18 12.14,6 13.5,7M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"/></svg>`,
			getVisibility: () => false,
			toggle: () => {},
			implemented: false
		}
	};

	// Build toolbar config from enabled tools
	// Make this reactive to visibility changes by including them in the dependency
	let toolbarConfig = $derived(browser && [showColorScheme, showAnswerEliminator, showCalculator, showProtractor, showRuler, showLineReader, showGraph, showPeriodicTable, showMagnifier]
		? enabledToolIds
				.map(id => TOOL_REGISTRY[id])
				.filter(Boolean)
				.map(tool => ({
					id: tool.id,
					name: tool.name,
					enabled: tool.implemented,
					isVisible: tool.getVisibility(),
					icon: tool.icon,
					toggle: tool.toggle
				}))
		: []);

	// Handle tool toggle
	function handleToolToggle(toolId: string, toggleFn: () => void) {
		log('handleToolToggle called for:', toolId, 'coordinator:', toolCoordinator);
		toggleFn();
		log('After toggleFn, checking visibility...');
		setTimeout(() => {
			if (toolCoordinator) {
				const isVisible = toolCoordinator.isToolVisible(toolId);
				log('Tool', toolId, 'is now visible:', isVisible);
			}
		}, 100);
	}

	// Check which tools should be shown
	let showColorSchemeTool = $derived.by(() => {
		const show = enabledToolIds.includes('colorScheme');
		log('showColorSchemeTool:', show, 'enabledToolIds:', enabledToolIds);
		return show;
	});
	let showAnswerEliminatorTool = $derived(enabledToolIds.includes('answerEliminator'));
	let showCalculatorTool = $derived(enabledToolIds.includes('calculator'));
	let showProtractorTool = $derived(enabledToolIds.includes('protractor'));
	let showRulerTool = $derived(enabledToolIds.includes('ruler'));
	let showLineReaderTool = $derived(enabledToolIds.includes('lineReader'));
	let showGraphTool = $derived(enabledToolIds.includes('graph'));
	let showPeriodicTableTool = $derived(enabledToolIds.includes('periodicTable'));
	let showMagnifierTool = $derived(enabledToolIds.includes('magnifier'));
</script>

{#if browser}
	{@const _ = log('Rendering in browser, showColorSchemeTool:', showColorSchemeTool, 'enabledToolIds:', enabledToolIds)}
	<!-- Toolbar UI -->
	<div
		class="tool-toolbar {className}"
		class:tool-toolbar--left={position === 'left'}
		class:tool-toolbar--right={position === 'right'}
		class:tool-toolbar--top={position === 'top'}
		class:tool-toolbar--bottom={position === 'bottom'}
		data-position={position}
		role="toolbar"
		tabindex="0"
		aria-label="Assessment tools"
		onkeydown={handleKeyDown}
	>
		<h2 class="tool-toolbar__title">Tools</h2>

		<div class="tool-toolbar__buttons">
			{#each toolbarConfig as tool (tool.id)}
				<button
					type="button"
					class="tool-toolbar__button"
					class:tool-toolbar__button--active={tool.isVisible}
					class:tool-toolbar__button--disabled={!tool.enabled}
					title={tool.name}
					aria-label={tool.name}
					aria-pressed={tool.isVisible}
					disabled={disabled || !tool.enabled}
					onclick={() => handleToolToggle(tool.id, tool.toggle)}
				>
					<span class="tool-toolbar__icon" aria-hidden="true">
						{@html tool.icon}
					</span>
					{#if showLabels}
						<span class="tool-toolbar__label">{tool.name}</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tool Instances - Always mounted if enabled, visibility controlled by props -->
	{#if showColorSchemeTool}
		<pie-tool-color-scheme visible={showColorScheme} tool-id="colorScheme" coordinator={toolCoordinator}></pie-tool-color-scheme>
	{/if}
	{#if showAnswerEliminatorTool}
		<pie-tool-answer-eliminator
			visible={showAnswerEliminator}
			tool-id="answerEliminator"
			strategy="strikethrough"
			buttonAlignment={answerEliminatorButtonAlignment}
			coordinator={toolCoordinator}
		></pie-tool-answer-eliminator>
	{/if}
	{#if showCalculatorTool}
		<pie-tool-calculator
			visible={showCalculator}
			tool-id="calculator"
			calculator-type="scientific"
			availableTypes={['basic', 'scientific', 'graphing', 'ti-84', 'ti-108', 'ti-34-mv']}
			coordinator={toolCoordinator}
		></pie-tool-calculator>
	{/if}
	{#if showProtractorTool}
		<pie-tool-protractor visible={showProtractor} tool-id="protractor" coordinator={toolCoordinator}></pie-tool-protractor>
	{/if}
	{#if showRulerTool}
		<pie-tool-ruler visible={showRuler} tool-id="ruler" coordinator={toolCoordinator}></pie-tool-ruler>
	{/if}
	{#if showLineReaderTool}
		<pie-tool-line-reader visible={showLineReader} tool-id="lineReader" coordinator={toolCoordinator}></pie-tool-line-reader>
	{/if}
	{#if showGraphTool}
		<pie-tool-graph visible={showGraph} tool-id="graph" coordinator={toolCoordinator}></pie-tool-graph>
	{/if}
	{#if showPeriodicTableTool}
		<pie-tool-periodic-table visible={showPeriodicTable} tool-id="periodicTable" coordinator={toolCoordinator}></pie-tool-periodic-table>
	{/if}
	{#if showMagnifierTool}
		<pie-tool-magnifier visible={showMagnifier} tool-id="magnifier" coordinator={toolCoordinator}></pie-tool-magnifier>
	{/if}
	<!-- Note: Annotation toolbar is intentionally not mounted here yet.
	     It currently requires a ttsService prop that isn't exposed via its custom element API. -->

{/if}

<style>
	.tool-toolbar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem;
		background-color: var(--tool-toolbar-bg, var(--pie-secondary-background, #f5f5f5));
		border: 1px solid var(--tool-toolbar-border, var(--pie-border, #ccc));
		min-width: 4rem;
		/* Keep the toolbar controls clickable even when tools render overlays inside this element. */
		position: relative;
		z-index: var(--tool-toolbar-z, 5000);
	}

	.tool-toolbar--left {
		border-right: 1px solid var(--tool-toolbar-border, var(--pie-border, #ccc));
		border-left: none;
	}

	.tool-toolbar--right {
		border-left: 1px solid var(--tool-toolbar-border, var(--pie-border, #ccc));
		border-right: none;
	}

	.tool-toolbar--top,
	.tool-toolbar--bottom {
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		min-width: 0;
		width: 100%;
	}

	.tool-toolbar--top .tool-toolbar__title,
	.tool-toolbar--bottom .tool-toolbar__title {
		display: none;
	}

	.tool-toolbar__title {
		font-size: 0.625rem;
		font-weight: bold;
		text-align: center;
		margin: 0;
		padding: 0.25rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tool-toolbar-title-color, var(--pie-text, black));
	}

	.tool-toolbar__buttons {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.tool-toolbar--top .tool-toolbar__buttons,
	.tool-toolbar--bottom .tool-toolbar__buttons {
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
	}

	.tool-toolbar__button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		width: 3rem;
		height: 3rem;
		padding: 0.5rem;
		border: 1px solid var(--tool-toolbar-button-border, var(--pie-border, #ccc));
		border-radius: var(--tool-toolbar-button-radius, 0.5rem);
		background-color: var(--tool-toolbar-button-bg, var(--pie-background, white));
		color: var(--tool-toolbar-button-color, var(--pie-text, black));
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
	}

	.tool-toolbar--top .tool-toolbar__button,
	.tool-toolbar--bottom .tool-toolbar__button {
		flex-direction: row;
		justify-content: flex-start;
		width: auto;
		height: 2.25rem;
		padding: 0.25rem 0.75rem;
		gap: 0.5rem;
		border-radius: 0.25rem;
	}

	.tool-toolbar__button:hover:not(:disabled) {
		background-color: var(--tool-toolbar-button-hover-bg, var(--pie-secondary-background, #f0f0f0));
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.tool-toolbar__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.tool-toolbar__button--active {
		background-color: var(--tool-toolbar-button-active-bg, var(--pie-primary, #3f51b5));
		color: var(--tool-toolbar-button-active-color, white);
		border-color: var(--tool-toolbar-button-active-border, var(--pie-primary, #3f51b5));
	}

	.tool-toolbar__button--active:hover:not(:disabled) {
		background-color: var(--tool-toolbar-button-active-hover-bg, var(--pie-primary-dark, #303f9f));
	}

	.tool-toolbar__button--disabled,
	.tool-toolbar__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tool-toolbar__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tool-toolbar__icon :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
		fill: currentColor;
	}

	.tool-toolbar__label {
		font-size: 0.625rem;
		font-weight: 500;
		text-align: center;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	/* Show labels on larger screens if enabled */
	@media (min-width: 768px) {
		.tool-toolbar__button {
			min-width: 4rem;
		}
	}

	/* Keyboard focus styling */
	.tool-toolbar__button:focus-visible {
		outline: 2px solid var(--tool-toolbar-focus-color, hsl(var(--p)));
		outline-offset: 2px;
	}
</style>
