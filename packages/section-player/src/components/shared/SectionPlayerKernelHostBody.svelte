<script lang="ts">
	import { connectSectionPlayerLayoutContext } from "./section-player-layout-context.js";

	// The kernel host's own layout, mounted into its light DOM when the host gives
	// it no children: passages above items, the passages pane only for a section
	// that has passages.
	let content = $state<HTMLDivElement | null>(null);
	let hasPassages = $state(false);

	$effect(() => {
		if (!content) return;
		return connectSectionPlayerLayoutContext(content, (value) => {
			hasPassages = value.passages.length > 0;
		});
	});
</script>

<div bind:this={content} class="pie-section-player-kernel-host-content">
	{#if hasPassages}
		<pie-section-player-passages-pane></pie-section-player-passages-pane>
	{/if}
	<pie-section-player-items-pane></pie-section-player-items-pane>
</div>

<style>
	.pie-section-player-kernel-host-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		height: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	pie-section-player-items-pane :global(.pie-section-player-scroll-hint) {
		bottom: -0.5rem;
	}
</style>
