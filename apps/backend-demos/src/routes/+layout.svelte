<script lang="ts">
	import "../app.css";
	import SiteHeader from "$lib/components/SiteHeader.svelte";

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader title="PIE Backend Demos" subtitle="Backend integration recipes" />
	<main class="flex-1">
		{@render children()}
	</main>
</div>
