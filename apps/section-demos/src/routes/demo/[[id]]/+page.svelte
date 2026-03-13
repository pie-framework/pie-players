<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import '@pie-players/pie-section-player-tools-event-debugger';
	import '@pie-players/pie-section-player-tools-session-debugger';
	import '@pie-players/pie-section-player-tools-pnp-debugger';
	import '@pie-players/pie-tool-answer-eliminator';
	import '@pie-players/pie-tool-graph';
	import '@pie-players/pie-tool-line-reader';
	import '@pie-players/pie-tool-periodic-table';
	import '@pie-players/pie-tool-protractor';
	import '@pie-players/pie-tool-ruler';
	import '@pie-players/pie-tool-theme';
	import '@pie-players/pie-theme';
	import '@pie-players/pie-theme/components.css';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import DemoInfoDialog from './DemoInfoDialog.svelte';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';
	import {
		applyDaisyTheme,
		applyToolkitScheme,
		ATTEMPT_QUERY_PARAM,
		ATTEMPT_STORAGE_KEY,
		buildDemoHref,
		buildSectionPageHref,
		createAttemptId,
		DAISY_DEFAULT_THEMES,
		DAISY_THEME_STORAGE_KEY,
		DEMO_ASSESSMENT_ID,
		DEFAULT_DAISY_THEME,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		PLAYER_OPTIONS
	} from './demo-page-helpers';
	import { collectElementPackages, fetchBundleWithRetry } from './preload-utils';
	import {
		deleteSnapshotFromSessionDb as deleteSnapshotFromSessionDbRequest,
		loadSessionDemoActivity as loadSessionDemoActivityRequest,
		loadSnapshotFromSessionDb as loadSnapshotFromSessionDbRequest,
		saveSnapshotToSessionDb as saveSnapshotToSessionDbRequest,
		type SectionSessionSnapshot
	} from './session-demo-db-client';

	type DemoPage = { id: string; name: string };
	type DemoPageData = PageData & {
		demoPages?: DemoPage[];
		activeDemoPageId?: string;
	};

	let { data }: { data: DemoPageData } = $props();

	const DEMO_PERSISTENCE_STORAGE_PREFIX = `pie:section-controller:v1:${DEMO_ASSESSMENT_ID}:`;

	let selectedPlayerType = $state(getUrlEnumParam('player', PLAYER_OPTIONS, 'iife'));
	let roleType = $state<'candidate' | 'scorer'>(getUrlEnumParam('mode', MODE_OPTIONS, 'candidate'));
	let layoutType = $state<'splitpane' | 'vertical'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane')
	);
	let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
	let attemptId = $state(getOrCreateAttemptId());
	let showSessionPanel = $state(false);
	let showSessionControlsPanel = $state(false);
	let showEventPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let showTtsPanel = $state(false);
	let showSessionDbPanel = $state(false);
	let showDemoInfoDialog = $state(false);
	let autoOpenedSessionDbPanel = $state(false);
	let toolkitCoordinator: any = $state(null);
	let demoPersistenceCoordinator = $state<any>(null);
	let sessionDebuggerElement: any = $state(null);
	let eventDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);
	let playerInstanceKey = $state(0);
	let preloadedReady = $state(false);
	let preloadedError = $state<string | null>(null);
	let loadedPreloadedBundleKey = $state<string | null>(null);
	let hostSessionSnapshot = $state<Record<string, unknown> | null>(null);
	let persistenceStorageKey = $state<string | null>(null);
	let persistenceStoragePresent = $state(false);
	let lastSessionSavedAt = $state<number | null>(null);
	let lastSessionRestoredAt = $state<number | null>(null);
	let lastHostSessionUpdateAt = $state<number | null>(null);
	let lastSessionRefreshAt = $state<number | null>(null);
	let dbHydrateEnabled = $state(false);
	let dbBootstrapAt = $state<number | null>(null);
	let dbErrorMessage = $state<string | null>(null);
