<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import {
		CompositeInstrumentationProvider,
		DebugPanelInstrumentationProvider,
		NewRelicInstrumentationProvider
	} from '@pie-players/pie-players-shared';
	import ScoringPanel from '$lib/components/ScoringPanel.svelte';
	import { demoHeadingName } from '$lib/utils/demo-heading-name';
	import '@pie-players/pie-item-player';
	import {
		config as configStore,
		env as envStore,
		score as scoreStore,
		session as sessionStore,
		updateScore,
		updateSession,
	} from '$lib/stores/demo-state';

	let { data } = $props();

	const demoHeading = $derived(demoHeadingName(data.demo?.name));

	let playerEl: any = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;
	let lastSession: any = null;
	let selectedPlayerType = $state<'iife' | 'esm' | 'preloaded'>('iife');
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let loadedPreloadedBundleKey = $state<string | null>(null);
	let esmLoadPending = $state(false);
	let esmLoadAttempt = 0;
	let esmLoadTimer: ReturnType<typeof setTimeout> | null = null;
	const ESM_LOAD_TIMEOUT_MS = 20_000;
	const instrumentationProvider = new CompositeInstrumentationProvider([
		new NewRelicInstrumentationProvider(),
		new DebugPanelInstrumentationProvider()
	]);
	void instrumentationProvider
		.initialize()
		.then(() => {
			instrumentationProvider.trackMetric('demo.instrumentation.bootstrap', 1, {
				app: 'item-demos',
				demo: 'delivery',
				category: 'demo'
			});
		})
		.catch(() => {});

	$effect(() => {
		const queryPlayer = $page.url.searchParams.get('player');
		if (queryPlayer === 'iife' || queryPlayer === 'esm' || queryPlayer === 'preloaded') {
			selectedPlayerType = queryPlayer;
		} else {
			selectedPlayerType = 'iife';
		}
	});

	function clearEsmLoadTimer() {
		if (!esmLoadTimer) return;
		clearTimeout(esmLoadTimer);
		esmLoadTimer = null;
	}

	function startEsmLoadWatchdog() {
		clearEsmLoadTimer();
		const attemptId = ++esmLoadAttempt;
		esmLoadPending = true;
		esmLoadTimer = setTimeout(() => {
			if (attemptId !== esmLoadAttempt || selectedPlayerType !== 'esm') return;
			esmLoadPending = false;
		}, ESM_LOAD_TIMEOUT_MS);
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
					playerEl.loaderConfig = {
						trackPageActions: true,
						instrumentationProvider
					};
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
		if (selectedPlayerType !== 'esm') {
			esmLoadPending = false;
			clearEsmLoadTimer();
		}
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

	$effect(() => {
		const currentConfig = $configStore;
		const currentEnv = $envStore;
		const currentPlayer = selectedPlayerType;
		const currentPlayerEl = playerEl;
		if (currentPlayer !== 'esm') return;
		if (!currentConfig || !currentEnv || !currentPlayerEl) return;
		startEsmLoadWatchdog();
		return () => {
			clearEsmLoadTimer();
		};
	});

	// Listen for session changes
	$effect(() => {
		if (playerEl) {
			const sessionHandler = (e: CustomEvent) => {
				const detail = e.detail ?? {};
				if (detail.session) {
					updateSession(detail.session);
				}
				if (detail.score) {
					updateScore(detail.score);
				}
			};
			const loadCompleteHandler = () => {
				if (selectedPlayerType !== 'esm') return;
				esmLoadPending = false;
				clearEsmLoadTimer();
			};
			const playerErrorHandler = () => {
				if (selectedPlayerType !== 'esm') return;
				esmLoadPending = false;
				clearEsmLoadTimer();
			};
			playerEl.addEventListener('session-changed', sessionHandler);
			playerEl.addEventListener('load-complete', loadCompleteHandler as EventListener);
			playerEl.addEventListener('player-error', playerErrorHandler as EventListener);
			return () => {
				playerEl?.removeEventListener('session-changed', sessionHandler);
				playerEl?.removeEventListener('load-complete', loadCompleteHandler as EventListener);
				playerEl?.removeEventListener('player-error', playerErrorHandler as EventListener);
			};
		}
	});
</script>

<svelte:head>
	<title>{demoHeading} - Delivery</title>
</svelte:head>

<div class="space-y-6">
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
			{#if selectedPlayerType === 'esm' && esmLoadPending}
				<div class="text-base-content/60 mt-2">Loading item player using ESM strategy...</div>
			{/if}
			{#if preloadedError}
				<div class="text-error mt-2">Preloaded bundle failed: {preloadedError}</div>
			{/if}
		</div>
	</div>

	{#if $scoreStore}
		<ScoringPanel score={$scoreStore} />
	{/if}
</div>
