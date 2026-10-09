<script lang="ts">
	import '@pie-players/pie-section-player';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sectionId = $derived(String(data.section?.identifier || 'custom-layout-section'));
	const attemptId = 'custom-layout-attempt';
	const runtime = {
		assessmentId: 'section-demos.custom-layout',
		env: { mode: 'gather' as const, role: 'student' as const },
	};
</script>

<svelte:head>
	<title>{data.demo.name} - PIE Section Demos</title>
</svelte:head>

<main class="custom-layout-page">
	<pie-section-player-kernel-host
		class="custom-layout-player"
		{runtime}
		{sectionId}
		{attemptId}
		section={data.section}
	>
		<div class="custom-layout-columns">
			<div class="custom-layout-column" data-custom-layout-column="items">
				<pie-section-player-items-pane></pie-section-player-items-pane>
			</div>
			<div class="custom-layout-column" data-custom-layout-column="passages">
				<pie-section-player-passages-pane></pie-section-player-passages-pane>
			</div>
		</div>
	</pie-section-player-kernel-host>
</main>

<style>
	.custom-layout-page {
		height: 100dvh;
		padding: 1rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
	}

	.custom-layout-player {
		display: block;
		height: 100%;
	}

	.custom-layout-columns {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 1rem;
		height: 100%;
		min-height: 0;
	}

	/* Each pane's parent scrolls: the items pane's scroll hint follows the nearest
	   scrolling ancestor. */
	.custom-layout-column {
		min-height: 0;
		overflow: auto;
		padding: 0.5rem;
	}
</style>
