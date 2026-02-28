<script lang="ts">
	import { getContext, onMount, untrack } from 'svelte';
	import ModeSelector from '$lib/components/ModeSelector.svelte';
	import RoleSelector from '$lib/components/RoleSelector.svelte';
	import ScoringPanel from '$lib/components/ScoringPanel.svelte';
	import SessionPanel from '$lib/components/SessionPanel.svelte';

	let { data } = $props();
	const demoState: any = getContext('demo-state');

	let playerEl: any = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;

	onMount(async () => {
		await import('@pie-players/pie-item-player');
	});

	// Set properties imperatively when config or env changes
	$effect(() => {
		const currentConfig = demoState.config;
		const currentEnv = demoState.env;

		if (playerEl && currentConfig && currentEnv) {
			if (currentConfig !== lastConfig || currentEnv !== lastEnv) {
				untrack(() => {
					playerEl.config = currentConfig;
					playerEl.env = currentEnv;
					playerEl.loaderOptions = { bundleHost: 'https://proxy.pie-api.com/bundles/' };
				});

				lastConfig = currentConfig;
				lastEnv = currentEnv;
			}
		}
	});

	// Listen for session changes
	$effect(() => {
		if (playerEl) {
			const handler = (e: CustomEvent) => {
				demoState.session = e.detail.session;
				if (e.detail.score) {
					demoState.score = e.detail.score;
				}
			};
			playerEl.addEventListener('session-changed', handler);
			return () => playerEl.removeEventListener('session-changed', handler);
		}
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Delivery</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
	<!-- Left: Player -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			{#key `${demoState.config.markup}-${demoState.env.mode}-${demoState.env.role}`}
				<pie-item-player
					bind:this={playerEl}
					strategy="iife"
				></pie-item-player>
			{/key}
		</div>
	</div>

	<!-- Right: Controls -->
	<div class="space-y-4">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h3 class="card-title">Controls</h3>
				<ModeSelector bind:mode={demoState.mode} />
				<RoleSelector bind:role={demoState.role} />
			</div>
		</div>

		<SessionPanel session={demoState.session} />

		{#if demoState.score}
			<ScoringPanel score={demoState.score} />
		{/if}
	</div>
</div>
