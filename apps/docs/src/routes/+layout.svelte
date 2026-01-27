<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import SiteHeader from '$lib/components/SiteHeader.svelte';

	let { children } = $props();

	// Keep a stable theme for docs.
	$effect(() => {
		if (browser) {
			document.documentElement.setAttribute('data-theme', 'light');
		}
	});
</script>

<svelte:head>
	<!-- Fonts -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>

	<!-- Default Meta Tags -->
	<meta name="description" content="PIE Players - Production-ready players and tools for rendering PIE content across multiple delivery modes." />
	<meta name="keywords" content="PIE Framework, PIE Players, assessment players, item players, web components, education technology" />
</svelte:head>

<div class="flex flex-col min-h-screen">
	<!-- Skip to main content link for keyboard navigation -->
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-focus"
	>
		Skip to main content
	</a>
	<SiteHeader />
	<main id="main-content" class="flex-1">
		{@render children()}
	</main>
</div>

