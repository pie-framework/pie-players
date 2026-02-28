<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';

	let { data }: { data: PageData } = $props();

	const LAYOUT_OPTIONS = ['vertical', 'split-panel', 'item-mode'] as const;
	const MODE_OPTIONS = ['candidate', 'scorer'] as const;
	const PLAYER_OPTIONS = ['iife', 'esm', 'fixed'] as const;

	function getUrlEnumParam<T extends string>(
		key: string,
		options: readonly T[],
		fallback: T
	): T {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		return value && options.includes(value as T) ? (value as T) : fallback;
	}

	let layoutType = $state<'vertical' | 'split-panel' | 'item-mode'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'split-panel')
	);
	let roleType = $state<'candidate' | 'scorer'>(
		getUrlEnumParam('mode', MODE_OPTIONS, 'candidate')
	);
	let toolbarPosition = $state<'top' | 'right' | 'bottom' | 'left'>('right');
	let itemPlayerType = $state<'iife' | 'esm' | 'fixed'>(
		getUrlEnumParam('player', PLAYER_OPTIONS, 'iife')
	);
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let sectionPlayer: any = $state(null);
	let sessionDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);

	// Toolkit coordinator (owns all services)
	let toolkitCoordinator: any = $state(createDemoToolkitCoordinator());

	// Storage keys
	let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
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
	let sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));

	function createDemoToolkitHooks(): ToolkitCoordinatorHooks {
		return {
			onError: (error, context) => {
				console.error('[Demo] Toolkit hook error:', context, error);
			},
			loadToolState: () => {
				try {
					const saved = localStorage.getItem(TOOL_STATE_STORAGE_KEY);
					if (!saved) return null;
					return JSON.parse(saved);
				} catch (e) {
					console.warn('[Demo] Failed to load tool state:', e);
					return null;
				}
			},
			saveToolState: (state) => {
				try {
					localStorage.setItem(TOOL_STATE_STORAGE_KEY, JSON.stringify(state));
				} catch (e) {
					console.warn('[Demo] Failed to persist tool state:', e);
				}
			}
		};
	}

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	function createDemoToolkitCoordinator() {
		const coordinator = new ToolkitCoordinator({
			assessmentId: data.demo?.id || 'section-demo',
			lazyInit: true,
			tools: {
				providers: {
					calculator: {
						provider: 'desmos',
						authFetcher: fetchDesmosAuthConfig
					}
				},
				placement: {
					section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
					item: ['calculator', 'textToSpeech', 'answerEliminator'],
					passage: ['textToSpeech']
				},
			}
		});
		coordinator.setHooks?.(createDemoToolkitHooks());
		return coordinator;
	}

	onMount(async () => {
		await Promise.all([
			import('@pie-players/pie-section-player'),
			import('@pie-players/pie-tool-annotation-toolbar'),
			import('@pie-players/pie-section-player-tools-session-debugger'),
			import('@pie-players/pie-section-player-tools-pnp-debugger')
		]);
	});

	// Update URL and refresh page when layout or mode changes
	function updateUrlAndRefresh(updates: {
		layout?: 'vertical' | 'split-panel' | 'item-mode';
		mode?: 'candidate' | 'scorer';
		player?: 'iife' | 'esm' | 'fixed';
	}) {
		if (browser) {
			const url = new URL(window.location.href);
			// Preserve current values and apply updates
			url.searchParams.set('layout', updates.layout || layoutType);
			url.searchParams.set('mode', updates.mode || roleType);
			url.searchParams.set('player', updates.player || itemPlayerType);
			window.location.href = url.toString();
		}
	}

	// Compute player definitions for selected type/source
	// Map role toggle to PIE environment
	// candidate → gather mode + student role (interactive assessment)
	// scorer → evaluate mode + instructor role (scoring/review)
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});
	let sessionPanelSectionId = $derived(
		resolvedSectionForPlayer?.identifier ||
			`section-${toolkitCoordinator?.assessmentId || data?.demo?.id || 'default'}`
	);

	function wireCloseListener(target: any, onClose: () => void) {
		if (!target) return;
		target.addEventListener('close', onClose as EventListener);
		return () => {
			target.removeEventListener('close', onClose as EventListener);
		};
	}

	// Set complex properties imperatively on the web component
	// (Web components can only receive simple values via attributes)
	$effect(() => {
		if (sectionPlayer && resolvedSectionForPlayer) {
			untrack(() => {
				sectionPlayer.section = resolvedSectionForPlayer;
				sectionPlayer.env = pieEnv;
				sectionPlayer.toolkitCoordinator = toolkitCoordinator;
				sectionPlayer.toolbarPosition = toolbarPosition;
				sectionPlayer.playerType = itemPlayerType;
			});
		}
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		untrack(() => {
			sessionDebuggerElement.toolkitCoordinator = toolkitCoordinator;
			sessionDebuggerElement.sectionId = sessionPanelSectionId;
		});
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		untrack(() => {
			pnpDebuggerElement.sectionData = resolvedSectionForPlayer;
			pnpDebuggerElement.roleType = roleType;
			pnpDebuggerElement.toolkitCoordinator = toolkitCoordinator;
		});
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

	// Reset all sessions
	async function resetSessions() {
		try {
			await toolkitCoordinator?.disposeSectionController?.({
				sectionId: sessionPanelSectionId,
				clearPersistence: true,
				persistBeforeDispose: false
			});
		} catch (e) {
			console.warn('[Demo] Failed to clear section-controller persistence during reset:', e);
		}
		// Force page reload to reset player state
		if (browser) {
			window.location.reload();
		}
	}

</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - PIE Section Player</title>
</svelte:head>

<div class="w-full h-screen min-h-0 overflow-hidden flex flex-col">
	<DemoMenuBar
		{layoutType}
		{roleType}
		{showSessionPanel}
		{showSourcePanel}
		{showPnpPanel}
		onSelectLayout={(layout) => updateUrlAndRefresh({ layout })}
		onSelectRole={(mode) => updateUrlAndRefresh({ mode })}
		onReset={() => void resetSessions()}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
		onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
	/>

	<div class="flex-1 min-h-0 overflow-hidden">
		<!-- Use web component - set complex properties imperatively via $effect -->
		<!-- svelte-ignore a11y_unknown_aria_attribute -->
		<pie-section-player
			class="block h-full min-h-0"
			bind:this={sectionPlayer}
			layout={layoutType}
			view={roleType}
			player-type={itemPlayerType}
		></pie-section-player>
	</div>

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

