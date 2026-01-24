<script lang="ts">
	
	import { base } from '$app/paths';
import { page } from '$app/stores';
	import { A11Y_FIXTURES } from '$lib/a11y/fixtures';
	import NavigationSmokeFixture from '$lib/a11y/fixtures/NavigationSmokeFixture.svelte';
	import SimpleFormFixture from '$lib/a11y/fixtures/SimpleFormFixture.svelte';

	const fixtures = {
		'simple-form': SimpleFormFixture,
		'navigation-smoke': NavigationSmokeFixture
	} as const;

	const id = $derived($page.params.id ?? '');
	const Fixture = $derived((fixtures as any)[id] ?? null);
	const meta = $derived(A11Y_FIXTURES.find((f) => f.id === id));
</script>

<svelte:head>
	<title>PIE Players - A11y: {meta?.name ?? id}</title>
</svelte:head>

<div class="container mx-auto px-6 py-6">
	<div class="breadcrumbs text-sm mb-4">
		<ul>
			<li><a href={`${base}/a11y-components/`}>A11y fixtures</a></li>
			<li><span>{meta?.name ?? id}</span></li>
		</ul>
	</div>

	{#if !Fixture}
		<div class="alert alert-error">Unknown fixture: {id}</div>
	{:else}
		<Fixture />
	{/if}
</div>