let suppressDemoDbAutoPersist = $state(false);
let lastPersistedSnapshotFingerprint = $state<string | null>(null);
let serverLoadedSection = $state<any>(null);
	const toolkitToolsConfig = {
		providers: {
			calculator: {
				authFetcher: fetchDesmosAuthConfig
			},
			annotationToolbar: {
				enabled: true
			}
		},
		// Demo policy: only expose currently supported/working placements.
		placement: {
			section: ['theme', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
			item: ['calculator', 'textToSpeech', 'answerEliminator', 'annotationToolbar'],
			passage: ['textToSpeech', 'annotationToolbar']
		}
	};
	const sectionToolbarTools = 'theme,graph,periodicTable,protractor,lineReader,ruler';

function handleDaisyThemeSelection(theme: string) {
	if (!browser) return;
	applyDaisyTheme(theme, (nextTheme) => {
		selectedDaisyTheme = nextTheme;
	});
	// Route external-theme choice through canonical toolkit backend.
	applyToolkitScheme('default');
}

	let resolvedSectionForPlayer = $derived.by(() => {
		const shouldUseServerSection =
			String((data?.demo as any)?.id || '').toLowerCase() === 'session-hydrate-db';
		const routeSection = data.section as any;
		const routeSectionId = String(routeSection?.identifier || routeSection?.id || '');
		const serverSectionId = String(serverLoadedSection?.identifier || serverLoadedSection?.id || '');
		const canUseServerSection =
			shouldUseServerSection &&
			Boolean(serverLoadedSection) &&
			Boolean(routeSectionId) &&
			serverSectionId === routeSectionId;
		const section = (canUseServerSection ? serverLoadedSection : routeSection) || routeSection;
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
		String(
			(resolvedSectionForPlayer as any)?.identifier ||
				`section-${String((data?.demo as any)?.id || 'default')}`
		)
	);
	let routeSectionId = $derived(
		String((data.section as any)?.identifier || (data.section as any)?.id || '')
	);
	let sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));
let isTtsSsmlDemo = $derived(
	String((data?.demo as any)?.id || '').toLowerCase() === 'tts-ssml' ||
		(sessionPanelSectionId || '').toLowerCase().includes('tts-ssml')
);
	let isSessionPersistenceDemo = $derived(
		String((data?.demo as any)?.id || '').toLowerCase() === 'session-persistence'
	);
	let isSessionHydrateDbDemo = $derived(
		String((data?.demo as any)?.id || '').toLowerCase() === 'session-hydrate-db'
	);
	let demoInfoFocus = $derived(
		typeof (data?.demo as any)?.focus === 'string' ? (data?.demo as any)?.focus : ''
	);
	let demoInfoWhatMakesItTick = $derived.by(() => {
		const points = (data?.demo as any)?.whatMakesItTick;
		if (!Array.isArray(points)) return [];
		return points.filter((entry: unknown) => typeof entry === 'string' && entry.trim().length > 0);
	});
	let effectiveCoordinator = $derived(
		isSessionHydrateDbDemo ? demoPersistenceCoordinator : null
	);
	let sessionControlItemIds = $derived.by(() => {
		const refs = (resolvedSectionForPlayer as any)?.assessmentItemRefs || [];
		return refs
			.map((ref: any) => ref?.identifier || ref?.item?.id || '')
			.filter((id: string) => typeof id === 'string' && id.length > 0);
	});
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

	async function bootstrapSessionDemoDb() {
		const response = await loadSessionDemoActivityRequest({
			assessmentId: DEMO_ASSESSMENT_ID,
			attemptId,
			sectionId: routeSectionId || String(sessionPanelSectionId),
			reset: false
		});
		serverLoadedSection = response.section || data.section;
		dbBootstrapAt = Date.now();
	}

	async function loadSnapshotFromSessionDb(sectionId: string) {
		return await loadSnapshotFromSessionDbRequest({
			assessmentId: DEMO_ASSESSMENT_ID,
			sectionId,
			attemptId
		});
	}

	async function saveSnapshotToSessionDb(
		sectionId: string,
		snapshot: SectionSessionSnapshot | null
	) {
		await saveSnapshotToSessionDbRequest({
			assessmentId: DEMO_ASSESSMENT_ID,
			sectionId,
			attemptId,
			snapshot
		});
	}

	async function deleteSnapshotFromSessionDb(sectionId: string) {
		await deleteSnapshotFromSessionDbRequest({
			assessmentId: DEMO_ASSESSMENT_ID,
			sectionId,
			attemptId
		});
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
		void refreshHostSessionSnapshot();
	}

	function getActiveSectionController() {
		return toolkitCoordinator?.getSectionController?.({
			sectionId: sessionPanelSectionId,
			attemptId
		});
	}

	function computeDefaultPersistenceStorageKey(): string {
		if (isSessionHydrateDbDemo) {
			return `${DEMO_ASSESSMENT_ID}:${sessionPanelSectionId}:${attemptId}`;
		}
		return `pie:section-controller:v1:${DEMO_ASSESSMENT_ID}:${sessionPanelSectionId}:${attemptId || 'default'}`;
	}

	async function refreshHostSessionSnapshot(): Promise<void> {
		const controller = getActiveSectionController();
		hostSessionSnapshot = (controller?.getSession?.() || null) as Record<string, unknown> | null;
		persistenceStorageKey = computeDefaultPersistenceStorageKey();
		if (browser && !isSessionHydrateDbDemo) {
			const key = persistenceStorageKey;
			persistenceStoragePresent = Boolean(key && window.localStorage.getItem(key || '') !== null);
		} else if (isSessionHydrateDbDemo) {
			persistenceStoragePresent = dbHydrateEnabled;
		}
		lastSessionRefreshAt = Date.now();
	}

