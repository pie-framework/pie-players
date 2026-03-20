<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import '@pie-players/pie-section-player-tools-event-debugger';
	import '@pie-players/pie-section-player-tools-instrumentation-debugger';
	import '@pie-players/pie-section-player-tools-session-debugger';
	import '@pie-players/pie-section-player-tools-pnp-debugger';
	import '@pie-players/pie-section-player-tools-tts-settings';
	import '@pie-players/pie-theme';
	import '@pie-players/pie-theme/components.css';
	import DemoInfoDialog from './DemoInfoDialog.svelte';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';
	import {
		buildDemoHref,
		buildSectionPageHref,
		DAISY_DEFAULT_THEMES
	} from '$lib/demo-runtime/demo-page-helpers';

	interface Props {
		data: any;
		roleType: 'candidate' | 'scorer';
		layoutType: 'splitpane' | 'vertical';
		selectedPlayerType: 'iife' | 'esm' | 'preloaded';
		attemptId: string;
		selectedDaisyTheme: string;
		daisyThemes?: readonly string[];
		sectionId: string;
		sourcePanelJson: string;
		toolkitCoordinator: any;
		isSessionHydrateDbDemo?: boolean;
		dbErrorMessage?: string | null;
		onReset: () => void;
		onSetSplitpaneLayout: () => void;
		onSetVerticalLayout: () => void;
		onSelectDaisyTheme: (theme: string) => void;
		onResetDb?: () => void | Promise<void>;
		beforePlayer?: Snippet;
		children?: Snippet;
		showSessionPanel?: boolean;
		showEventPanel?: boolean;
		showInstrumentationPanel?: boolean;
		showSourcePanel?: boolean;
		showPnpPanel?: boolean;
		showTtsPanel?: boolean;
		showSessionDbPanel?: boolean;
		sessionDebuggerElement?: any;
		eventDebuggerElement?: any;
		instrumentationDebuggerElement?: any;
		pnpDebuggerElement?: any;
		eventPanelMaxEvents?: number;
		eventPanelMaxEventsByLevel?: Partial<Record<'item' | 'section', number>>;
		instrumentationPanelMaxRecords?: number;
		instrumentationPanelMaxRecordsByKind?: Partial<
			Record<'event' | 'error' | 'metric' | 'user-context' | 'global-attributes', number>
		>;
	}

	let {
		data,
		roleType,
		layoutType,
		selectedPlayerType,
		attemptId,
		selectedDaisyTheme,
		daisyThemes = DAISY_DEFAULT_THEMES,
		sectionId,
		sourcePanelJson,
		toolkitCoordinator,
		isSessionHydrateDbDemo = false,
		dbErrorMessage = null,
		onReset,
		onSetSplitpaneLayout,
		onSetVerticalLayout,
		onSelectDaisyTheme,
		onResetDb = () => {},
		beforePlayer,
		children,
		showSessionPanel = $bindable(false),
		showEventPanel = $bindable(false),
		showInstrumentationPanel = $bindable(false),
		showSourcePanel = $bindable(false),
		showPnpPanel = $bindable(false),
		showTtsPanel = $bindable(false),
		showSessionDbPanel = $bindable(false),
		sessionDebuggerElement = $bindable(null),
		eventDebuggerElement = $bindable(null),
		instrumentationDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null),
		eventPanelMaxEvents = 200,
		eventPanelMaxEventsByLevel = {},
		instrumentationPanelMaxRecords = 250,
		instrumentationPanelMaxRecordsByKind = {}
	}: Props = $props();

	let showDemoInfoDialog = $state(false);
	let hasHydratedPanelVisibility = $state(false);

	type RuntimePanelVisibilityState = {
		session?: boolean;
		event?: boolean;
		instrumentation?: boolean;
		source?: boolean;
		pnp?: boolean;
		tts?: boolean;
		sessionDb?: boolean;
	};

	const DEBUG_PANEL_STORAGE_PREFIX = 'pie:debug-panels:v1';

	function createDebugPanelStorageKey(args: {
		scope: string;
		panelId: string;
		aspect?: string;
	}): string {
		const scope = String(args.scope || 'default').trim() || 'default';
		const panelId = String(args.panelId || 'panel').trim() || 'panel';
		const aspect = String(args.aspect || 'state').trim() || 'state';
		return `${DEBUG_PANEL_STORAGE_PREFIX}:${scope}:${panelId}:${aspect}`;
	}

	function readDebugPanelState<T>(key: string): T | null {
		try {
			if (!browser) return null;
			const raw = window.localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : null;
		} catch {
			return null;
		}
	}

	function writeDebugPanelState<T>(key: string, value: T): void {
		try {
			if (!browser) return;
			window.localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// ignore storage write failures
		}
	}

	const panelPersistenceScope = $derived.by(() => {
		const section = String(sectionId || 'unknown-section');
		const attempt = String(attemptId || 'default-attempt');
		return `section-demos:${section}:${attempt}`;
	});
	const panelVisibilityStorageKey = $derived.by(() =>
		createDebugPanelStorageKey({
			scope: panelPersistenceScope,
			panelId: 'runtime-panels',
			aspect: 'visibility'
		})
	);

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
	let demoInfoFocus = $derived(
		typeof (data?.demo as any)?.focus === 'string' ? (data?.demo as any)?.focus : ''
	);
	let demoInfoWhatMakesItTick = $derived.by(() => {
		const points = (data?.demo as any)?.whatMakesItTick;
		if (!Array.isArray(points)) return [];
		return points.filter((entry: unknown) => typeof entry === 'string' && entry.trim().length > 0);
	});

	$effect(() => {
		if (!browser) return;
		if (hasHydratedPanelVisibility) return;
		const persisted = readDebugPanelState<RuntimePanelVisibilityState>(
			panelVisibilityStorageKey
		);
		if (persisted) {
			showSessionPanel = persisted.session === true;
			showEventPanel = persisted.event === true;
			showInstrumentationPanel = persisted.instrumentation === true;
			showSourcePanel = persisted.source === true;
			showPnpPanel = persisted.pnp === true;
			showTtsPanel = persisted.tts === true;
			showSessionDbPanel = persisted.sessionDb === true;
		}
		hasHydratedPanelVisibility = true;
	});

	$effect(() => {
		if (!browser) return;
		if (!hasHydratedPanelVisibility) return;
		writeDebugPanelState<RuntimePanelVisibilityState>(panelVisibilityStorageKey, {
			session: showSessionPanel,
			event: showEventPanel,
			instrumentation: showInstrumentationPanel,
			source: showSourcePanel,
			pnp: showPnpPanel,
			tts: showTtsPanel,
			sessionDb: showSessionDbPanel
		});
	});
