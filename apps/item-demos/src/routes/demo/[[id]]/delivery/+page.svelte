<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import {
		CompositeInstrumentationProvider,
		DEFAULT_BUNDLE_HOST,
		DebugPanelInstrumentationProvider,
		NewRelicInstrumentationProvider
	} from '@pie-players/pie-players-shared';
	import {
		BUNDLED_LOCALES,
		createPieI18n,
		loadBundledCatalog,
		type I18nServiceApi
	} from '@pie-players/pie-players-shared/i18n';
	import {
		GENERATED_LOCALES,
		loadGeneratedCatalog
	} from '@pie-players/pie-i18n-generated';
	import { preloadDemoElements } from '@pie-players/demo-ui/preloaded';
	import ScoringPanel from '#lib/components/ScoringPanel.svelte';
	import { demoHeadingName } from '#lib/utils/demo-heading-name.js';
	import '@pie-players/pie-item-player';
	import {
		config as configStore,
		env as envStore,
		score as scoreStore,
		session as sessionStore,
		updateScore,
		updateSession,
	} from '#lib/stores/demo-state.js';

	let { data } = $props();

	const demoHeading = $derived(demoHeadingName(data.demo?.name));

	let playerEl: any = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;
	let lastSession: any = null;

	// The interface locale this delivery was asked to render in (`?locale=ar`):
	// the one page where a standalone item player demonstrates the
	// interface-locale contract. The attribute names the locale; the host —
	// here the demo — composes the provider the element cannot know, the
	// generated tier's README wiring: bundled catalogs first, the optional
	// generated tier behind them. No `locale` param, no provider, no
	// attribute: the page renders exactly what it rendered before.
	const requestedLocale = $derived(page.url.searchParams.get('locale') || '');
	const demoI18n: I18nServiceApi | null = $derived(
		requestedLocale
			? createPieI18n({
					availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
					loadCatalog: (locale) =>
						loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale))
				})
			: null
	);
	let selectedPlayerType = $state<'iife' | 'esm' | 'preloaded'>('iife');
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let preloadAttempt = 0;
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
		const queryPlayer = page.url.searchParams.get('player');
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
					playerEl.loaderOptions = {
						bundleHost: DEFAULT_BUNDLE_HOST,
						runtimeSupportCheck: 'on'
					};
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
		const elements = ($configStore?.elements ?? {}) as Record<string, string>;
		const attempt = ++preloadAttempt;
		preloadDemoElements([elements])
			.then(() => {
				if (attempt === preloadAttempt) preloadedReady = true;
			})
			.catch((error) => {
				if (attempt !== preloadAttempt) return;
				preloadedError = error instanceof Error ? error.message : String(error);
			});
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

	// Hand the composed provider to the element: `i18n` is a JS-only property
	// (it carries loaders), set like the other imperative props.
	$effect(() => {
		const provider = demoI18n;
		const el = playerEl;
		if (!el || !provider) return;
		untrack(() => {
			el.i18n = provider;
		});
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
						locale={requestedLocale || undefined}
					></pie-item-player>
				{/key}
			{:else if !$configStore || !$envStore}
				<div class="text-base-content/60">Loading item configuration...</div>
			{/if}
			{#if selectedPlayerType === 'preloaded' && !preloadedReady}
				<div class="text-base-content/60 mt-2">Preloading item elements...</div>
			{/if}
			{#if selectedPlayerType === 'esm' && esmLoadPending}
				<div class="text-base-content/60 mt-2">Loading item player using ESM strategy...</div>
			{/if}
			{#if preloadedError}
				<div class="text-error mt-2">Preloading elements failed: {preloadedError}</div>
			{/if}
		</div>
	</div>

	{#if $scoreStore}
		<ScoringPanel score={$scoreStore} />
	{/if}
</div>
