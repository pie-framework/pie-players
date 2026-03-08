<script lang="ts">
	let {
		onPointerDown,
		handleClass = "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
		iconClass = "w-full h-full text-base-content/30",
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
>
	<svg class={iconClass} viewBox="0 0 16 16" fill="currentColor">
		<path d="M16 16V14H14V16H16Z" />
		<path d="M16 11V9H14V11H16Z" />
		<path d="M13 16V14H11V16H13Z" />
	</svg>
</div>
