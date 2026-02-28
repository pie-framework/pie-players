<script lang="ts">
	import { untrack } from 'svelte';
	import ModeSelector from '$lib/components/ModeSelector.svelte';
	import RoleSelector from '$lib/components/RoleSelector.svelte';
	import ScoringPanel from '$lib/components/ScoringPanel.svelte';
	import SessionPanel from '$lib/components/SessionPanel.svelte';
	import '@pie-players/pie-item-player';
	import {
		config as configStore,
		env as envStore,
		mode as modeStore,
		role as roleStore,
		score as scoreStore,
		session as sessionStore,
		updateScore,
		updateSession,
	} from '$lib/stores/demo-state';

	let { data } = $props();

	let playerEl: any = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;
	let mode = $state<'gather' | 'view' | 'evaluate'>('gather');
	let role = $state<'student' | 'instructor'>('student');

	$effect(() => {
		if (mode !== $modeStore) {
			mode = $modeStore;
		}
	});

	$effect(() => {
		if (role !== $roleStore) {
			role = $roleStore;
		}
	});

	$effect(() => {
		if ($modeStore !== mode) {
			modeStore.set(mode);
		}
	});

	$effect(() => {
		if ($roleStore !== role) {
			roleStore.set(role);
		}
	});

	// Set properties imperatively when config or env changes
	$effect(() => {
		const currentConfig = $configStore;
		const currentEnv = $envStore;

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
				updateSession(e.detail.session);
				if (e.detail.score) {
					updateScore(e.detail.score);
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
			{#if $configStore && $envStore}
				{#key `${$configStore?.markup || ''}-${$envStore?.mode || 'gather'}-${$envStore?.role || 'student'}`}
					<pie-item-player
						bind:this={playerEl}
						strategy="iife"
					></pie-item-player>
				{/key}
			{:else}
				<div class="text-base-content/60">Loading item configuration...</div>
			{/if}
		</div>
	</div>

	<!-- Right: Controls -->
	<div class="space-y-4">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h3 class="card-title">Controls</h3>
				<ModeSelector bind:mode />
				<RoleSelector bind:role />
			</div>
		</div>

		<SessionPanel session={$sessionStore} />

		{#if $scoreStore}
			<ScoringPanel score={$scoreStore} />
		{/if}
	</div>
</div>
