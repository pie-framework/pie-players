<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import '@pie-players/pie-section-player-tools-session-debugger';
	import '@pie-players/pie-section-player-tools-pnp-debugger';
	import '@pie-players/pie-theme';
	import '@pie-players/pie-theme/components.css';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';

	let { data }: { data: PageData } = $props();

	const PLAYER_OPTIONS = ['iife', 'esm', 'preloaded'] as const;
	const MODE_OPTIONS = ['candidate', 'scorer'] as const;
	const LAYOUT_OPTIONS = ['splitpane', 'vertical'] as const;
	const DEMO_ASSESSMENT_ID = 'section-demos-assessment';
	const ATTEMPT_QUERY_PARAM = 'attempt';
	const ATTEMPT_STORAGE_KEY = 'pie:section-demos:attempt-id';
const DAISY_THEME_STORAGE_KEY = 'pie:section-demos:daisy-theme';
const TOOLKIT_SCHEME_STORAGE_KEY = 'pie-color-scheme';
const DEFAULT_DAISY_THEME = 'light';
const DAISY_DEFAULT_THEMES = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset',
	'caramellatte',
	'abyss',
	'silk'
] as const;

	function getUrlEnumParam<T extends string>(key: string, options: readonly T[], fallback: T): T {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		return value && options.includes(value as T) ? (value as T) : fallback;
	}

	function createAttemptId() {
		return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function getOrCreateAttemptId(): string {
		if (!browser) return 'attempt-ssr';
		const params = new URLSearchParams(window.location.search);
		const fromUrl = params.get(ATTEMPT_QUERY_PARAM);
		if (fromUrl) {
			window.localStorage.setItem(ATTEMPT_STORAGE_KEY, fromUrl);
			return fromUrl;
		}
		const stored = window.localStorage.getItem(ATTEMPT_STORAGE_KEY);
		if (stored) return stored;
		const next = createAttemptId();
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, next);
		return next;
	}

	let selectedPlayerType = $state(getUrlEnumParam('player', PLAYER_OPTIONS, 'iife'));
	let roleType = $state<'candidate' | 'scorer'>(getUrlEnumParam('mode', MODE_OPTIONS, 'candidate'));
	let layoutType = $state<'splitpane' | 'vertical'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane')
	);
let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
let isThemeSyncing = $state(false);
	let attemptId = $state(getOrCreateAttemptId());
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let showTtsPanel = $state(false);
	let toolkitCoordinator: any = $state(null);
	let sessionDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let loadedPreloadedBundleKey = $state<string | null>(null);
	const toolkitToolsConfig = {
		providers: {
			calculator: {
				provider: 'desmos',
				authFetcher: fetchDesmosAuthConfig
			}
		},
		placement: {
			section: ['theme', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
			item: ['calculator', 'textToSpeech', 'answerEliminator'],
			passage: ['textToSpeech']
		}
	};

function resolvePieThemeHost(): HTMLElement | null {
	if (!browser) return null;
	return (
		(document.querySelector('pie-theme[scope="document"]') as HTMLElement | null) ||
		(document.querySelector('pie-theme') as HTMLElement | null)
	);
}

function withThemeSyncGuard(run: () => void) {
	isThemeSyncing = true;
	try {
		run();
	} finally {
		Promise.resolve().then(() => {
			isThemeSyncing = false;
		});
	}
}

function applyDaisyTheme(theme: string) {
	if (!browser) return;
	const nextTheme = (theme || DEFAULT_DAISY_THEME).trim() || DEFAULT_DAISY_THEME;
	const pieThemeHost = resolvePieThemeHost();
	if (pieThemeHost) {
		if (pieThemeHost.getAttribute('theme') !== nextTheme) {
			pieThemeHost.setAttribute('theme', nextTheme);
		}
	} else {
		document.documentElement.setAttribute('data-theme', nextTheme);
	}
	selectedDaisyTheme = nextTheme;
	window.localStorage.setItem(DAISY_THEME_STORAGE_KEY, nextTheme);
}

function applyToolkitScheme(scheme: string) {
	if (!browser) return;
	const nextScheme = (scheme || 'default').trim() || 'default';
	const pieThemeHost = resolvePieThemeHost();
	if (pieThemeHost && pieThemeHost.getAttribute('scheme') !== nextScheme) {
		pieThemeHost.setAttribute('scheme', nextScheme);
	}
	window.localStorage.setItem(TOOLKIT_SCHEME_STORAGE_KEY, nextScheme);
}

function handleDaisyThemeSelection(theme: string) {
	if (!browser) return;
	withThemeSyncGuard(() => {
		applyDaisyTheme(theme);
		// Route external-theme choice through canonical toolkit backend.
		applyToolkitScheme('default');
	});
}

	let resolvedSectionForPlayer = $derived.by(() => {
		const section = data.section;
		if (!section) return section;
		const sectionAny = section as any;
		const hasExplicitPnp = Boolean(
			sectionAny?.personalNeedsProfile || sectionAny?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile()
		};
	});
	let sessionPanelSectionId = $derived(
		resolvedSectionForPlayer?.identifier || `section-${data?.demo?.id || 'default'}`
	);
	let sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));
