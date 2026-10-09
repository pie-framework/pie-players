<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

<div class="demo-route-shell">
	{@render children()}
</div>

<style>
	.demo-route-shell {
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
	}
</style>
