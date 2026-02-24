<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		hasLeft = true,
		initialLeftWidth = 50,
		minLeftWidth = 20,
		maxLeftWidth = 80,
		resizable = true,
		leftPane,
		rightPane,
		separator,
	}: {
		hasLeft?: boolean;
		initialLeftWidth?: number;
		minLeftWidth?: number;
		maxLeftWidth?: number;
		resizable?: boolean;
		leftPane?: Snippet;
		rightPane: Snippet;
		separator?: Snippet;
	} = $props();

	let leftPanelWidth = $state(50);
	let isDragging = $state(false);
	let containerElement: HTMLDivElement | null = $state(null);

	$effect(() => {
		leftPanelWidth = initialLeftWidth;
	});

	function handleMouseDown(event: MouseEvent) {
		if (!resizable) return;
		event.preventDefault();
		isDragging = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !containerElement) return;

		const containerRect = containerElement.getBoundingClientRect();
		const offsetX = event.clientX - containerRect.left;
		const nextWidth = (offsetX / containerRect.width) * 100;
		if (nextWidth >= minLeftWidth && nextWidth <= maxLeftWidth) {
			leftPanelWidth = nextWidth;
		}
	}

	function handleMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!resizable) return;
		const step = 5;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			leftPanelWidth = Math.max(minLeftWidth, leftPanelWidth - step);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			leftPanelWidth = Math.min(maxLeftWidth, leftPanelWidth + step);
		}
	}

	$effect(() => {
		if (!isDragging) return;
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	});
</script>

<div
	class="pie-section-player__split-panel-primitive"
	class:pie-section-player__split-panel-primitive--single-panel={!hasLeft}
	bind:this={containerElement}
	style={hasLeft
		? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
		: "grid-template-columns: 1fr"}
>
	{#if hasLeft}
		<aside class="pie-section-player__split-panel-primitive-left">
			{@render leftPane?.()}
		</aside>
		<button
			type="button"
			class="pie-section-player__split-panel-primitive-divider"
			class:pie-section-player__split-panel-primitive-divider--dragging={isDragging}
			onmousedown={handleMouseDown}
			onkeydown={handleKeyDown}
			aria-label="Resize panels"
		>
			{#if separator}
				{@render separator()}
			{:else}
				<span class="pie-section-player__split-panel-primitive-handle"></span>
			{/if}
		</button>
	{/if}
	<main class="pie-section-player__split-panel-primitive-right">
		{@render rightPane()}
	</main>
</div>

<style>
	.pie-section-player__split-panel-primitive {
		display: grid;
		grid-template-rows: minmax(0, 1fr);
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		gap: 0;
	}

	.pie-section-player__split-panel-primitive-left,
	.pie-section-player__split-panel-primitive-right {
		min-height: 0;
		min-width: 0;
		height: 100%;
	}

	.pie-section-player__split-panel-primitive-divider {
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.pie-section-player__split-panel-primitive-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player__split-panel-primitive-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.pie-section-player__split-panel-primitive-handle {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.pie-section-player__split-panel-primitive-handle::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.pie-section-player__split-panel-primitive-divider:hover
		.pie-section-player__split-panel-primitive-handle,
	.pie-section-player__split-panel-primitive-divider:focus
		.pie-section-player__split-panel-primitive-handle,
	.pie-section-player__split-panel-primitive-divider--dragging
		.pie-section-player__split-panel-primitive-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.pie-section-player__split-panel-primitive-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}

	@media (max-width: 768px) {
		.pie-section-player__split-panel-primitive {
			grid-template-columns: 1fr !important;
			gap: 1rem;
			min-height: auto;
		}

		.pie-section-player__split-panel-primitive-divider {
			display: none;
		}

		.pie-section-player__split-panel-primitive-left,
		.pie-section-player__split-panel-primitive-right {
			height: auto;
		}
	}
</style>
