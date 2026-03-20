<script lang="ts">
	import type { PieItemSessionDebuggerElement } from '@pie-players/pie-item-player/components/item-session-debugger-element';
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { coerceMode, coerceRole } from '$lib/utils/coercion';
	import { env as envStore, score as scoreStore, session as sessionStore } from '$lib/stores/demo-state';
	import {
		initializeDemoState,
		mode as modeStore,
		role as roleStore,
	} from '$lib/stores/demo-state';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';

	let { data, children } = $props();

	// State
	let initializedDemoId = $state<string | null>(null);
	let showSessionPanel = $state(false);
	let showInstrumentationPanel = $state(false);
	let sessionDebuggerElement: PieItemSessionDebuggerElement | null = $state(null);
	let instrumentationDebuggerElement: HTMLElement | null = $state(null);

	// Initialize state only when switching to a different demo id.
	$effect(() => {
		const demoId = data?.demoId ?? null;
		if (demoId && initializedDemoId !== demoId) {
			initializeDemoState(
				demoId,
				data?.demo?.item?.config ?? null,
				data?.demo?.initialSession ?? null,
			);
			initializedDemoId = demoId;
		}
	});

	// URL → State
	$effect(() => {
		const params = $page.url.searchParams;
		const nextRole = coerceRole(params.get('role'));
		const nextMode = coerceMode(params.get('mode'), nextRole);

		if (untrack(() => $roleStore) !== nextRole) roleStore.set(nextRole);
		if (untrack(() => $modeStore) !== nextMode) modeStore.set(nextMode);
	});

	function tabHref(view: 'delivery' | 'author' | 'source') {
		return `/demo/${data.demoId}/${view}?${$page.url.searchParams}`;
	}

	function modeHref(viewMode: 'student' | 'scorer') {
		const url = new URL($page.url);
		if (viewMode === 'scorer') {
			url.searchParams.set('mode', 'evaluate');
			url.searchParams.set('role', 'instructor');
		} else {
			url.searchParams.set('mode', 'gather');
			url.searchParams.set('role', 'student');
		}
		return `${url.pathname}?${url.searchParams}`;
	}

	function wireCloseListener(target: PieItemSessionDebuggerElement | null, onClose: () => void) {
		if (!target || !('addEventListener' in target)) return;
		target.addEventListener('close', onClose as EventListener);
		return () => {
			target.removeEventListener('close', onClose as EventListener);
		};
	}

	const activeView = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.includes('/author')) return 'author';
		if (path.includes('/source')) return 'source';
		return 'delivery';
	});

	const viewMode = $derived.by(() => {
		const role = $roleStore;
		const mode = $modeStore;
		return role === 'instructor' && mode === 'evaluate' ? 'scorer' : 'student';
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		return wireCloseListener(sessionDebuggerElement, () => {
			showSessionPanel = false;
		});
	});

	$effect(() => {
		if (!instrumentationDebuggerElement) return;
		return wireCloseListener(instrumentationDebuggerElement as any, () => {
			showInstrumentationPanel = false;
		});
	});

	$effect(() => {
		if (activeView !== 'delivery' && showSessionPanel) {
			showSessionPanel = false;
		}
	});
</script>

<div class="pie-demo-layout">
	<DemoMenuBar
		demoName={data.demo?.name || 'Demo'}
		demoPackage={data.demo?.sourcePackage || 'unknown-package'}
		{activeView}
		deliveryHref={tabHref('delivery')}
		authorHref={tabHref('author')}
		sourceHref={tabHref('source')}
		studentHref={modeHref('student')}
		scorerHref={modeHref('scorer')}
		{viewMode}
		{showSessionPanel}
		{showInstrumentationPanel}
		showSessionToggle={activeView === 'delivery'}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleInstrumentationPanel={() =>
			(showInstrumentationPanel = !showInstrumentationPanel)}
	/>

	<div class="container mx-auto max-w-7xl px-4 py-6">
		<div class="mb-5">
			<h1 class="text-3xl font-bold">{data.demo?.name || 'Demo'}</h1>
			{#if data.demo?.description}
				<p class="mt-2 text-base-content/90">{data.demo.description}</p>
			{/if}
		</div>

		{@render children()}
	</div>
</div>

<DemoOverlays
	demoName={data.demo?.name || 'Demo'}
	demoId={data.demoId || ''}
	config={data.demo?.item?.config ?? null}
	{showSessionPanel}
	{showInstrumentationPanel}
	session={$sessionStore}
	env={$envStore}
	score={$scoreStore}
	bind:sessionDebuggerElement
	bind:instrumentationDebuggerElement
/>

<style>
	.pie-demo-layout {
		min-height: 100dvh;
	}
</style>
