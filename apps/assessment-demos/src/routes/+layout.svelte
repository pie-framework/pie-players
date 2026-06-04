<script lang="ts">
	import "../app.css";
	import "@pie-players/pie-theme";
	import "@pie-players/pie-theme/components.css";
	import SiteHeader from "$lib/components/SiteHeader.svelte";
	import { initTheme, selectedTheme } from "$lib/stores/theme";

	let { children } = $props();

	// Seed the store from persisted state once on the client. The pre-paint
	// inline script in app.html has already set data-theme to avoid a flash;
	// from here on the <pie-theme scope="document"> host below owns both
	// data-theme on <html> and the --pie-* token variables that cascade into
	// PIE assessment content (so item choices follow the theme).
	$effect(() => {
		initTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href="/pie-favicon.svg" type="image/svg+xml" />
</svelte:head>

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme={$selectedTheme}>
	<div class="flex min-h-screen flex-col">
		<SiteHeader title="PIE Assessment Demos" subtitle="Assessment-level orchestration" />
		<main class="flex-1">
			{@render children()}
		</main>
	</div>
</pie-theme>
