<script lang="ts">
	import { browser } from '$app/env';
	import { afterNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Categorize from '@pie-element/categorize/browser/delivery';
	import * as categorizeController from '@pie-element/categorize/browser/controller';
	import DragInTheBlank from '@pie-element/drag-in-the-blank/browser/delivery';
	import * as dragInTheBlankController from '@pie-element/drag-in-the-blank/browser/controller';
	import Ebsr from '@pie-element/ebsr/browser/delivery';
	import * as ebsrController from '@pie-element/ebsr/browser/controller';
	import Hotspot from '@pie-element/hotspot/browser/delivery';
	import * as hotspotController from '@pie-element/hotspot/browser/controller';
	import ImageClozeAssociation from '@pie-element/image-cloze-association/browser/delivery';
	import * as imageClozeAssociationController from '@pie-element/image-cloze-association/browser/controller';
	import McPopulatedBlank from '@pie-element/mc-populated-blank/browser/delivery';
	import * as mcPopulatedBlankController from '@pie-element/mc-populated-blank/browser/controller';
	import MultipleChoice from '@pie-element/multiple-choice/browser/delivery';
	import * as multipleChoiceController from '@pie-element/multiple-choice/browser/controller';
	import Passage from '@pie-element/passage/browser/delivery';
	import * as passageController from '@pie-element/passage/browser/controller';
	import {
		createToolsConfig,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import { DEMO_PRELOADED_OPTIONS } from '@pie-players/demo-ui/preloaded';
	import { registerPreloadedElements } from '@pie-players/pie-item-player/preloaded';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player';
	import DemoRuntimeChrome from '#lib/demo-runtime/components/DemoRuntimeChrome.svelte';
	import {
		PRELOADED_NPM_PACKAGES,
		PRELOADED_NPM_SECTIONS
	} from '#lib/content/demo-preloaded-npm-elements.js';
	import {
		applyDaisyTheme,
		applyToolkitScheme,
		ATTEMPT_QUERY_PARAM,
		ATTEMPT_STORAGE_KEY,
		bindDemoAssessment,
		createAttemptId,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
		DEMO_ASSESSMENT_ID,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		onSectionSessionChanged
	} from '#lib/demo-runtime/demo-page-helpers.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';
	import { createSectionDemoToolRegistry } from '#lib/demo-runtime/default-tool-registry.js';
	import type { PageData } from './$types';

	/**
	 * A host that installs pie-elements-ng from npm: its bundler resolves each
	 * package's `./browser/delivery` and `./browser/controller`, and the page
	 * registers all of them before a section mounts, so the preloaded player
	 * loads no element code. With `?hosted=1` the players run no controller, as
	 * a host whose server builds the models would have them. The page's own
	 * navigation moves between sections the supported way: it persists the
	 * section it leaves, then mounts a new section player with the same
	 * coordinator, which hydrates that section's session. It appends what
	 * it hears to `window.__hostLog`.
	 */
	type HostLogEntry = {
		channel: string;
		itemId?: string;
		elementId?: string;
		sectionId?: string;
		component?: unknown;
		complete?: unknown;
		reason?: unknown;
		at: number;
	};

	let { data }: { data: PageData } = $props();

	let registrationError = $state<string | null>(null);
	try {
		const { categorize, dragInTheBlank, ebsr, hotspot, imageClozeAssociation } =
			PRELOADED_NPM_PACKAGES;
		const { mcPopulatedBlank, multipleChoice, passage } = PRELOADED_NPM_PACKAGES;
		registerPreloadedElements([
			{ ...categorize, element: Categorize, controller: categorizeController },
			{ ...dragInTheBlank, element: DragInTheBlank, controller: dragInTheBlankController },
			{ ...ebsr, element: Ebsr, controller: ebsrController },
			{ ...hotspot, element: Hotspot, controller: hotspotController },
			{
				...imageClozeAssociation,
				element: ImageClozeAssociation,
				controller: imageClozeAssociationController
			},
			{ ...mcPopulatedBlank, element: McPopulatedBlank, controller: mcPopulatedBlankController },
			{ ...multipleChoice, element: MultipleChoice, controller: multipleChoiceController },
			{ ...passage, element: Passage, controller: passageController }
		], DEMO_PRELOADED_OPTIONS);
	} catch (error) {
		registrationError = error instanceof Error ? error.message : String(error);
	}

	const toolRegistry = createSectionDemoToolRegistry();
	const toolkitToolsConfig = createToolsConfig({
		source: 'section-demos.preloaded-npm-elements',
		strictness: 'error',
		toolRegistry,
		tools: { placement: { section: [], item: [], passage: [] } }
	}).config;
	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		toolRegistry,
		toolConfigStrictness: 'error',
		tools: toolkitToolsConfig
	});
	coordinator.setHooks({
		onFrameworkError: (model) => {
			console.error('[Demo] Toolkit framework error:', model);
		}
	} satisfies ToolkitCoordinatorHooks);

	const roleType = getUrlEnumParam('mode', MODE_OPTIONS, 'candidate');
	let layoutType = $state<'splitpane' | 'vertical'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane')
	);
	let hosted = $state(browser && new URL(window.location.href).searchParams.get('hosted') === '1');
	let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
	let attemptId = $state(getOrCreateAttemptId());
	let routerReady = $state(false);
	afterNavigate(({ shallow, type }) => {
		if (shallow && type === 'goto') return;
		routerReady = true;
	});

	const sections = PRELOADED_NPM_SECTIONS;
	let sectionIndex = $state(0);
	let section = $derived(sections[sectionIndex]);
	let sectionId = $derived(section.identifier);
	let playerHostElement: HTMLElement | null = $state(null);

	const pieEnv = {
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	} as const;
	let runtime = $derived({
		assessmentId: DEMO_ASSESSMENT_ID,
		playerType: 'preloaded',
		lazyInit: true,
		tools: toolkitToolsConfig,
		player: withDemoLoaderOptions({ hosted }),
		env: pieEnv,
		coordinator
	});
	$effect(() => {
		bindDemoAssessment(coordinator, section as any);
	});

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
	let sourcePanelJson = $derived(JSON.stringify(section, null, 2));

	const hostLog: HostLogEntry[] = [];
	function record(channel: string, detail: Record<string, unknown> = {}) {
		hostLog.push({
			channel,
			itemId: (detail.itemId as string | undefined) ?? undefined,
			elementId: (detail.elementId as string | undefined) ?? undefined,
			sectionId: (detail.sectionId as string | undefined) ?? undefined,
			component: detail.component,
			complete: detail.complete,
			reason: detail.sessionCommitReason ?? null,
			at: performance.now()
		});
	}

	/**
	 * Remount-and-hydrate, as docs/assessment-player/integration-guide.md
	 * orders a section transition: persist the section being left, then replace
	 * its player. Changing `section-id` and `section` on a mounted player does
	 * not rebuild it.
	 */
	async function navigate(delta: number) {
		const target = sectionIndex + delta;
		if (target < 0 || target >= sections.length) return;
		const previousSectionId = sectionId;
		record('host:persist', { sectionId: previousSectionId });
		await coordinator
			.getSectionController({ sectionId: previousSectionId, attemptId })
			?.persist?.()
			?.catch?.((error: unknown) => console.warn('[Demo] persist before navigation failed:', error));
		record('host:section-input', { sectionId: sections[target].identifier });
		sectionIndex = target;
	}

	function setHosted(next: boolean) {
		hosted = next;
		const url = new URL(window.location.href);
		if (next) url.searchParams.set('hosted', '1');
		else url.searchParams.delete('hosted');
		goto(url, { shallow: true, replace: true });
	}

	onMount(() => {
		(window as unknown as { __hostLog: HostLogEntry[] }).__hostLog = hostLog;
		const onDocumentEvent = (event: Event) => {
			if (!playerHostElement || !event.composedPath().includes(playerHostElement)) return;
			const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
			// The section's own event, which names the item; an element's and its
			// item player's bubble past as well.
			if (typeof detail.itemId !== 'string') return;
			record(`section:${event.type}`, detail);
		};
		document.addEventListener('session-changed', onDocumentEvent);
		return () => document.removeEventListener('session-changed', onDocumentEvent);
	});

	$effect(() => {
		if (!browser || !routerReady || !attemptId) return;
		const url = new URL(window.location.href);
		if (
			url.searchParams.get(ATTEMPT_QUERY_PARAM) === attemptId &&
			url.searchParams.get('layout') === layoutType
		) {
			return;
		}
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		url.searchParams.set('layout', layoutType);
		goto(url, { shallow: true, replace: true });
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
		sessionDebuggerElement.sectionId = sectionId;
		sessionDebuggerElement.attemptId = attemptId;
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		pnpDebuggerElement.sectionData = section;
		pnpDebuggerElement.roleType = roleType;
		pnpDebuggerElement.toolkitCoordinator = coordinator;
	});

	for (const [getTarget, close] of [
		[() => sessionDebuggerElement, () => (showSessionPanel = false)],
		[() => pnpDebuggerElement, () => (showPnpPanel = false)],
		[() => eventDebuggerElement, () => (showEventPanel = false)],
		[() => instrumentationDebuggerElement, () => (showInstrumentationPanel = false)]
	] as const) {
		$effect(() => {
			const target = getTarget();
			if (!target) return;
			target.addEventListener('close', close);
			return () => target.removeEventListener('close', close);
		});
	}

	$effect(() =>
		onSectionSessionChanged(playerHostElement, () => {
			sessionDebuggerElement?.refreshFromHost?.();
			void coordinator.getSectionController({ sectionId, attemptId })?.persist?.();
		})
	);

	function handleDaisyThemeSelection(theme: string) {
		if (!browser) return;
		applyDaisyTheme(theme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
		applyToolkitScheme('default');
	}

	async function resetSessions() {
		for (const { identifier } of sections) {
			await coordinator
				.disposeSectionController?.({
					sectionId: identifier,
					attemptId,
					clearPersistence: true,
					persistBeforeDispose: false
				})
				?.catch?.(() => {});
		}
		window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
		const nextAttemptId = createAttemptId();
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttemptId);
		attemptId = nextAttemptId;
		window.location.reload();
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Preloaded npm Elements'} - Section Demos</title>
</svelte:head>

<DemoRuntimeChrome
	{data}
	{roleType}
	{layoutType}
	selectedPlayerType="preloaded"
	{attemptId}
	{selectedDaisyTheme}
	{sectionId}
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
		<nav class="host-nav" aria-label="Host section navigation">
			<button
				type="button"
				class="btn btn-sm"
				id="host-previous-section"
				disabled={sectionIndex === 0}
				onclick={() => navigate(-1)}
			>
				Previous section
			</button>
			<span data-testid="host-current-section">{sectionId}</span>
			<button
				type="button"
				class="btn btn-sm"
				id="host-next-section"
				disabled={sectionIndex === sections.length - 1}
				onclick={() => navigate(1)}
			>
				Next section
			</button>
			<label class="label cursor-pointer gap-2">
				<input
					type="checkbox"
					class="toggle toggle-sm"
					id="host-hosted-toggle"
					checked={hosted}
					onchange={(event) => setHosted(event.currentTarget.checked)}
				/>
				<span>Hosted (the server runs the controllers)</span>
			</label>
		</nav>
	{/snippet}
	{#key sectionId}
		{#if registrationError}
			<p class="preload-status error" role="alert">{registrationError}</p>
		{:else if layoutType === 'vertical'}
			<pie-section-player-vertical
				bind:this={playerHostElement}
				section-id={sectionId}
				attempt-id={attemptId}
				{runtime}
				{section}
				{toolRegistry}
				show-toolbar={false}
			></pie-section-player-vertical>
		{:else}
			<pie-section-player-splitpane
				bind:this={playerHostElement}
				section-id={sectionId}
				attempt-id={attemptId}
				{runtime}
				{section}
				{toolRegistry}
				show-toolbar={false}
			></pie-section-player-splitpane>
		{/if}
	{/key}
</DemoRuntimeChrome>

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

	.host-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem 1rem;
	}

	.preload-status {
		margin: 1rem;
	}

	.preload-status.error {
		color: var(--color-error);
	}
</style>
