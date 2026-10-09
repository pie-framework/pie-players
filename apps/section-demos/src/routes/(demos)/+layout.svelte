<script lang="ts">
	import type { Snippet } from "svelte";
	import "../../app.css";

	let { children }: { children: Snippet } = $props();
</script>

<div class="pie-demo-route-shell">
	{@render children()}
</div>

<style>
	.pie-demo-route-shell {
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
	}
</style>