function buildSnapshotFingerprint(snapshot: unknown): string {
	try {
		return JSON.stringify(snapshot || {});
	} catch {
		return String(Date.now());
	}
}

	async function persistHostSession(): Promise<void> {
		const controller = getActiveSectionController();
		await controller?.persist?.();
		lastSessionSavedAt = Date.now();
		await refreshHostSessionSnapshot();
	}

	async function hydrateHostSession(): Promise<void> {
		const controller = getActiveSectionController();
		await controller?.hydrate?.();
		lastSessionRestoredAt = Date.now();
		await refreshHostSessionSnapshot();
	}

	async function applyHostSessionSnapshot(
		snapshot: Record<string, unknown>,
		mode: 'replace' | 'merge'
	): Promise<void> {
		const controller = getActiveSectionController();
		await controller?.applySession?.(snapshot, { mode });
		lastHostSessionUpdateAt = Date.now();
		await refreshHostSessionSnapshot();
	}

	async function updateHostItemSession(
		itemId: string,
		detail: Record<string, unknown>
	): Promise<void> {
		const controller = getActiveSectionController();
		const currentItemSessions =
			((controller?.getSession?.() as { itemSessions?: Record<string, unknown> } | null)
				?.itemSessions || {}) as Record<string, unknown>;
		const existingEntry = (currentItemSessions[itemId] ||
			currentItemSessions[
				sessionControlItemIds.find((id: string) => id === itemId) || itemId
			]) as
			| {
					session?: { id?: string; data?: Array<Record<string, unknown>> };
			  }
			| undefined;
		const nextChoiceValue =
			typeof detail.choiceValue === 'string' && detail.choiceValue
				? detail.choiceValue
				: 'a';
		const existingData = Array.isArray(existingEntry?.session?.data)
			? existingEntry?.session?.data
			: [];
		const nextData = existingData.length
			? existingData.map((entry, index) =>
					index === 0 ? { ...entry, value: nextChoiceValue } : entry
			  )
			: [{ id: 'q1', value: nextChoiceValue }];
		await controller?.updateItemSession?.(itemId, {
			component: 'demo-host-controls',
			complete: true,
			session: {
				id: existingEntry?.session?.id || `${itemId}-host-session`,
				data: nextData
			}
		});
		lastHostSessionUpdateAt = Date.now();
		await refreshHostSessionSnapshot();
	}

	let candidateHref = $derived(
		buildDemoHref({
			targetMode: 'candidate',
			selectedPlayerType,
			layoutType,
			attemptId,
			activeDemoPageId: data.activeDemoPageId
		})
	);
	let scorerHref = $derived(
		buildDemoHref({
			targetMode: 'scorer',
			selectedPlayerType,
			layoutType,
			attemptId,
			activeDemoPageId: data.activeDemoPageId
		})
	);

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
		void attemptId;
		void isSessionHydrateDbDemo;
		void routeSectionId;
		if (!browser || !isSessionHydrateDbDemo) {
			demoPersistenceCoordinator = null;
			dbHydrateEnabled = false;
			dbErrorMessage = null;
			return;
		}
		dbHydrateEnabled = true;
		dbErrorMessage = null;
		const coordinator = new ToolkitCoordinator({
			assessmentId: DEMO_ASSESSMENT_ID,
			tools: toolkitToolsConfig,
			hooks: {
				async createSectionSessionPersistence(context) {
					const targetSectionId = context.key.sectionId;
					return {
						async loadSession() {
							if (!dbHydrateEnabled) return null;
							const snapshot = await loadSnapshotFromSessionDb(targetSectionId);
							return snapshot;
						},
						async saveSession(_ctx, session) {
							if (!dbHydrateEnabled) return;
							await saveSnapshotToSessionDb(
								targetSectionId,
								(session || { itemSessions: {} }) as SectionSessionSnapshot
							);
							lastSessionSavedAt = Date.now();
						},
						async clearSession() {
							await deleteSnapshotFromSessionDb(targetSectionId);
						}
					};
				}
			}
		});
		demoPersistenceCoordinator = coordinator;
		let cancelled = false;
		void bootstrapSessionDemoDb().catch((error) => {
			if (cancelled) return;
			dbErrorMessage = error instanceof Error ? error.message : String(error);
		});
		return () => {
			cancelled = true;
			demoPersistenceCoordinator = null;
		};
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
		applyDaisyTheme(storedDaisyTheme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
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
			queueMicrotask(() => {
				sessionDebuggerElement?.refreshFromHost?.();
			});
		};
		const persistSectionSession = () => {
			queueMicrotask(() => {
				if (isSessionHydrateDbDemo && suppressDemoDbAutoPersist) return;
				const controller = toolkitCoordinator?.getSectionController?.({
					sectionId: sessionPanelSectionId,
					attemptId
				});
				if (!controller?.persist) return;
				const snapshot = controller.getSession?.() as
					| { itemSessions?: Record<string, unknown> }
					| null
					| undefined;
				const nextFingerprint = buildSnapshotFingerprint(snapshot);
				if (isSessionHydrateDbDemo && nextFingerprint === lastPersistedSnapshotFingerprint) {
					return;
				}
				const nextItemSessionCount = Object.keys(snapshot?.itemSessions || {}).length;
				// Avoid wiping an existing persisted snapshot when startup/session bootstrap
				// briefly emits an empty session-changed event during page transitions.
				if (isSessionPersistenceDemo && nextItemSessionCount === 0) {
					const key = computeDefaultPersistenceStorageKey();
					const existingRaw = window.localStorage.getItem(key);
					if (existingRaw) {
						try {
							const existing = JSON.parse(existingRaw) as {
								itemSessions?: Record<string, unknown>;
							};
							const existingCount = Object.keys(existing?.itemSessions || {}).length;
							if (existingCount > 0) return;
						} catch {
							// Ignore parse errors and continue with best-effort persist.
						}
					}
				}
				// Keep localStorage snapshots current so reload-based mode switches restore latest answers.
				void controller.persist();
				lastPersistedSnapshotFingerprint = nextFingerprint;
				lastSessionSavedAt = Date.now();
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
			document.removeEventListener(
				'session-changed',
				persistSectionSession as EventListener,
				true
			);
		};
	});

	$effect(() => {
		if (isSessionPersistenceDemo && !showSessionControlsPanel) {
			showSessionControlsPanel = true;
		}
	});

	$effect(() => {
		void isSessionHydrateDbDemo;
		if (!isSessionHydrateDbDemo) {
			autoOpenedSessionDbPanel = false;
			return;
		}
		if (autoOpenedSessionDbPanel) return;
		showSessionDbPanel = true;
		autoOpenedSessionDbPanel = true;
	});

	$effect(() => {
		void toolkitCoordinator;
		void sessionPanelSectionId;
		void attemptId;
		if (!toolkitCoordinator) return;
		void refreshHostSessionSnapshot();
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

	$effect(() => {
		if (!eventDebuggerElement) return;
		return wireCloseListener(eventDebuggerElement, () => {
			showEventPanel = false;
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
			// Clear all route-level section-controller snapshots, including non-active section pages.
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

			// Start a new attempt namespace so persisted state does not bleed across resets.
			const nextAttemptId = createAttemptId();
			window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttemptId);
			attemptId = nextAttemptId;
			window.location.reload();
		}
	}

	async function resetServerDb() {
		dbErrorMessage = null;
	suppressDemoDbAutoPersist = true;
		try {
			const response = await loadSessionDemoActivityRequest({
				assessmentId: DEMO_ASSESSMENT_ID,
				attemptId,
				sectionId: routeSectionId || String(sessionPanelSectionId),
				reset: true
			});
			serverLoadedSection = response.section || data.section;
			dbBootstrapAt = Date.now();
			hostSessionSnapshot = null;
		lastPersistedSnapshotFingerprint = null;
			playerInstanceKey += 1;
			await refreshHostSessionSnapshot();
			sessionDebuggerElement?.refreshFromHost?.();
		} catch (error) {
			dbErrorMessage = error instanceof Error ? error.message : String(error);
	} finally {
		queueMicrotask(() => {
			suppressDemoDbAutoPersist = false;
		});
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
			{showSessionControlsPanel}
			{showEventPanel}
			{showSourcePanel}
			{showPnpPanel}
			{showTtsPanel}
			showDbPanel={showSessionDbPanel}
			showInfoDialog={showDemoInfoDialog}
			isSessionHydrateDbDemo={isSessionHydrateDbDemo}
			selectedDaisyTheme={selectedDaisyTheme}
			daisyThemes={[...DAISY_DEFAULT_THEMES]}
			onReset={() => void resetSessions()}
			onSetSplitpaneLayout={() => (layoutType = 'splitpane')}
			onSetVerticalLayout={() => (layoutType = 'vertical')}
			onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
			onToggleSessionControlsPanel={() =>
				(showSessionControlsPanel = !showSessionControlsPanel)}
			onToggleEventPanel={() => (showEventPanel = !showEventPanel)}
			onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
			onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
			onToggleTtsPanel={() => (showTtsPanel = !showTtsPanel)}
			onToggleDbPanel={() => (showSessionDbPanel = !showSessionDbPanel)}
			onToggleInfoDialog={() => (showDemoInfoDialog = !showDemoInfoDialog)}
			onSelectDaisyTheme={handleDaisyThemeSelection}
		/>

		{#if (data.demoPages || []).length > 1}
			<nav class="pie-demo-section-pages" aria-label="Section pages">
				{#each data.demoPages as page}
					<a
						class={`pie-demo-section-pages__link ${data.activeDemoPageId === page.id ? 'pie-demo-section-pages__link--active' : ''}`}
						href={buildSectionPageHref({
							targetPageId: page.id,
							roleType,
							selectedPlayerType,
							layoutType,
							attemptId
						})}
					>
						{page.name}
					</a>
				{/each}
			</nav>
		{/if}

		{#if isSessionHydrateDbDemo && dbErrorMessage}
			<div class="preload-status error">Session DB error: {dbErrorMessage}</div>
		{/if}

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

		{#key `${sessionPanelSectionId}:${attemptId}:${playerInstanceKey}`}
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
					coordinator={effectiveCoordinator}
					toolbar-position="right"
					show-toolbar={true}
					enabled-tools={sectionToolbarTools}
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
					coordinator={effectiveCoordinator}
					toolbar-position="right"
					show-toolbar={true}
					enabled-tools={sectionToolbarTools}
					ontoolkit-ready={handleToolkitReady}
				></pie-section-player-splitpane>
			{/if}
		{/key}
	</div>
</pie-theme>

<DemoInfoDialog
	open={showDemoInfoDialog}
	demoName={String((data?.demo as any)?.name || 'Demo')}
	description={String((data?.demo as any)?.description || '')}
	focus={demoInfoFocus}
	whatMakesItTick={demoInfoWhatMakesItTick}
	onClose={() => (showDemoInfoDialog = false)}
/>

<DemoOverlays
	{toolkitCoordinator}
	sectionId={sessionPanelSectionId}
	{attemptId}
	{showSessionPanel}
	{showSessionControlsPanel}
	{showEventPanel}
	{showSourcePanel}
	{showPnpPanel}
	{showTtsPanel}
	showSessionDbPanel={showSessionDbPanel}
	{sourcePanelJson}
	isSessionHydrateDbDemo={isSessionHydrateDbDemo}
	hostSessionSnapshot={hostSessionSnapshot}
	sessionControlItemIds={sessionControlItemIds}
	persistenceStorageKey={persistenceStorageKey}
	persistenceStoragePresent={persistenceStoragePresent}
	lastSessionSavedAt={lastSessionSavedAt}
	lastSessionRestoredAt={lastSessionRestoredAt}
	lastHostSessionUpdateAt={lastHostSessionUpdateAt}
	lastSessionRefreshAt={lastSessionRefreshAt}
	onRefreshHostSession={() => refreshHostSessionSnapshot()}
	onPersistHostSession={() => persistHostSession()}
	onHydrateHostSession={() => hydrateHostSession()}
	onApplyHostSessionSnapshot={(snapshot, mode) => applyHostSessionSnapshot(snapshot, mode)}
	onUpdateHostItemSession={(itemId, detail) => updateHostItemSession(itemId, detail)}
	onCloseSessionControlsPanel={() => (showSessionControlsPanel = false)}
	onCloseSourcePanel={() => (showSourcePanel = false)}
	onCloseTtsPanel={() => (showTtsPanel = false)}
	onCloseSessionDbPanel={() => (showSessionDbPanel = false)}
	onResetDb={() => void resetServerDb()}
	bind:sessionDebuggerElement
	bind:eventDebuggerElement
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

	.pie-demo-section-pages {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 1rem 0;
	}

	.pie-demo-section-pages__link {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.6rem;
		border-radius: 0.35rem;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
		background: var(--color-base-100);
		color: var(--color-base-content);
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pie-demo-section-pages__link--active {
		background: color-mix(in srgb, var(--color-primary) 15%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-base-300));
	}
</style>
