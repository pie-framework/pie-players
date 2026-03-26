<script lang="ts">
	import { browser } from '$app/environment';
	import {
		CompositeInstrumentationProvider,
		DebugPanelInstrumentationProvider,
		NewRelicInstrumentationProvider
	} from '@pie-players/pie-players-shared';
	import { onDestroy } from 'svelte';
	import {
		createToolsConfig,
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import '@pie-players/pie-tool-answer-eliminator';
	import '@pie-players/pie-tool-annotation-toolbar';
	import '@pie-players/pie-tool-calculator-desmos';
	import '@pie-players/pie-tool-graph';
	import '@pie-players/pie-tool-line-reader';
	import '@pie-players/pie-tool-periodic-table';
	import '@pie-players/pie-tool-protractor';
	import '@pie-players/pie-tool-ruler';
	import '@pie-players/pie-tool-text-to-speech';
	import '@pie-players/pie-tool-theme';
	import DemoRuntimeChrome from '$lib/demo-runtime/components/DemoRuntimeChrome.svelte';
	import {
		applyDaisyTheme,
		applyToolkitScheme,
		ATTEMPT_QUERY_PARAM,
		ATTEMPT_STORAGE_KEY,
		createAttemptId,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
		DEMO_ASSESSMENT_ID,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		PLAYER_OPTIONS
	} from '$lib/demo-runtime/demo-page-helpers';
	import { SECTION_DEMOS_SC_TTS_TOOL_PROVIDER } from '$lib/demo-runtime/section-demos-default-tts';
	import { collectElementPackages, fetchBundleWithRetry } from '$lib/demo-runtime/preload-utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Level 4: CE setup plus controller JS API subscriptions.
	const sectionToolbarTools = 'theme,graph,periodicTable,lineReader,ruler,protractor';
	const sectionInstrumentationProvider = new CompositeInstrumentationProvider([
		new NewRelicInstrumentationProvider(),
		new DebugPanelInstrumentationProvider()
	]);
	void sectionInstrumentationProvider
		.initialize()
		.then(() => {
			sectionInstrumentationProvider.trackMetric('demo.instrumentation.bootstrap', 1, {
				app: 'section-demos',
				demo: 'tts-ssml',
				category: 'demo'
			});
		})
		.catch(() => {});
	const sectionPlayerConfig = {
		loaderConfig: {
			trackPageActions: true,
			instrumentationProvider: sectionInstrumentationProvider
		}
	};
	const bootstrap = (() => {
		try {
		const toolsConfigResult = createToolsConfig({
			source: 'section-demos.tts-ssml',
			strictness: 'error',
			tools: {
				providers: {
					textToSpeech: SECTION_DEMOS_SC_TTS_TOOL_PROVIDER,
					calculator: {
						authFetcher: fetchDesmosAuthConfig
					},
					annotationToolbar: {
						enabled: true
					}
				},
				placement: {
					section: ['theme', 'graph', 'periodicTable', 'lineReader', 'ruler', 'protractor'],
					item: [
						'calculator',
						'textToSpeech',
						'answerEliminator',
						'annotationToolbar'
					],
					passage: ['textToSpeech', 'annotationToolbar']
				}
			}
		});
		if (toolsConfigResult.diagnostics.length > 0) {
			console.warn('[tts-ssml demo] tools config diagnostics:', toolsConfigResult.diagnostics);
		}
		return {
			bootstrapErrorMessage: null as string | null,
			toolkitToolsConfig: toolsConfigResult.config,
			coordinator: new ToolkitCoordinator({
			assessmentId: DEMO_ASSESSMENT_ID,
			toolConfigStrictness: 'error',
			tools: toolsConfigResult.config
		})
		};
	} catch (error) {
		console.error('[tts-ssml demo] config/coordinator bootstrap failed', error);
		return {
			bootstrapErrorMessage: error instanceof Error ? error.message : String(error),
			toolkitToolsConfig: {},
			coordinator: null as ToolkitCoordinator | null
		};
	}
	})();
	const { bootstrapErrorMessage, toolkitToolsConfig, coordinator } = bootstrap;

	let selectedPlayerType = $state(getUrlEnumParam('player', PLAYER_OPTIONS, 'iife'));
	let roleType = $state<'candidate' | 'scorer'>(getUrlEnumParam('mode', MODE_OPTIONS, 'candidate'));
	let layoutType = $state<'splitpane' | 'vertical'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane')
	);
	let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
	let attemptId = $state(getOrCreateAttemptId());
	let playerInstanceKey = $state(0);
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let loadedPreloadedBundleKey = $state<string | null>(null);
	let coordinatorReady = $state(false);
	let playerHostElement: HTMLElement | null = $state(null);
	let unsubscribeController: (() => void) | null = $state(null);

	let showSessionPanel = $state(false);
	let showEventPanel = $state(false);
	let showInstrumentationPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let showTtsPanel = $state(false);
	let showSessionDbPanel = $state(false);
	let sessionDebuggerElement: any = $state(null);
	let eventDebuggerElement: any = $state(null);
	let instrumentationDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);
