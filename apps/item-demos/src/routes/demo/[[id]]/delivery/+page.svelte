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
	let lastSession: any = null;
	let mode = $state<'gather' | 'view' | 'evaluate'>('gather');
	let role = $state<'student' | 'instructor'>('student');
	let selectedPlayerType = $state<'iife' | 'esm' | 'preloaded'>('iife');
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let loadedPreloadedBundleKey = $state<string | null>(null);

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

	$effect(() => {
		const queryPlayer = $page.url.searchParams.get('player');
		if (queryPlayer === 'iife' || queryPlayer === 'esm' || queryPlayer === 'preloaded') {
			selectedPlayerType = queryPlayer;
		} else {
			selectedPlayerType = 'iife';
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

	async function fetchBundleWithRetry(bundleUrl: string) {
		let attempt = 0;
		const maxAttempts = 12;
		while (attempt < maxAttempts) {
			attempt += 1;
			const response = await fetch(bundleUrl);
			if (response.ok) return response;
			if (response.status === 503) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}
			throw new Error(`Bundle preload failed: ${response.status}`);
		}
		throw new Error('Bundle preload timed out after retries');
	}

	// Set properties imperatively when config or env changes
	$effect(() => {
		const currentConfig = $configStore;
		const currentEnv = $envStore;
		const currentSession = $sessionStore;

		if (playerEl && currentConfig && currentEnv && currentSession) {
			if (
				currentConfig !== lastConfig ||
				currentEnv !== lastEnv ||
				currentSession !== lastSession
			) {
				untrack(() => {
					playerEl.config = currentConfig;
					playerEl.env = currentEnv;
					playerEl.session = currentSession;
					playerEl.loaderOptions = { bundleHost: 'https://proxy.pie-api.com/bundles/' };
				});

				lastConfig = currentConfig;
				lastEnv = currentEnv;
				lastSession = currentSession;
			}
		}
	});

	$effect(() => {
		preloadedReady = selectedPlayerType !== 'preloaded';
		preloadedError = null;
		if (selectedPlayerType !== 'preloaded') return;
		const currentConfig = $configStore;
		const elementPackages = Object.values(currentConfig?.elements || {}) as string[];
		if (!elementPackages.length) {
			preloadedError = 'No elements were found to preload';
			return;
		}
		const bundleKey = elementPackages.join('+');
		if (loadedPreloadedBundleKey === bundleKey) {
			preloadedReady = true;
			return;
		}
		preloadedReady = false;
		void (async () => {
			try {
				const bundleUrl = `https://proxy.pie-api.com/bundles/${bundleKey}/player.js`;
				const response = await fetchBundleWithRetry(bundleUrl);
				const bundleJs = await response.text();
				const script = document.createElement('script');
				script.type = 'text/javascript';
				script.text = bundleJs;
				document.head.appendChild(script);
				loadedPreloadedBundleKey = bundleKey;
				preloadedReady = true;
			} catch (error) {
				preloadedError = error instanceof Error ? error.message : String(error);
			}
		})();
	});

	// Listen for session changes
	$effect(() => {
		if (playerEl) {
			const handler = (e: CustomEvent) => {
				const detail = e.detail ?? {};
				if (detail.session) {
					updateSession(detail.session);
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
			{#if $configStore && $envStore && (selectedPlayerType !== 'preloaded' || preloadedReady)}
				{#key `${$configStore?.markup || ''}-${$envStore?.mode || 'gather'}-${$envStore?.role || 'student'}-${selectedPlayerType}`}
					<pie-item-player
						bind:this={playerEl}
						strategy={selectedPlayerType}
					></pie-item-player>
				{/key}
			{:else if !$configStore || !$envStore}
				<div class="text-base-content/60">Loading item configuration...</div>
			{/if}
			{#if selectedPlayerType === 'preloaded' && !preloadedReady}
				<div class="text-base-content/60 mt-2">Preloading item bundle...</div>
			{/if}
			{#if preloadedError}
				<div class="text-error mt-2">Preloaded bundle failed: {preloadedError}</div>
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
					<input type="hidden" name="player" value={selectedPlayerType} />
				</form>
			</div>
		</div>

		<SessionPanel session={$sessionStore} />

		{#if $scoreStore}
			<ScoringPanel score={$scoreStore} />
		{/if}
	</div>
</div>
