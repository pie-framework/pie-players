<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { setContext, untrack } from 'svelte';
	import { coerceMode, coerceRole } from '$lib/utils/coercion';

	let { data, children } = $props();

	// State
	let mode = $state<'gather' | 'view' | 'evaluate'>('gather');
	let role = $state<'student' | 'instructor'>('student');
	let session = $state<any>({ id: '', data: [] });
	let config = $state<any>(data.demo.item.config);
	let score = $state<any>(null);
	let sessionVersion = $state(0);

	// Update session ID when demo changes
	$effect(() => {
		if (data?.demoId) {
			session = { id: `${data.demoId}-session`, data: [] };
		}
	});

	// Update config when demo changes
	$effect(() => {
		if (data?.demo?.item?.config) {
			config = data.demo.item.config;
		}
	});

	let env = $derived({ mode, role });

	// URL → State
	$effect(() => {
		const params = $page.url.searchParams;
		const nextMode = coerceMode(params.get('mode'));
		const nextRole = coerceRole(params.get('role'));

		if (untrack(() => mode) !== nextMode) mode = nextMode;
		if (untrack(() => role) !== nextRole) role = nextRole;
	});

	// State → URL (debounced)
	let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const snapshot = { mode, role };
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

	// Provide state to children via context
	setContext('demo-state', {
		get mode() {
			return mode;
		},
		set mode(v) {
			mode = v;
		},
		get role() {
			return role;
		},
		set role(v) {
			role = v;
		},
		get session() {
			return session;
		},
		set session(v) {
			session = v;
			sessionVersion++;
		},
		get config() {
			return config;
		},
		set config(v) {
			config = v;
		},
		get score() {
			return score;
		},
		set score(v) {
			score = v;
		},
		get env() {
			return env;
		},
		get sessionVersion() {
			return sessionVersion;
		}
	});
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<div class="mb-6">
		<a href="/" class="btn btn-ghost btn-sm">← Back to Demos</a>
	</div>

	<h1 class="text-4xl font-bold mb-6">{data.demo.name}</h1>
	<p class="text-base-content/70 mb-6">{data.demo.description}</p>

	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed mb-6">
		<a
			href="/demo/{data.demoId}/delivery?{$page.url.searchParams}"
			class="tab"
			class:tab-active={$page.url.pathname.includes('/delivery')}
		>
			Delivery
		</a>
		<a
			href="/demo/{data.demoId}/author?{$page.url.searchParams}"
			class="tab"
			class:tab-active={$page.url.pathname.includes('/author')}
		>
			Author
		</a>
		<a
			href="/demo/{data.demoId}/source?{$page.url.searchParams}"
			class="tab"
			class:tab-active={$page.url.pathname.includes('/source')}
		>
			Source
		</a>
	</div>

	{@render children()}
</div>
