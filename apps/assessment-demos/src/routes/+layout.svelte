<script lang="ts">
	import "../app.css";
	import SiteHeader from "$lib/components/SiteHeader.svelte";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/pie-favicon.svg" type="image/svg+xml" />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<SiteHeader title="PIE Assessment Demos" subtitle="Assessment-level orchestration" />
	<main class="flex-1">
		{@render children()}
	</main>
</div>
