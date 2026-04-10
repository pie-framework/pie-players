<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import {
		CompositeInstrumentationProvider,
		DebugPanelInstrumentationProvider,
		NewRelicInstrumentationProvider
	} from '@pie-players/pie-players-shared';
	import { BundleType, IifePieLoader } from '@pie-players/pie-players-shared/pie';
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

	function buildBundleKey(packages: string[]): string {
		return [...packages]
			.filter((pkg) => typeof pkg === "string" && pkg.length > 0)
			.sort()
			.join("+");
	}

	const latestResolutionCache = new Map<string, Promise<string>>();

	async function resolveLatestPackageSpec(spec: string): Promise<string> {
		if (!spec.endsWith("@latest")) return spec;
		const atIndex = spec.lastIndexOf("@");
		if (atIndex <= 0) return spec;
		const packageName = spec.slice(0, atIndex);
		if (!latestResolutionCache.has(packageName)) {
			const promise = (async () => {
				const response = await fetch(
					`/api/packages?package=${encodeURIComponent(packageName)}&search=0`,
				);
				if (!response.ok) return spec;
				const versions = (await response.json()) as unknown;
				if (!Array.isArray(versions)) return spec;
				const concreteVersion = versions.find(
					(version): version is string =>
						typeof version === "string" &&
						version !== "latest" &&
						!version.includes("-"),
				);
				if (concreteVersion) {
					return `${packageName}@${concreteVersion}`;
				}
				const fallbackVersion = versions.find(
					(version): version is string =>
						typeof version === "string" && version !== "latest",
				);
				return fallbackVersion ? `${packageName}@${fallbackVersion}` : spec;
			})().catch(() => spec);
			latestResolutionCache.set(packageName, promise);
		}
		return latestResolutionCache.get(packageName)!;
	}

	function buildPreloadedVersionMap(specs: string[]): Record<string, string> {
		const map: Record<string, string> = {};
		for (const spec of specs) {
			const atIndex = spec.lastIndexOf("@");
			if (atIndex <= 0) continue;
			const packageName = spec.slice(0, atIndex);
			map[packageName] = spec;
		}
		return map;
	}

	async function resolveElementPackagesForPreload(
		elements: Record<string, string>,
	): Promise<Record<string, string>> {
		const resolvedEntries = await Promise.all(
			Object.entries(elements).map(async ([tagName, packageSpec]) => {
				const resolvedSpec = await resolveLatestPackageSpec(String(packageSpec));
				return [tagName, resolvedSpec] as const;
			}),
		);
		return Object.fromEntries(resolvedEntries);
	}

	function normalizeTagWithVersion(tagName: string, packageSpec: string): string {
		const atIndex = packageSpec.lastIndexOf("@");
		if (atIndex <= 0) return tagName;
		const version = packageSpec.slice(atIndex + 1).trim();
		if (!version || tagName.includes("--version-")) return tagName;
		return `${tagName}--version-${version.replace(/\./g, "-")}`;
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
		preloadedReady = false;
		void (async () => {
			try {
				const resolvedElements = await resolveElementPackagesForPreload(
					(currentConfig?.elements || {}) as Record<string, string>,
				);
				const resolvedPackages = Object.values(resolvedElements);
				const bundleKey = buildBundleKey(resolvedPackages);
				if (loadedPreloadedBundleKey === bundleKey) {
					preloadedReady = true;
					return;
				}
				const globalPreloadedMap = (window as any).PIE_PRELOADED_ELEMENTS ?? {};
				(window as any).PIE_PRELOADED_ELEMENTS = {
					...globalPreloadedMap,
					...buildPreloadedVersionMap(resolvedPackages)
				};
				const preloadedElements = Object.fromEntries(
					Object.entries(resolvedElements).map(([tagName, packageSpec]) => [
						normalizeTagWithVersion(tagName, packageSpec),
						packageSpec,
					]),
				);
				const preloader = new IifePieLoader({
					bundleHost: 'https://proxy.pie-api.com/bundles/',
				});
				await preloader.load(
					{
						elements: preloadedElements,
					},
					document,
					BundleType.clientPlayer,
					true,
				);
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