let isTtsSsmlDemo = $derived(
	(data?.demo?.id || '').toLowerCase() === 'tts-ssml' ||
		(sessionPanelSectionId || '').toLowerCase().includes('tts-ssml')
);
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	function handleToolkitReady(event: Event) {
		const detail = (event as CustomEvent<{ coordinator?: any }>).detail;
		toolkitCoordinator = detail?.coordinator || null;
		// Demo: inline hooks show how toolkit behavior can be customized in code.
		toolkitCoordinator?.setHooks?.({
			onError: (error, context) => {
				console.error('[Demo] Toolkit hook error:', context, error);
			}
		} satisfies ToolkitCoordinatorHooks);
	}

	function buildDemoHref(targetMode: 'candidate' | 'scorer') {
		if (!browser) return '';
		const url = new URL(window.location.href);
		url.searchParams.set('mode', targetMode);
		url.searchParams.set('player', selectedPlayerType);
		url.searchParams.set('layout', layoutType);
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		return url.toString();
	}

	let candidateHref = $derived(buildDemoHref('candidate'));
	let scorerHref = $derived(buildDemoHref('scorer'));

	function collectElementPackages(sectionData: unknown): string[] {
		const packages = new Set<string>();
		const seen = new WeakSet<object>();

		function walk(value: unknown) {
			if (!value || typeof value !== 'object') return;
			if (seen.has(value as object)) return;
			seen.add(value as object);

			const valueAny = value as any;
			const elements = valueAny?.config?.elements;
			if (elements && typeof elements === 'object') {
				for (const pkg of Object.values(elements)) {
					if (typeof pkg === 'string' && pkg.length > 0) packages.add(pkg);
				}
			}

			if (Array.isArray(valueAny)) {
				for (const entry of valueAny) walk(entry);
				return;
			}

			for (const nested of Object.values(valueAny)) {
				walk(nested);
			}
		}

		walk(sectionData);
		return [...packages].sort();
	}

	$effect(() => {
		preloadedReady = selectedPlayerType !== 'preloaded';
		preloadedError = null;
		if (selectedPlayerType !== 'preloaded') return;
		const packages = collectElementPackages(resolvedSectionForPlayer);
		if (!packages.length) {
			preloadedError = 'No element packages were found to preload';
			return;
		}
		const bundleKey = packages.join('+');
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
		if (!browser || !attemptId) return;
		const url = new URL(window.location.href);
		const existingAttemptId = url.searchParams.get(ATTEMPT_QUERY_PARAM);
		const existingLayout = url.searchParams.get('layout');
		if (existingAttemptId === attemptId && existingLayout === layoutType) return;
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		url.searchParams.set('layout', layoutType);
		window.history.replaceState({}, '', url.toString());
	});

	$effect(() => {
		if (!browser) return;

		const storedDaisyTheme =
			window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME;
		applyDaisyTheme(storedDaisyTheme);
	});

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

	function wireCloseListener(target: any, onClose: () => void) {
		if (!target) return;
		target.addEventListener('close', onClose as EventListener);
		return () => {
			target.removeEventListener('close', onClose as EventListener);
		};
	}

	$effect(() => {
		if (!sessionDebuggerElement) return;
		sessionDebuggerElement.toolkitCoordinator = toolkitCoordinator;
		sessionDebuggerElement.sectionId = sessionPanelSectionId;
		sessionDebuggerElement.attemptId = attemptId;
	});

	$effect(() => {
		if (!browser) return;
		const triggerSessionPanelRefresh = () => {
			sessionDebuggerElement?.refreshFromHost?.();
		};
		const persistSectionSession = () => {
			// Keep localStorage snapshots current so reload-based mode switches restore latest answers.
			toolkitCoordinator
				?.getSectionController?.({ sectionId: sessionPanelSectionId, attemptId })
				?.persist?.();
		};
		document.addEventListener('item-session-changed', triggerSessionPanelRefresh as EventListener, true);
		document.addEventListener('session-changed', triggerSessionPanelRefresh as EventListener, true);
		document.addEventListener('item-session-changed', persistSectionSession as EventListener, true);
		document.addEventListener('session-changed', persistSectionSession as EventListener, true);
		return () => {
			document.removeEventListener(
				'item-session-changed',
				triggerSessionPanelRefresh as EventListener,
				true
			);
			document.removeEventListener(
				'session-changed',
				triggerSessionPanelRefresh as EventListener,
				true
			);
			document.removeEventListener(
				'item-session-changed',
				persistSectionSession as EventListener,
				true
			);
			document.removeEventListener(
				'session-changed',
				persistSectionSession as EventListener,
				true
			);
		};
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		pnpDebuggerElement.sectionData = resolvedSectionForPlayer;
		pnpDebuggerElement.roleType = roleType;
		pnpDebuggerElement.toolkitCoordinator = toolkitCoordinator;
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		return wireCloseListener(sessionDebuggerElement, () => {
			showSessionPanel = false;
		});
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		return wireCloseListener(pnpDebuggerElement, () => {
			showPnpPanel = false;
		});
	});

	async function resetSessions() {
		try {
			await toolkitCoordinator?.disposeSectionController?.({
				sectionId: sessionPanelSectionId,
				attemptId,
				clearPersistence: true,
				persistBeforeDispose: false
			});
		} catch (e) {
			console.warn('[Demo] Failed to clear section-controller persistence during reset:', e);
		}
		if (browser) {
			// Start a new attempt namespace so persisted state does not bleed across resets.
			const nextAttemptId = createAttemptId();
			window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttemptId);
			attemptId = nextAttemptId;
			window.location.reload();
		}
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Direct Layout</title>
</svelte:head>

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme="light">
	<div class="direct-layout">
		<DemoMenuBar
			{roleType}
			{layoutType}
			{candidateHref}
			{scorerHref}
			{showSessionPanel}
			{showSourcePanel}
			{showPnpPanel}
			{showTtsPanel}
			selectedDaisyTheme={selectedDaisyTheme}
			daisyThemes={[...DAISY_DEFAULT_THEMES]}
			onReset={() => void resetSessions()}
			onSetSplitpaneLayout={() => (layoutType = 'splitpane')}
			onSetVerticalLayout={() => (layoutType = 'vertical')}
			onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
			onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
			onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
			onToggleTtsPanel={() => (showTtsPanel = !showTtsPanel)}
			onSelectDaisyTheme={handleDaisyThemeSelection}
		/>

		{#if isTtsSsmlDemo}
			<aside class="pie-demo-ssml-cues" aria-hidden="true" inert>
				<h3 class="pie-demo-ssml-cues-title">SSML cues and tips</h3>
				<ul class="pie-demo-ssml-cues-list">
					<li>
						<strong>Passage + Q1:</strong> includes SSML (`speak`, `break`, `prosody`, `emphasis`,
						`phoneme`) with visible plain-text fallback.
					</li>
					<li>
						<strong>Q2:</strong> intentionally plain text only to compare fallback behavior.
					</li>
					<li>
						<strong>Q3:</strong> includes AWS-specific SSML tags (`aws-break`, `aws-emphasis`,
						`aws-w`, `aws-say-as`) that are most meaningful with Polly.
					</li>
					<li>
						Use the <strong>TTS settings</strong> button (top-right) to switch backends and compare
						output.
					</li>
					<li>
						Use the dialog <strong>Preview</strong> area to test plain text vs SSML directly before
						reading full content.
					</li>
				</ul>
			</aside>
		{/if}

		{#if selectedPlayerType === 'preloaded' && !preloadedReady}
			<div class="preload-status">Preloading section item bundles...</div>
		{:else if preloadedError}
			<div class="preload-status error">Preloaded bundle failed: {preloadedError}</div>
		{:else if layoutType === 'vertical'}
			<pie-section-player-vertical
				assessment-id={DEMO_ASSESSMENT_ID}
				section-id={sessionPanelSectionId}
				attempt-id={attemptId}
				player-type={selectedPlayerType}
				lazy-init={true}
				tools={toolkitToolsConfig}
				section={resolvedSectionForPlayer}
				env={pieEnv}
				toolbar-position="right"
				show-toolbar={true}
				ontoolkit-ready={handleToolkitReady}
			></pie-section-player-vertical>
		{:else}
			<pie-section-player-splitpane
				assessment-id={DEMO_ASSESSMENT_ID}
				section-id={sessionPanelSectionId}
				attempt-id={attemptId}
				player-type={selectedPlayerType}
				lazy-init={true}
				tools={toolkitToolsConfig}
				section={resolvedSectionForPlayer}
				env={pieEnv}
				toolbar-position="right"
				show-toolbar={true}
				ontoolkit-ready={handleToolkitReady}
			></pie-section-player-splitpane>
		{/if}
	</div>
</pie-theme>

<DemoOverlays
	{toolkitCoordinator}
	{showSessionPanel}
	{showSourcePanel}
	{showPnpPanel}
	{showTtsPanel}
	{sourcePanelJson}
	onCloseSourcePanel={() => (showSourcePanel = false)}
	onCloseTtsPanel={() => (showTtsPanel = false)}
	bind:sessionDebuggerElement
	bind:pnpDebuggerElement
/>

<style>
	.direct-layout {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}

	:global(pie-section-player-splitpane),
	:global(pie-section-player-vertical) {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}

	.preload-status {
		padding: 0.75rem 1rem;
		color: var(--color-base-content);
		opacity: 0.8;
	}

	.preload-status.error {
		color: var(--color-error);
		opacity: 1;
	}

	.pie-demo-ssml-cues {
		margin: 0.6rem 1rem 0;
		padding: 0.7rem 0.85rem;
		border: 1px solid color-mix(in srgb, var(--color-info) 40%, var(--color-base-300));
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--color-info) 10%, var(--color-base-100));
		color: var(--color-base-content);
		font-size: 0.82rem;
	}

	.pie-demo-ssml-cues-title {
		margin: 0 0 0.35rem;
		font-size: 0.84rem;
		font-weight: 700;
	}

	.pie-demo-ssml-cues-list {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.2rem;
	}
</style>
