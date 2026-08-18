<script lang="ts">
	import { getAllSectionDemos } from '$lib/content/sections';
	import SiteHeader from '$lib/components/SiteHeader.svelte';

	const demos = getAllSectionDemos().sort(
		(a, b) =>
			(a.integrationLevel || Number.MAX_SAFE_INTEGER) -
			(b.integrationLevel || Number.MAX_SAFE_INTEGER)
	);
</script>

<svelte:head>
	<title>PIE Section Player - Demo App</title>
</svelte:head>

<SiteHeader title="PIE Section Demos" subtitle="Section player recipes" />

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<header class="text-center mb-12 space-y-3">
		<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
			Section Player
		</p>
		<h1 class="text-5xl font-bold tracking-tight text-secondary">
			PIE Section Player Demos
		</h1>
		<p class="text-xl text-base-content/70 max-w-2xl mx-auto">
			Progressive client-integration recipes from CE defaults to JS API persistence
		</p>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
		{#each demos as demo}
			<a
				href="/{demo.id}"
				class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
			>
				<div class="card-body">
					<p class="text-xs font-semibold uppercase tracking-wide text-primary">
						Level {demo.integrationLevel || '?'} - {demo.integrationTheme || 'General'}
					</p>
					<h2 class="card-title text-2xl mb-4">{demo.name}</h2>
					<p class="text-base-content/70">
						{demo.description}
					</p>
				</div>
			</a>
		{/each}
	</div>
</div>
