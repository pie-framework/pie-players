<script lang="ts">
	let {
		onPointerDown,
		handleClass = "pie-panel-resize-handle",
		iconClass = "pie-panel-resize-icon",
	} = $props<{
		onPointerDown?: (event: MouseEvent) => void;
		handleClass?: string;
		iconClass?: string;
	}>();
</script>

<div
	class={handleClass}
	onmousedown={onPointerDown}
	role="button"
	tabindex="0"
	title="Resize window"
	aria-label="Resize window"
>
	<svg class={iconClass} viewBox="0 0 16 16" fill="currentColor">
		<path d="M16 16V14H14V16H16Z" />
		<path d="M16 11V9H14V11H16Z" />
		<path d="M13 16V14H11V16H13Z" />
	</svg>
</div>

<style>
	.pie-panel-resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: nwse-resize;
		opacity: 0.82;
		z-index: 2;
	}

	.pie-panel-resize-handle:hover {
		opacity: 1;
	}

	.pie-panel-resize-icon {
		width: 100%;
		height: 100%;
		color: color-mix(in srgb, var(--color-base-content, #334155) 30%, transparent);
	}
</style>
