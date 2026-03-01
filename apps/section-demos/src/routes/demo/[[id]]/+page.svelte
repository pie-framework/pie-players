<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player-tools-session-debugger';
	import '@pie-players/pie-section-player-tools-pnp-debugger';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';

	let { data }: { data: PageData } = $props();

	const PLAYER_OPTIONS = ['iife', 'esm', 'preloaded'] as const;
	const MODE_OPTIONS = ['candidate', 'scorer'] as const;
	const DEMO_ASSESSMENT_ID = 'section-demos-assessment';
	const ATTEMPT_QUERY_PARAM = 'attempt';
	const ATTEMPT_STORAGE_KEY = 'pie:section-demos:attempt-id';

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
	let attemptId = $state(getOrCreateAttemptId());
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let toolkitCoordinator: any = $state(null);
	let sessionDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);
	const toolkitToolsConfig = {
		providers: {
			calculator: {
				provider: 'desmos',
				authFetcher: fetchDesmosAuthConfig
			}
		},
		placement: {
			section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
			item: ['calculator', 'textToSpeech', 'answerEliminator'],
			passage: ['textToSpeech']
		}
	};

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
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		return url.toString();
	}

	let candidateHref = $derived(buildDemoHref('candidate'));
	let scorerHref = $derived(buildDemoHref('scorer'));

	$effect(() => {
		if (!browser || !attemptId) return;
		const url = new URL(window.location.href);
		if (url.searchParams.get(ATTEMPT_QUERY_PARAM) === attemptId) return;
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		window.history.replaceState({}, '', url.toString());
	});

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
	<title>{data.demo?.name || 'Demo'} - Direct Split Layout</title>
</svelte:head>

<div class="direct-layout">
	<DemoMenuBar
		{roleType}
		{candidateHref}
		{scorerHref}
		{showSessionPanel}
		{showSourcePanel}
		{showPnpPanel}
		onReset={() => void resetSessions()}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
		onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
	/>

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
</div>

<DemoOverlays
	{toolkitCoordinator}
	{showSessionPanel}
	{showSourcePanel}
	{showPnpPanel}
	{sourcePanelJson}
	onCloseSourcePanel={() => (showSourcePanel = false)}
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
	}

	:global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
</style>
