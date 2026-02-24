<!-- pie-api-aws/containers/pieoneer/src/lib/tags/tool-magnifier/tool-magnifier.svelte -->
<!--
  Magnifier Tool - Modern Svelte 5 Implementation

  This component provides a draggable magnification window that clones and magnifies
  the entire page content using a native Svelte 5 component.

  Features:
  - Draggable magnification window
  - Multiple zoom levels (1.5x, 2x, 3x)
  - Auto-syncing with DOM changes via MutationObserver
  - Scroll position preservation in magnified content
  - Fully reactive using Svelte 5 runes
-->
<svelte:options
	customElement={{
		tag: 'pie-tool-magnifier',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">
	import {
		assessmentToolkitRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import { ContextConsumer } from '@pie-players/pie-context';
	import Magnifier from './Magnifier.svelte';

	// Props
	let {
		visible = false,
		toolId = 'magnifier'
	}: {
		visible?: boolean;
		toolId?: string;
	} = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let contextHostElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let runtimeContextConsumer: ContextConsumer<
		typeof assessmentToolkitRuntimeContext
	> | null = null;
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);
	let registered = $state(false);
	let zoomLevel = $state<1.5 | 2 | 3>(1.5);

	const ZOOM_LEVELS = [1.5, 2, 3] as const;

	function handleZoomChange(level: 1.5 | 2 | 3) {
		zoomLevel = level;
	}

	$effect(() => {
		if (!contextHostElement) return;
		runtimeContextConsumer = new ContextConsumer(contextHostElement, {
			context: assessmentToolkitRuntimeContext,
			subscribe: true,
			onValue: (value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		});
		runtimeContextConsumer.connect();
		return () => {
			runtimeContextConsumer?.disconnect();
			runtimeContextConsumer = null;
		};
	});

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Magnifier', undefined, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (coordinator && toolId && registered) {
				coordinator.unregisterTool(toolId);
				registered = false;
			}
		};
	});
</script>

<div bind:this={contextHostElement}>
{#if isBrowser}
	<Magnifier bind:visible zoom={zoomLevel} width={420} height={280} shape="square">
		<!-- Zoom controls -->
		<div class="pie-tool-magnifier__zoom-group pie-tool-magnifier__clone-ignore" data-magnifier-ignore="true">
			{#each ZOOM_LEVELS as level}
				<button
					class="pie-tool-magnifier__zoom-button"
					class:pie-tool-magnifier__zoom-button--active={zoomLevel === level}
					data-zoom={level}
					title="{level}x zoom"
					aria-label="Set zoom to {level}x"
					onclick={() => handleZoomChange(level)}
				>
					<span class="pie-tool-magnifier__zoom-label">{level}x</span>
				</button>
			{/each}
		</div>
	</Magnifier>
{/if}
</div>

<style>
	.pie-tool-magnifier__zoom-group {
		background-color: rgba(255, 255, 255, 0.8);
		border: 1px solid var(--pie-primary, #007bff);
		border-radius: 4px;
		bottom: 0.5rem;
		left: 0.5rem;
		position: absolute;
		z-index: 1001;
		display: flex;
		overflow: hidden;
	}

	.pie-tool-magnifier__zoom-button {
		background: white;
		border: none;
		border-right: 1px solid var(--pie-primary, #007bff);
		color: var(--pie-primary, #007bff);
		cursor: pointer;
		padding: 4px 8px;
		font-size: 12px;
		transition: background-color 0.2s, color 0.2s;
	}

	.pie-tool-magnifier__zoom-button:last-child {
		border-right: none;
	}

	.pie-tool-magnifier__zoom-button:hover {
		background-color: rgba(0, 123, 255, 0.1);
	}

	.pie-tool-magnifier__zoom-button.pie-tool-magnifier__zoom-button--active {
		background-color: var(--pie-primary, #007bff);
		color: white;
	}

	.pie-tool-magnifier__zoom-button:focus-visible {
		outline: 2px solid var(--pie-primary, #007bff);
		outline-offset: 2px;
	}

	.pie-tool-magnifier__zoom-label {
		font-size: 0.8em;
	}
</style>
