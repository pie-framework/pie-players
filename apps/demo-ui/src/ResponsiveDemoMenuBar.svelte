<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		start: Snippet;
		primary?: Snippet;
		secondary?: Snippet;
		label?: string;
		class?: string;
	}

	let {
		start,
		primary,
		secondary,
		label = "Demo controls",
		class: className = "",
	}: Props = $props();

	const componentId = $props.id();
	const controlsId = `${componentId}-controls`;

	let compactMenuOpen = $state(false);
	let compactMenuButton = $state<HTMLButtonElement>();
	let menuBar = $state<HTMLElement>();

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key !== "Escape" || !compactMenuOpen) return;
		// Escape belongs to the focused control. Do not let an open demo menu
		// steal it from dialogs and tool shells elsewhere on the page.
		if (!menuBar || !event.composedPath().includes(menuBar)) return;
		compactMenuOpen = false;
		if (compactMenuButton?.offsetParent) {
			compactMenuButton.focus();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<nav bind:this={menuBar} class={`pie-demo-menu-bar ${className}`} aria-label={label}>
	<div class="pie-demo-menu-bar__start">
		{@render start()}
	</div>

	<button
		bind:this={compactMenuButton}
		type="button"
		class="btn btn-sm btn-outline pie-demo-menu-bar__compact-toggle"
		onclick={() => (compactMenuOpen = !compactMenuOpen)}
		aria-controls={controlsId}
		aria-expanded={compactMenuOpen}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			{#if compactMenuOpen}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			{/if}
		</svg>
		{compactMenuOpen ? "Close" : "Menu"}
	</button>

	<div
		id={controlsId}
		class="pie-demo-menu-bar__controls"
		class:pie-demo-menu-bar__controls--open={compactMenuOpen}
	>
		{#if primary}
			<div class="pie-demo-menu-bar__primary-controls">
				{@render primary()}
			</div>
		{/if}
		{#if secondary}
			<div class="pie-demo-menu-bar__secondary-controls">
				{@render secondary()}
			</div>
		{/if}
	</div>
</nav>

<style>
	.pie-demo-menu-bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		width: 100%;
		min-height: 4rem;
		padding: 0.5rem 1rem;
		box-sizing: border-box;
	}

	.pie-demo-menu-bar__start,
	.pie-demo-menu-bar__primary-controls,
	.pie-demo-menu-bar__secondary-controls {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.pie-demo-menu-bar__start {
		justify-content: flex-start;
		gap: 0.75rem;
	}

	.pie-demo-menu-bar__primary-controls {
		justify-content: center;
		gap: 1rem;
	}

	.pie-demo-menu-bar__secondary-controls {
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.pie-demo-menu-bar__compact-toggle {
		display: none;
	}

	.pie-demo-menu-bar__controls {
		display: contents;
	}

	@media (max-width: 1400px) {
		.pie-demo-menu-bar {
			display: flex;
			min-height: auto;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.pie-demo-menu-bar__start {
			flex: 1 1 0;
		}

		.pie-demo-menu-bar__compact-toggle {
			display: inline-flex;
			flex: 0 0 auto;
		}

		.pie-demo-menu-bar__controls {
			display: none;
			flex: 1 0 100%;
			min-width: 0;
			padding-top: 0.5rem;
			border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
		}

		.pie-demo-menu-bar__controls--open {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.pie-demo-menu-bar__primary-controls,
		.pie-demo-menu-bar__secondary-controls {
			width: 100%;
			flex-wrap: wrap;
			justify-content: flex-start;
		}
	}
</style>
