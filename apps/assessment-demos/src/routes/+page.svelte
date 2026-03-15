<script lang="ts">
	import { getAllAssessmentDemos } from "$lib/content/assessments";

	const demos = getAllAssessmentDemos();
</script>

<svelte:head>
	<title>PIE Assessment Player - Demo App</title>
</svelte:head>

<main class="demo-index">
	<header>
		<h1>PIE Assessment Player Demos</h1>
		<p>
			Assessment-level orchestration demos that compose section-player as the rendering
			workhorse.
		</p>
	</header>

	<section class="cards">
		{#each demos as demo}
			<a href="/{demo.id}" class="card">
				<h2>{demo.name}</h2>
				<p>{demo.description}</p>
			</a>
		{/each}
	</section>
</main>

<style>
	.demo-index {
		max-width: 980px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.card {
		display: block;
		padding: 1rem;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
	}

	.card:hover {
		border-color: #0f766e;
	}

	.card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}

	.card p {
		margin: 0;
		color: #4b5563;
	}
</style>
