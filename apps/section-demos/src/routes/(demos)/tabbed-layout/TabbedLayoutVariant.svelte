<script lang="ts">
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-tabbed-element';

	type DemoData = {
		demo?: {
			name?: string;
			description?: string;
		};
		section?: unknown;
	};

	let {
		data,
		variant
	}: {
		data: DemoData;
		variant: 'tabbed' | 'splitpane-tabbed-collapse';
	} = $props();

	const sectionId = $derived(String((data.section as any)?.identifier || 'tabbed-layout-section'));
	const attemptId = 'tabbed-layout-attempt';
	const pieEnv = {
		mode: 'gather' as const,
		role: 'student' as const
	};
	const isSplitpaneVariant = $derived(variant === 'splitpane-tabbed-collapse');
</script>

<svelte:head>
	<title>
		{data.demo?.name || 'Tabbed Layout'} - {isSplitpaneVariant ? 'Splitpane Tabbed Collapse' : 'Tabbed'}
	</title>
</svelte:head>

<main class="tabbed-layout-page">
	<section class="tabbed-layout-card">
		<header class="tabbed-layout-header">
			<h1>{data.demo?.name || 'Tabbed Layout'}</h1>
			<p>{data.demo?.description || 'Dedicated tabbed layout demo.'}</p>
			<nav class="tabbed-layout-links" aria-label="Tabbed layout demo variants">
				<a
					class="btn btn-sm"
					class:btn-active={!isSplitpaneVariant}
					href="/tabbed-layout/tabbed"
				>
					Tabbed route
				</a>
				<a
					class="btn btn-sm"
					class:btn-active={isSplitpaneVariant}
					href="/tabbed-layout/splitpane-tabbed-collapse"
				>
					Splitpane tabbed-collapse route
				</a>
			</nav>
		</header>

		<div class="tabbed-layout-player-shell">
			{#if isSplitpaneVariant}
				<pie-section-player-splitpane
					assessment-id="section-demos.tabbed-layout"
					{sectionId}
					{attemptId}
					section={data.section}
					env={pieEnv}
					narrow-layout-breakpoint={1500}
					split-pane-collapse-strategy="tabbed"
					show-toolbar={true}
				></pie-section-player-splitpane>
			{:else}
				<pie-section-player-tabbed
					assessment-id="section-demos.tabbed-layout"
					{sectionId}
					{attemptId}
					section={data.section}
					env={pieEnv}
					show-toolbar={true}
				></pie-section-player-tabbed>
			{/if}
		</div>
	</section>
</main>

<style>
	.tabbed-layout-page {
		height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
	}

	.tabbed-layout-card {
		width: min(100%, 88rem);
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--color-base-100);
		border-radius: 0.75rem;
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		min-height: 0;
	}

	.tabbed-layout-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tabbed-layout-links {
		display: flex;
		gap: 0.5rem;
	}

	.tabbed-layout-player-shell {
		flex: 1;
		min-height: 0;
		margin-top: 0.75rem;
	}

	:global(pie-section-player-splitpane),
	:global(pie-section-player-tabbed) {
		display: flex;
		height: 100%;
		min-height: 0;
	}
</style>
