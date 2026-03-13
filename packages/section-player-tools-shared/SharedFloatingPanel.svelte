<script lang="ts">
	import { onDestroy, onMount, untrack } from "svelte";
	import type { Snippet } from "svelte";
	import PanelResizeHandle from "./PanelResizeHandle.svelte";
	import PanelWindowControls from "./PanelWindowControls.svelte";
	import {
		claimNextFloatingPanelZIndex,
		computePanelSizeFromViewport,
		createFloatingPanelPointerController,
		type FloatingPanelViewportSizing,
	} from "./floating-panel.js";

	let {
		title,
		ariaLabel = "Drag panel",
		initialSizing,
		minWidth = 320,
		minHeight = 260,
		defaultMinimized = false,
		onClose,
		className = "",
		bodyClass = "",
		headerClass = "",
		children,
		icon,
		headerActions,
	}: {
		title: string;
		ariaLabel?: string;
		initialSizing: FloatingPanelViewportSizing;
		minWidth?: number;
		minHeight?: number;
		defaultMinimized?: boolean;
		onClose?: () => void;
		className?: string;
		bodyClass?: string;
		headerClass?: string;
		children?: Snippet;
		icon?: Snippet;
		headerActions?: Snippet;
	} = $props();

	let panelX = $state(16);
	let panelY = $state(16);
	let panelWidth = $state(420);
	let panelHeight = $state(480);
	let panelZIndex = $state(claimNextFloatingPanelZIndex());
	let isMinimized = $state(untrack(() => defaultMinimized));

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: panelX,
			y: panelY,
			width: panelWidth,
			height: panelHeight,
		}),
		setState: (next) => {
			panelX = next.x;
			panelY = next.y;
			panelWidth = next.width;
			panelHeight = next.height;
		},
		minWidth: untrack(() => minWidth),
		minHeight: untrack(() => minHeight),
		onFocus: () => {
			panelZIndex = claimNextFloatingPanelZIndex();
		},
	});

	function bringToFront(): void {
		panelZIndex = claimNextFloatingPanelZIndex();
	}

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			initialSizing,
		);
		panelX = initial.x;
		panelY = initial.y;
		panelWidth = initial.width;
		panelHeight = initial.height;
	});

	onDestroy(() => {
		pointerController.stop();
	});

	const resolvedPanelClass = $derived.by(() =>
		["pie-shared-floating-panel", className || ""].join(" ").trim(),
	);
	const resolvedBodyClass = $derived.by(() =>
		["pie-shared-floating-panel__body", bodyClass || ""].join(" ").trim(),
	);
	const resolvedHeaderClass = $derived.by(() =>
		["pie-shared-floating-panel__header", headerClass || ""].join(" ").trim(),
	);
</script>

<section
	class={resolvedPanelClass}
	style={`left: ${panelX}px; top: ${panelY}px; width: ${panelWidth}px; z-index: ${panelZIndex}; ${
		isMinimized ? "height: auto;" : `height: ${panelHeight}px;`
	}`}
>
	<header
		class={resolvedHeaderClass}
		onmousedown={(event: MouseEvent) => {
			bringToFront();
			pointerController.startDrag(event);
		}}
		role="button"
		tabindex="0"
		aria-label={ariaLabel}
	>
		<div class="pie-shared-floating-panel__header-main">
			<div class="pie-shared-floating-panel__header-title-wrap">
				{@render icon?.()}
				<h3 class="pie-shared-floating-panel__title">{title}</h3>
			</div>
			{@render headerActions?.()}
		</div>
		<div class="pie-shared-floating-panel__header-controls">
			<PanelWindowControls
				minimized={isMinimized}
				onToggle={() => (isMinimized = !isMinimized)}
				onClose={onClose}
			/>
		</div>
	</header>

	{#if !isMinimized}
		<div class={resolvedBodyClass}>
			{@render children?.()}
		</div>
		<PanelResizeHandle onPointerDown={(event: MouseEvent) => pointerController.startResize(event)} />
	{/if}
</section>

<style>
	.pie-shared-floating-panel {
		position: fixed;
		display: flex;
		flex-direction: column;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-shared-floating-panel__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-shared-floating-panel__header-main {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1;
	}

	.pie-shared-floating-panel__header-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.pie-shared-floating-panel__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-shared-floating-panel__header-controls {
		display: flex;
		gap: 4px;
	}

	.pie-shared-floating-panel__body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
