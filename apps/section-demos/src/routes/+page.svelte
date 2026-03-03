<script lang="ts">
	import { getAllSectionDemos } from '$lib/content/sections';

	const demos = getAllSectionDemos();
</script>

<svelte:head>
	<title>PIE Section Player - Demo App</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<header class="text-center mb-12">
		<h1 class="text-5xl font-bold mb-4">PIE Section Player Demos</h1>
		<p class="text-xl text-base-content/70 max-w-2xl mx-auto">
			Progressive examples showing section player capabilities
		</p>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
		{#each demos as demo}
			<a
				href="/demo/{demo.id}"
				class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
			>
				<div class="card-body">
					<h2 class="card-title text-2xl mb-4">{demo.name}</h2>
					<p class="text-base-content/70">
						{demo.description}
					</p>
				</div>
			</a>
		{/each}
	</div>

</div>
