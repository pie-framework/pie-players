<script lang="ts">
	let {
		minimized = false,
		onToggle,
		onClose,
		buttonClass = "btn btn-xs btn-ghost btn-circle",
	} = $props<{
		minimized?: boolean;
		onToggle?: () => void;
		onClose?: () => void;
		buttonClass?: string;
	}>();
</script>

<button class={buttonClass} onclick={onToggle} title={minimized ? "Maximize" : "Minimize"}>
	{#if minimized}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-3 w-3"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
		</svg>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-3 w-3"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	{/if}
</button>
<button class={buttonClass} onclick={onClose} title="Close">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-3 w-3"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
	</svg>
</button>
