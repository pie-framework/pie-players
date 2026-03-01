<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import DemoDirectMenuBar from './DemoDirectMenuBar.svelte';
	import DemoDirectOverlays from './DemoDirectOverlays.svelte';

	let { data }: { data: PageData } = $props();

	const PLAYER_OPTIONS = ['iife', 'esm', 'fixed'] as const;
	const MODE_OPTIONS = ['candidate', 'scorer'] as const;

	function getUrlEnumParam<T extends string>(key: string, options: readonly T[], fallback: T): T {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		return value && options.includes(value as T) ? (value as T) : fallback;
	}

	let selectedPlayerType = $state(getUrlEnumParam('player', PLAYER_OPTIONS, 'iife'));
	let roleType = $state<'candidate' | 'scorer'>(getUrlEnumParam('mode', MODE_OPTIONS, 'candidate'));
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
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
	let toolkitCoordinator: any = $state(createDemoToolkitCoordinator());
	let sessionPanelSectionId = $derived(
		resolvedSectionForPlayer?.identifier ||
			`section-${toolkitCoordinator?.assessmentId || data?.demo?.id || 'default'}`
	);
	let sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});

	const sectionPlayerRuntime = $derived({
		assessmentId: data.demo?.id || 'section-demo-direct',
		playerType: selectedPlayerType,
		lazyInit: true,
		tools: toolkitToolsConfig,
		coordinator: toolkitCoordinator
	});

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	function createDemoToolkitHooks(): ToolkitCoordinatorHooks {
		return {
			onError: (error, context) => {
				console.error('[Demo Direct] Toolkit hook error:', context, error);
			}
		};
	}

	function createDemoToolkitCoordinator() {
		const coordinator = new ToolkitCoordinator({
			assessmentId: data.demo?.id || 'section-demo-direct',
			lazyInit: true,
			tools: toolkitToolsConfig
		});
		coordinator.setHooks?.(createDemoToolkitHooks());
		return coordinator;
	}

	onMount(async () => {
		await Promise.all([
			import('@pie-players/pie-section-player-tools-session-debugger'),
			import('@pie-players/pie-section-player-tools-pnp-debugger')
		]);
	});

	function updateUrlAndRefresh(updates: {
		mode?: 'candidate' | 'scorer';
		player?: 'iife' | 'esm' | 'fixed';
	}) {
		if (!browser) return;
		const url = new URL(window.location.href);
		url.searchParams.set('mode', updates.mode || roleType);
		url.searchParams.set('player', updates.player || selectedPlayerType);
		window.location.href = url.toString();
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
	});

	$effect(() => {
		if (!browser) return;
		const triggerSessionPanelRefresh = () => {
			sessionDebuggerElement?.refreshFromHost?.();
		};
		document.addEventListener('item-session-changed', triggerSessionPanelRefresh as EventListener, true);
		document.addEventListener('session-changed', triggerSessionPanelRefresh as EventListener, true);
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
				clearPersistence: true,
				persistBeforeDispose: false
			});
		} catch (e) {
			console.warn('[Demo Direct] Failed to clear section-controller persistence during reset:', e);
		}
		if (browser) {
			window.location.reload();
		}
	}

</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Direct Split Layout</title>
</svelte:head>

<div class="direct-layout">
	<DemoDirectMenuBar
		{roleType}
		{showSessionPanel}
		{showSourcePanel}
		{showPnpPanel}
		onSelectRole={(mode) => updateUrlAndRefresh({ mode })}
		onReset={() => void resetSessions()}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
		onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
	/>

	<pie-section-player-splitpane
		runtime={sectionPlayerRuntime}
		section={resolvedSectionForPlayer}
		env={pieEnv}
		view={roleType}
		toolbar-position="right"
		show-toolbar={true}
	></pie-section-player-splitpane>
</div>

<DemoDirectOverlays
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
