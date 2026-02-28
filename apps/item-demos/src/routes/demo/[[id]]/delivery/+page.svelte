<script lang="ts">
	import { page } from '$app/stores';
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
	let controlsForm: HTMLFormElement | null = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;
	let lastSessionSignature = '';
	let mode = $state<'gather' | 'view' | 'evaluate'>('gather');
	let role = $state<'student' | 'instructor'>('student');

	function normalizeSessionContainer(input: any): { id: string; data: any[] } {
		if (input && typeof input === 'object' && Array.isArray(input.data)) {
			return {
				id: typeof input.id === 'string' ? input.id : '',
				data: input.data,
			};
		}
		if (Array.isArray(input)) {
			return { id: '', data: input };
		}
		if (input && typeof input === 'object') {
			return { id: '', data: [input] };
		}
		return { id: '', data: [] };
	}

	$effect(() => {
		if (untrack(() => mode) !== $modeStore) {
			mode = $modeStore;
		}
	});

	$effect(() => {
		if (untrack(() => role) !== $roleStore) {
			role = $roleStore;
		}
	});

	function submitControls() {
		controlsForm?.requestSubmit();
	}

	function handleModeChange(nextMode: 'gather' | 'view' | 'evaluate') {
		mode = nextMode;
		submitControls();
	}

	function handleRoleChange(nextRole: 'student' | 'instructor') {
		role = nextRole;
		// Evaluate mode is instructor-only.
		if (role !== 'instructor' && mode === 'evaluate') {
			mode = 'gather';
		}
		submitControls();
	}

	// Set properties imperatively when config or env changes
	$effect(() => {
		const currentConfig = $configStore;
		const currentEnv = $envStore;
		const currentSession = normalizeSessionContainer($sessionStore);
		const currentSessionSignature = JSON.stringify(currentSession);

		if (playerEl && currentConfig && currentEnv && currentSession) {
			if (
				currentConfig !== lastConfig ||
				currentEnv !== lastEnv ||
				currentSessionSignature !== lastSessionSignature
			) {
				untrack(() => {
					playerEl.config = currentConfig;
					playerEl.env = currentEnv;
					playerEl.session = currentSession;
					playerEl.loaderOptions = { bundleHost: 'https://proxy.pie-api.com/bundles/' };
				});

				lastConfig = currentConfig;
				lastEnv = currentEnv;
				lastSessionSignature = currentSessionSignature;
			}
		}
	});

	// Listen for session changes
	$effect(() => {
		if (playerEl) {
			const handler = (e: CustomEvent) => {
				const detail = e.detail ?? {};
				// Use wrapper payload shape; ignore native events that don't include session container.
				if (detail.session) {
					updateSession(normalizeSessionContainer(detail.session));
				}
				if (detail.score) {
					updateScore(detail.score);
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
				<form
					bind:this={controlsForm}
					method="GET"
					action={$page.url.pathname}
					data-sveltekit-reload
					class="space-y-3"
				>
					<ModeSelector bind:mode {role} name="mode" onChange={handleModeChange} />
					<RoleSelector bind:role name="role" onChange={handleRoleChange} />
				</form>
			</div>
		</div>

		<SessionPanel session={$sessionStore} />

		{#if $scoreStore}
			<ScoringPanel score={$scoreStore} />
		{/if}
	</div>
</div>
