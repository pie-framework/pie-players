<script lang="ts">
	/**
	 * ToolButton
	 *
	 * Generic button component for rendering tool buttons in toolbars.
	 * Uses ToolToolbarButtonDefinition from ToolRegistry for consistent rendering.
	 */

	import type { ToolToolbarButtonDefinition } from "../services/ToolRegistry.js";

	// Props
	let {
		button,
		class: className = "",
	}: {
		button: ToolToolbarButtonDefinition;
		class?: string;
	} = $props();

	// Handle button click
	function handleClick() {
		if (!button.disabled && button.onClick) {
			button.onClick();
		}
	}

	// Derive button classes
	const buttonClasses = $derived(
		[
			"tool-button",
			button.className,
			className,
			button.disabled ? "tool-button--disabled" : "",
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<button
	type="button"
	class={buttonClasses}
	disabled={button.disabled}
	aria-label={button.ariaLabel}
	title={button.tooltip || button.label}
	onclick={handleClick}
	data-tool-id={button.toolId}
>
	{#if button.icon}
		<span class="tool-button__icon" aria-hidden="true">
			{#if button.icon.startsWith("<svg")}
				<!-- Inline SVG -->
				{@html button.icon}
			{:else if button.icon.startsWith("http")}
				<!-- External image URL -->
				<img src={button.icon} alt="" />
			{:else}
				<!-- Icon name/class -->
				<i class={`icon icon-${button.icon}`}></i>
			{/if}
		</span>
	{/if}
	<span class="tool-button__label">{button.label}</span>
</button>

<style>
	.tool-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--pie-button-bg, #ffffff);
		border: 1px solid var(--pie-button-border, #d1d5db);
		border-radius: 0.375rem;
		color: var(--pie-button-color, #374151);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease-in-out;
		white-space: nowrap;
	}

	.tool-button:hover:not(:disabled) {
		background: var(--pie-button-hover-bg, #f9fafb);
		border-color: var(--pie-button-hover-border, #9ca3af);
		color: var(--pie-button-hover-color, #111827);
	}

	.tool-button:active:not(:disabled) {
		background: var(--pie-button-active-bg, #f3f4f6);
		transform: translateY(1px);
	}

	.tool-button:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #3b82f6);
		outline-offset: 2px;
	}

	.tool-button:disabled,
	.tool-button--disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tool-button__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.tool-button__icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}

	.tool-button__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.tool-button__label {
		line-height: 1.25;
	}

	/* Compact variant - icon only */
	.tool-button--compact .tool-button__label {
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

	.tool-button--compact {
		padding: 0.5rem;
	}
</style>
