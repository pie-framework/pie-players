<script lang="ts">
	let {
		minimized = false,
		onToggle,
		onClose,
		buttonClass = "",
	} = $props<{
		minimized?: boolean;
		onToggle?: () => void;
		onClose?: () => void;
		buttonClass?: string;
	}>();

	const resolvedButtonClass = (buttonClass || "").trim() || "pie-window-controls__button";
</script>

<button
	class={resolvedButtonClass}
	onclick={onToggle}
	title={minimized ? "Maximize" : "Minimize"}
	aria-label={minimized ? "Maximize panel" : "Minimize panel"}
>
	{#if minimized}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-window-controls__icon"
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
		</svg>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-window-controls__icon"
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	{/if}
</button>
<button
	class={resolvedButtonClass}
	onclick={onClose}
	title="Close"
	aria-label="Close panel"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="pie-window-controls__icon"
		width="12"
		height="12"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
	</svg>
</button>

<style>
	.pie-window-controls__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.7);
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.65);
		color: #334155;
		cursor: pointer;
	}

	.pie-window-controls__button:hover {
		background: rgba(241, 245, 249, 0.95);
	}

	.pie-window-controls__button:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.pie-window-controls__icon {
		display: block;
	}
</style>
