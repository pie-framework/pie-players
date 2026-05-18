<script lang="ts">
	import { getAllAssessmentDemos } from "$lib/content/assessments";

	const demos = getAllAssessmentDemos();
</script>

<svelte:head>
	<title>PIE Assessment Player - Demo App</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-12">
	<header class="mb-10 space-y-3">
		<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
			Assessment Player
		</p>
		<h1 class="text-4xl font-bold tracking-tight text-secondary md:text-5xl">
			PIE Assessment Player Demos
		</h1>
		<p class="max-w-2xl text-base-content/70">
			Assessment-level orchestration demos that compose section-player as the
			rendering workhorse.
		</p>
	</header>

	<section class="grid grid-cols-1 gap-6 md:grid-cols-2">
		{#each demos as demo}
			<a
				href="/{demo.id}"
				class="card bg-base-100 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
			>
				<div class="card-body gap-3">
					<h2 class="card-title text-2xl">{demo.name}</h2>
					<p class="text-base-content/70">{demo.description}</p>
					<div class="card-actions justify-end pt-1">
						<span class="text-sm font-semibold text-primary">Open demo &#8594;</span>
					</div>
				</div>
			</a>
		{/each}
	</section>
</div>
