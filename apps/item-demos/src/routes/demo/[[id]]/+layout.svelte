<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
import { page } from '$app/stores';
	import { coerceMode, coerceRole } from '$lib/utils/coercion';
	import {
		config as configStore,
		initializeDemoState,
		mode as modeStore,
		role as roleStore,
	} from '$lib/stores/demo-state';

	let { data, children } = $props();

	// State
	let initializedDemoId = $state<string | null>(null);

	// Initialize state only when switching to a different demo id.
	$effect(() => {
		const demoId = data?.demoId ?? null;
		if (demoId && initializedDemoId !== demoId) {
			initializeDemoState(demoId, data?.demo?.item?.config ?? null);
			initializedDemoId = demoId;
		}
	});

	// URL → State
	$effect(() => {
		const params = $page.url.searchParams;
		const nextMode = coerceMode(params.get('mode'));
		const nextRole = coerceRole(params.get('role'));

		if (untrack(() => $modeStore) !== nextMode) modeStore.set(nextMode);
		if (untrack(() => $roleStore) !== nextRole) roleStore.set(nextRole);
	});

	// State → URL (debounced)
	let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const snapshot = { mode: $modeStore, role: $roleStore };
		if (urlSyncTimer) clearTimeout(urlSyncTimer);

		urlSyncTimer = setTimeout(() => {
			const params = new URLSearchParams();
			params.set('mode', snapshot.mode);
			params.set('role', snapshot.role);

			goto(`${$page.url.pathname}?${params}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}, 250);
	});

	function tabHref(view: 'delivery' | 'author' | 'source') {
		return `/demo/${data.demoId}/${view}?${$page.url.searchParams}`;
	}

	async function navigateTab(event: MouseEvent, view: 'delivery' | 'author' | 'source') {
		event.preventDefault();
		// Commit active editor control before route switch (author text editors finalize on blur).
		const active = document.activeElement;
		if (active && active instanceof HTMLElement) {
			active.blur();
		}
		await new Promise((resolve) => setTimeout(resolve, 40));
		await goto(tabHref(view), {
			noScroll: true,
			keepFocus: true,
		});
	}

</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<div class="mb-6">
		<a href="/" class="btn btn-ghost btn-sm">← Back to Demos</a>
	</div>

	<h1 class="text-4xl font-bold mb-6">{data.demo?.name || 'Demo'}</h1>
	<p class="text-base-content/70 mb-6">{data.demo?.description || ''}</p>

	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed mb-6">
		<a
			href={tabHref('delivery')}
			onclick={(event) => navigateTab(event, 'delivery')}
			class="tab"
			class:tab-active={$page.url.pathname.includes('/delivery')}
		>
			Delivery
		</a>
		<a
			href={tabHref('author')}
			onclick={(event) => navigateTab(event, 'author')}
			class="tab"
			class:tab-active={$page.url.pathname.includes('/author')}
		>
			Author
		</a>
		<a
			href={tabHref('source')}
			onclick={(event) => navigateTab(event, 'source')}
			class="tab"
			class:tab-active={$page.url.pathname.includes('/source')}
		>
			Source
		</a>
	</div>

	{@render children()}
</div>
