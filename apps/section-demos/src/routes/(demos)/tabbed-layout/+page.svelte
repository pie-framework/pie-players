<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.demo?.name || 'Tabbed Layout'} - PIE Section Demos</title>
</svelte:head>

<main class="tabbed-layout-index">
	<section class="tabbed-layout-index-card">
		<h1>{data.demo?.name || 'Tabbed Layout'}</h1>
		<p>{data.demo?.description || 'Dedicated tabbed layout demo.'}</p>
		<p class="tabbed-layout-index-help">
			Choose a bookmarkable route:
		</p>
		<div class="tabbed-layout-links">
			<a class="btn" href="/tabbed-layout/tabbed">Tabbed layout route</a>
			<a class="btn" href="/tabbed-layout/splitpane-tabbed-collapse">
				Splitpane tabbed-collapse route
			</a>
		</div>
	</section>
</main>

<style>
	.tabbed-layout-index {
		height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
	}

	.tabbed-layout-index-card {
		width: min(100%, 60rem);
		background: var(--color-base-100);
		border-radius: 0.75rem;
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tabbed-layout-index-help {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.tabbed-layout-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
</style>