</script>

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme="light">
	<div class="pie-direct-layout">
		<DemoMenuBar
			{roleType}
			{layoutType}
			{candidateHref}
			{scorerHref}
			{showSessionPanel}
			{showEventPanel}
			{showInstrumentationPanel}
			{showSourcePanel}
			{showPnpPanel}
			{showTtsPanel}
			showDbPanel={showSessionDbPanel}
			showInfoDialog={showDemoInfoDialog}
			{isSessionHydrateDbDemo}
			{selectedDaisyTheme}
			daisyThemes={[...daisyThemes]}
			{onReset}
			{onSetSplitpaneLayout}
			{onSetVerticalLayout}
			onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
			onToggleEventPanel={() => (showEventPanel = !showEventPanel)}
			onToggleInstrumentationPanel={() =>
				(showInstrumentationPanel = !showInstrumentationPanel)}
			onToggleSourcePanel={() => (showSourcePanel = !showSourcePanel)}
			onTogglePnpPanel={() => (showPnpPanel = !showPnpPanel)}
			onToggleTtsPanel={() => (showTtsPanel = !showTtsPanel)}
			onToggleDbPanel={() => (showSessionDbPanel = !showSessionDbPanel)}
			onToggleInfoDialog={() => (showDemoInfoDialog = !showDemoInfoDialog)}
			{onSelectDaisyTheme}
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

		{@render beforePlayer?.()}
		{@render children?.()}
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
	{sectionId}
	{attemptId}
	panelPersistenceScope={panelPersistenceScope}
	eventPanelPersistenceId="controller-events"
	instrumentationPanelPersistenceId="instrumentation-events"
	{showSessionPanel}
	{showEventPanel}
	{showInstrumentationPanel}
	{eventPanelMaxEvents}
	{eventPanelMaxEventsByLevel}
	instrumentationPanelMaxRecords={instrumentationPanelMaxRecords}
	instrumentationPanelMaxRecordsByKind={instrumentationPanelMaxRecordsByKind}
	{showSourcePanel}
	{showPnpPanel}
	{showTtsPanel}
	showSessionDbPanel={showSessionDbPanel}
	{sourcePanelJson}
	{isSessionHydrateDbDemo}
	onCloseSourcePanel={() => (showSourcePanel = false)}
	onCloseTtsPanel={() => (showTtsPanel = false)}
	onCloseSessionDbPanel={() => (showSessionDbPanel = false)}
	onResetDb={onResetDb}
	bind:sessionDebuggerElement
	bind:eventDebuggerElement
	bind:instrumentationDebuggerElement
	bind:pnpDebuggerElement
/>

<style>
	.pie-direct-layout {
		display: flex;
		flex-direction: column;
		height: 100dvh;
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
		border: 1px solid color-mix(in srgb, var(--color-base-content) 35%, transparent);
		background: var(--color-base-100);
		color: var(--color-base-content);
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pie-demo-section-pages__link--active {
		background: color-mix(in srgb, var(--color-primary) 22%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-base-300));
	}
</style>
