<script lang="ts">
	import { base } from '$app/paths';
	import { A11Y_FIXTURES } from '$lib/a11y/fixtures';
</script>

<svelte:head>
	<title>PIE Players - A11y fixtures</title>
</svelte:head>

<div class="container mx-auto px-6 py-6">
	<h1 class="text-2xl font-bold mb-2">A11y fixtures</h1>
	<p class="text-sm opacity-80 mb-6">
		Deterministic pages used by Playwright + axe-core to validate baseline accessibility.
	</p>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		{#each A11Y_FIXTURES as f (f.id)}
			<a
				class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
				href={`${base}/a11y-components/${f.id}/`}
			>
				<div class="card-body">
					<h2 class="card-title">{f.name}</h2>
					<p class="text-sm opacity-80">{f.description}</p>
				</div>
			</a>
		{/each}
	</div>
</div>


