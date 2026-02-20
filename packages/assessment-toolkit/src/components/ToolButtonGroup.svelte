<script lang="ts">
	/**
	 * ToolButtonGroup
	 *
	 * Generic toolbar component that renders a group of tool buttons.
	 * Implements the two-pass visibility model:
	 * - Pass 1: Receives allowedToolIds from orchestrator (PNP/policies)
	 * - Pass 2: Filters by tool relevance using ToolRegistry
	 */

	import type { ToolRegistry } from "../services/ToolRegistry.js";
	import type { ToolContext } from "../services/tool-context.js";
	import ToolButton from "./ToolButton.svelte";

	// Props
	let {
		toolRegistry,
		allowedToolIds,
		context,
		onToolClick,
		orientation = "horizontal",
		compact = false,
		class: className = "",
	}: {
		/** Tool registry for filtering and button creation */
		toolRegistry: ToolRegistry;
		/** Tool IDs allowed by orchestrator (Pass 1) */
		allowedToolIds: string[];
		/** Context for visibility evaluation (Pass 2) */
		context: ToolContext;
		/** Callback when tool button is clicked */
		onToolClick?: (toolId: string) => void;
		/** Layout orientation */
		orientation?: "horizontal" | "vertical";
		/** Compact mode (icon only) */
		compact?: boolean;
		/** Additional CSS classes */
		class?: string;
	} = $props();

	// Two-pass visibility model
	// Pass 2: Filter by tool relevance
	const visibleTools = $derived(
		toolRegistry.filterVisibleInContext(allowedToolIds, context),
	);

	// Create button definitions for visible tools
	const buttons = $derived(
		visibleTools.map((tool) =>
			tool.createButton(context, {
				onClick: () => {
					onToolClick?.(tool.toolId);
				},
				className: compact ? "tool-button--compact" : "",
			}),
		),
	);

	// Derive container classes
	const containerClasses = $derived(
		[
			"tool-button-group",
			`tool-button-group--${orientation}`,
			compact ? "tool-button-group--compact" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

{#if buttons.length > 0}
	<div class={containerClasses} role="toolbar" aria-label="Assessment tools">
		{#each buttons as button (button.toolId)}
			<ToolButton {button} />
		{/each}
	</div>
{/if}

<style>
	.tool-button-group {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--tool-button-group-bg, transparent);
		border-radius: 0.5rem;
	}

	.tool-button-group--horizontal {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
	}

	.tool-button-group--vertical {
		flex-direction: column;
		align-items: stretch;
	}

	.tool-button-group--compact {
		gap: 0.25rem;
		padding: 0.25rem;
	}

	/* Empty state - hide when no buttons */
	.tool-button-group:empty {
		display: none;
	}
</style>
