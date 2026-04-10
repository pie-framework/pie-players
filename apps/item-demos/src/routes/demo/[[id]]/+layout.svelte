<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PieItemSessionDebuggerElement } from '@pie-players/pie-item-player/components/item-session-debugger-element';
	import {
		applyElementVersionOverridesPreserveTags,
		parseElementOverridesFromUrl,
		type ElementOverrides,
	} from '@pie-players/pie-players-shared/pie';
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import ElementVersionToolbar from '$lib/components/ElementVersionToolbar.svelte';
	import { coerceMode, coerceRole } from '$lib/utils/coercion';
	import {
		config as configStore,
		env as envStore,
		score as scoreStore,
		session as sessionStore,
	} from '$lib/stores/demo-state';
	import { getDemoSessionSeed } from '$lib/demo-session-seeds';
	import {
		initializeDemoState,
		mode as modeStore,
		role as roleStore,
	} from '$lib/stores/demo-state';
	import { demoHeadingName } from '$lib/utils/demo-heading-name';
	import DemoMenuBar from './DemoMenuBar.svelte';
	import DemoOverlays from './DemoOverlays.svelte';

	let { data, children } = $props();

	const demoHeading = $derived(demoHeadingName(data.demo?.name));

	// State
	let initializedDemoId = $state<string | null>(null);
	let showSessionPanel = $state(false);
	let showInstrumentationPanel = $state(false);
	let sessionDebuggerElement: PieItemSessionDebuggerElement | null = $state(null);
	let instrumentationDebuggerElement: HTMLElement | null = $state(null);
	let appliedOverridesSignature = $state<string | null>(null);

	function normalizeOverrideVersion(version: string): string {
		const trimmed = String(version ?? '').trim();
		if (!trimmed) return '';
		return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
	}

	function stableStringifyOverrides(overrides: ElementOverrides): string {
		const sortedEntries = Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b));
		return JSON.stringify(Object.fromEntries(sortedEntries));
	}

	function buildConfigWithOverrides(baseConfig: any, overrides: ElementOverrides) {
		return applyElementVersionOverridesPreserveTags(baseConfig, overrides);
	}

	function removeOverrideParams(params: URLSearchParams, packageName?: string): URLSearchParams {
		const next = new URLSearchParams(params);
		if (!packageName) {
			const overrideKeys = [...next.keys()].filter(
				(key) => key.startsWith('pie-overrides[') && key.endsWith(']'),
			);
			for (const key of overrideKeys) {
				next.delete(key);
			}
			return next;
		}
		const normalizedPackageName = packageName.startsWith('@') ? packageName.slice(1) : packageName;
		next.delete(`pie-overrides[${normalizedPackageName}]`);
		return next;
	}

	// Initialize state only when switching to a different demo id.
	$effect(() => {
		const demoId = data?.demoId ?? null;
		const baseConfig = data?.demo?.item?.config ?? null;
		const overrides = parseElementOverridesFromUrl($page.url.searchParams);
		const overrideSignature = stableStringifyOverrides(overrides);
		if (!demoId) return;
		if (initializedDemoId !== demoId) {
			untrack(() => {
				initializeDemoState(
					demoId,
					buildConfigWithOverrides(baseConfig, overrides),
					getDemoSessionSeed(demoId) ?? undefined,
				);
			});
			initializedDemoId = demoId;
			appliedOverridesSignature = overrideSignature;
			return;
		}
		if (appliedOverridesSignature !== overrideSignature) {
			queueMicrotask(() => {
				untrack(() => {
					initializeDemoState(
						demoId,
						buildConfigWithOverrides(baseConfig, overrides),
						getDemoSessionSeed(demoId) ?? undefined,
					);
					appliedOverridesSignature = overrideSignature;
				});
			});
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

	function coerceLoaderStrategy(value: string | null): 'iife' | 'esm' {
		return value === 'esm' ? 'esm' : 'iife';
	}

	const loaderStrategy = $derived(
		coerceLoaderStrategy($page.url.searchParams.get('player')),
	);

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
	const catalogElements = $derived(
		(data?.demo?.item?.config?.elements ?? {}) as Record<string, string>,
	);
	const elementOverrides = $derived(parseElementOverridesFromUrl($page.url.searchParams));

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

	async function updateOverrideParam(packageName: string, version: string | null) {
		const url = new URL($page.url);
		const normalizedPackageName = packageName.startsWith('@') ? packageName.slice(1) : packageName;
		const nextParams = new URLSearchParams(url.searchParams);
		if (!version) {
			nextParams.delete(`pie-overrides[${normalizedPackageName}]`);
		} else {
			nextParams.set(
				`pie-overrides[${normalizedPackageName}]`,
				normalizeOverrideVersion(version),
			);
		}
		const query = nextParams.toString();
		const targetUrl = query ? `${url.pathname}?${query}` : url.pathname;
		await navigateWithRefresh(targetUrl);
	}

	async function navigateWithRefresh(targetUrl: string) {
		if (typeof window !== 'undefined') {
			// Major demo state switches can leave stale player state in-memory.
			// Force a full document reload so runtime state is recreated cleanly.
			window.location.assign(targetUrl);
			return;
		}
		await goto(targetUrl, { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function updateLoaderStrategy(nextStrategy: 'iife' | 'esm') {
		if (loaderStrategy === nextStrategy) return;
		const url = new URL($page.url);
		const nextParams = new URLSearchParams(url.searchParams);
		nextParams.set('player', nextStrategy);
		const query = nextParams.toString();
		const targetUrl = query ? `${url.pathname}?${query}` : url.pathname;
		await navigateWithRefresh(targetUrl);
	}
</script>

<div class="pie-demo-layout">
	<DemoMenuBar
		demoName={demoHeading}
		demoPackage={data.demo?.sourcePackage || 'unknown-package'}
		{activeView}
		{loaderStrategy}
		deliveryHref={tabHref('delivery')}
		authorHref={tabHref('author')}
		sourceHref={tabHref('source')}
		studentHref={modeHref('student')}
		scorerHref={modeHref('scorer')}
		{viewMode}
		{showSessionPanel}
		{showInstrumentationPanel}
		showSessionToggle={activeView === 'delivery'}
		onSwitchLoaderStrategy={(next) => {
			void updateLoaderStrategy(next);
		}}
		onSwitchViewMode={(_, href) => {
			void navigateWithRefresh(href);
		}}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleInstrumentationPanel={() =>
			(showInstrumentationPanel = !showInstrumentationPanel)}
	/>

	<div class="container mx-auto max-w-7xl px-4 py-6">
		<div class="mb-5">
			<h1 class="text-3xl font-bold">{demoHeading}</h1>
			{#if data.demo?.description}
				<p class="mt-2 text-base-content/90">{data.demo.description}</p>
			{/if}
		</div>
		{#if activeView === 'delivery' || activeView === 'author'}
			<ElementVersionToolbar
				elements={catalogElements}
				overrides={elementOverrides}
				on:change={(event) => {
					void updateOverrideParam(event.detail.packageName, event.detail.version);
				}}
				on:resetOne={(event) => {
					void updateOverrideParam(event.detail.packageName, null);
				}}
				on:resetAll={() => {
					const nextParams = removeOverrideParams($page.url.searchParams);
					const query = nextParams.toString();
					const targetUrl = query ? `${$page.url.pathname}?${query}` : $page.url.pathname;
					void navigateWithRefresh(targetUrl);
				}}
			/>
		{/if}

		{@render children()}
	</div>
</div>

<DemoOverlays
	demoName={demoHeading}
	demoId={data.demoId || ''}
	config={$configStore}
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