let customTitlesEnabled = $state(false);

const demoCardTitleFormatter = (context: any) => {
	if (context?.kind === 'item') {
		return `Custom question ${Number(context.itemIndex) + 1}`;
	}
	if (context?.kind === 'passage') {
		return 'Custom passage';
	}
	return context?.defaultTitle;
};

	const DEMO_PERSISTENCE_STORAGE_PREFIX = `pie:section-controller:v1:${DEMO_ASSESSMENT_ID}:`;
	let resolvedSectionForPlayer = $derived.by(() => {
		const section = data.section as any;
		if (!section) return section;
		const hasExplicitPnp = Boolean(
			section?.personalNeedsProfile || section?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile()
		};
	});
	let sessionPanelSectionId = $derived(
		String(
			(resolvedSectionForPlayer as any)?.identifier ||
				`section-${String((data?.demo as any)?.id || 'default')}`
		)
	);
	let sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});

	function handleDaisyThemeSelection(theme: string) {
		if (!browser) return;
		applyDaisyTheme(theme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
		applyToolkitScheme('default');
	}

	function handleToolkitReady(event: Event) {
		const detail = (event as CustomEvent<{ coordinator?: unknown }>).detail;
		if (!coordinator) return;
		if (detail?.coordinator !== coordinator) return;
		coordinatorReady = true;
		coordinator.setHooks({
			onError: (error, context) => {
				console.error('[Demo] Toolkit hook error:', context, error);
			}
		} satisfies ToolkitCoordinatorHooks);
	}

	function wireCloseListener(target: any, onClose: () => void) {
		if (!target) return;
		target.addEventListener('close', onClose as EventListener);
		return () => {
			target.removeEventListener('close', onClose as EventListener);
		};
	}

	function bindControllerSubscription(host: HTMLElement | null) {
		unsubscribeController?.();
		unsubscribeController = null;
		if (!host) return;
		void (async () => {
			const controller = await (host as any).waitForSectionController?.(5000);
			unsubscribeController =
				controller?.subscribe?.((event: any) => {
					if (event?.type === 'section-items-complete-changed') {
						console.debug('[tts-ssml demo] section completion changed:', event.complete);
					}
				}) || null;
		})();
	}

	$effect(() => {
		bindControllerSubscription(playerHostElement);
	});

	onDestroy(() => {
		unsubscribeController?.();
	});

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
		const url = new URL(window.location.href);
		customTitlesEnabled = url.searchParams.get('customTitles') === '1';
	});

	$effect(() => {
		if (!browser) return;
		const storedDaisyTheme =
			window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME;
		applyDaisyTheme(storedDaisyTheme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		sessionDebuggerElement.toolkitCoordinator = coordinator;
		sessionDebuggerElement.sectionId = sessionPanelSectionId;
		sessionDebuggerElement.attemptId = attemptId;
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		pnpDebuggerElement.sectionData = resolvedSectionForPlayer;
		pnpDebuggerElement.roleType = roleType;
		pnpDebuggerElement.toolkitCoordinator = coordinator;
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

	$effect(() => {
		if (!eventDebuggerElement) return;
		return wireCloseListener(eventDebuggerElement, () => {
			showEventPanel = false;
		});
	});

	$effect(() => {
		if (!instrumentationDebuggerElement) return;
		return wireCloseListener(instrumentationDebuggerElement, () => {
			showInstrumentationPanel = false;
		});
	});

	$effect(() => {
		if (!browser) return;
		const triggerSessionPanelRefresh = () => {
			queueMicrotask(() => {
				sessionDebuggerElement?.refreshFromHost?.();
			});
		};
		const persistSectionSession = () => {
			queueMicrotask(() => {
				const controller = coordinator?.getSectionController?.({
					sectionId: sessionPanelSectionId,
					attemptId
				});
				if (!controller?.persist) return;
				void controller.persist();
			});
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
			document.removeEventListener('session-changed', persistSectionSession as EventListener, true);
		};
	});

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	async function resetSessions() {
		try {
			await coordinator?.disposeSectionController?.({
				sectionId: sessionPanelSectionId,
				attemptId,
				clearPersistence: true,
				persistBeforeDispose: false
			});
		} catch (e) {
			console.warn('[Demo] Failed to clear section-controller persistence during reset:', e);
		}
		if (browser) {
			const keysToRemove: string[] = [];
			for (let index = 0; index < window.localStorage.length; index += 1) {
				const key = window.localStorage.key(index);
				if (!key) continue;
				if (key.startsWith(DEMO_PERSISTENCE_STORAGE_PREFIX)) {
					keysToRemove.push(key);
				}
			}
			for (const key of keysToRemove) {
				window.localStorage.removeItem(key);
			}
			window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
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

{#if bootstrapErrorMessage}
	<div class="preload-status error" role="alert" data-testid="demo-bootstrap-error">
		<strong>Demo bootstrap failed before toolkit mount.</strong>
		<pre>{bootstrapErrorMessage}</pre>
	</div>
{:else}
<DemoRuntimeChrome
	{data}
	{roleType}
	{layoutType}
	{selectedPlayerType}
	{attemptId}
	{selectedDaisyTheme}
	sectionId={sessionPanelSectionId}
	{sourcePanelJson}
	toolkitCoordinator={coordinator}
	onReset={() => void resetSessions()}
	onSetSplitpaneLayout={() => (layoutType = 'splitpane')}
	onSetVerticalLayout={() => (layoutType = 'vertical')}
	onSelectDaisyTheme={handleDaisyThemeSelection}
	bind:showSessionPanel
	bind:showEventPanel
	bind:showInstrumentationPanel
	bind:showSourcePanel
	bind:showPnpPanel
	bind:showTtsPanel
	bind:showSessionDbPanel
	bind:sessionDebuggerElement
	bind:eventDebuggerElement
	bind:instrumentationDebuggerElement
	bind:pnpDebuggerElement
>
	{#snippet beforePlayer()}
		<aside class="pie-demo-ssml-cues" aria-hidden="true" inert>
			<h3 class="pie-demo-ssml-cues-title">SSML cues and tips</h3>
			<ul class="pie-demo-ssml-cues-list">
				<li>
					<strong>Passage + Q1:</strong> includes SSML (`speak`, `break`, `prosody`, `emphasis`,
					`phoneme`) with visible plain-text fallback.
				</li>
				<li><strong>Q2:</strong> intentionally plain text only to compare fallback behavior.</li>
				<li>
					<strong>Q3:</strong> includes AWS-specific SSML tags (`aws-break`, `aws-emphasis`, `aws-w`,
					`aws-say-as`) that are most meaningful with Polly.
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
	{/snippet}
	{#if coordinatorReady && coordinator}
		<pie-tool-annotation-toolbar
			enabled={true}
			ttsService={coordinator?.ttsService}
			highlightCoordinator={coordinator?.highlightCoordinator}
		></pie-tool-annotation-toolbar>
	{/if}
	{#key `${sessionPanelSectionId}:${attemptId}:${playerInstanceKey}`}
		{#if selectedPlayerType === 'preloaded' && !preloadedReady}
			<div class="preload-status">Preloading section item bundles...</div>
		{:else if preloadedError}
			<div class="preload-status error">Preloaded bundle failed: {preloadedError}</div>
		{:else if layoutType === 'vertical'}
			<pie-section-player-vertical
				bind:this={playerHostElement}
				assessment-id={DEMO_ASSESSMENT_ID}
				section-id={sessionPanelSectionId}
				attempt-id={attemptId}
				player-type={selectedPlayerType}
				lazy-init={true}
				tools={toolkitToolsConfig}
				player={sectionPlayerConfig}
				section={resolvedSectionForPlayer}
				env={pieEnv}
				coordinator={coordinator}
				toolbar-position="right"
				show-toolbar={true}
				enabled-tools={sectionToolbarTools}
				cardTitleFormatter={customTitlesEnabled ? demoCardTitleFormatter : undefined}
				ontoolkit-ready={handleToolkitReady}
			></pie-section-player-vertical>
		{:else}
			<pie-section-player-splitpane
				bind:this={playerHostElement}
				assessment-id={DEMO_ASSESSMENT_ID}
				section-id={sessionPanelSectionId}
				attempt-id={attemptId}
				player-type={selectedPlayerType}
				lazy-init={true}
				tools={toolkitToolsConfig}
				player={sectionPlayerConfig}
				section={resolvedSectionForPlayer}
				env={pieEnv}
				coordinator={coordinator}
				toolbar-position="right"
				show-toolbar={true}
				enabled-tools={sectionToolbarTools}
				cardTitleFormatter={customTitlesEnabled ? demoCardTitleFormatter : undefined}
				ontoolkit-ready={handleToolkitReady}
			></pie-section-player-splitpane>
		{/if}
	{/key}
</DemoRuntimeChrome>
{/if}

<style>
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
