<script lang="ts">
	import '../../lib/players';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import {
		coerceEsmSource,
		DEFAULT_REMOTE_ESM_CDN_URL,
		getDefaultLocalEsmCdnUrl,
		probeLocalEsmCdn,
		type EsmSource
	} from '$lib/esm-cdn';
	import { MULTIPLE_CHOICE_BASIC } from '$lib/sample-library/pie-examples';

	type PlayerType = 'iife' | 'esm';

	function coercePlayerType(v: string | null): PlayerType {
		return v === 'esm' ? 'esm' : 'iife';
	}

	let playerType = $state<PlayerType>('iife');
	let esmSource = $state<EsmSource>('auto');
	let resolvedEsmSource = $state<'local' | 'remote'>('remote');

	const localEsmCdnUrl = $derived.by(
		() => $page.url.searchParams.get('localEsmCdnUrl') ?? getDefaultLocalEsmCdnUrl()
	);
	const esmCdnUrl = $derived.by(() =>
		resolvedEsmSource === 'local' ? localEsmCdnUrl : DEFAULT_REMOTE_ESM_CDN_URL
	);

	// Resolve esmSource=auto in dev by probing the sibling local ESM CDN server.
	$effect(() => {
		if (!browser) return;
		if (!import.meta.env.DEV) {
			resolvedEsmSource = 'remote';
			return;
		}

		if (esmSource === 'remote') {
			resolvedEsmSource = 'remote';
			return;
		}

		if (esmSource === 'local') {
			resolvedEsmSource = 'local';
			return;
		}

		let cancelled = false;
		void (async () => {
			const ok = await probeLocalEsmCdn(localEsmCdnUrl);
			if (cancelled) return;
			resolvedEsmSource = ok ? 'local' : 'remote';
		})();

		return () => {
			cancelled = true;
		};
	});

	// Start with a known-good config from the sample library.
	let configText = $state(JSON.stringify(MULTIPLE_CHOICE_BASIC.config, null, 2));
	let parsedConfig = $state<any>(MULTIPLE_CHOICE_BASIC.config);
	let parseError = $state<string | null>(null);

	let envText = $state(JSON.stringify({ mode: 'gather', role: 'student' }, null, 2));
	let parsedEnv = $state<any>({ mode: 'gather', role: 'student' });

	let sessionText = $state(JSON.stringify({ id: 'local', data: [] }, null, 2));
	let parsedSession = $state<any>({ id: 'local', data: [] });

	const tryParse = (label: string, text: string) => {
		try {
			return { value: JSON.parse(text), error: null as string | null };
		} catch (e: any) {
			return { value: null, error: `${label}: ${e?.message || String(e)}` };
		}
	};

	const onConfigChange = (t: string) => {
		configText = t;
		const { value, error } = tryParse('config', t);
		parseError = error;
		if (value) parsedConfig = value;
	};

	const onEnvChange = (t: string) => {
		envText = t;
		const { value } = tryParse('env', t);
		if (value) parsedEnv = value;
	};

	const onSessionChange = (t: string) => {
		sessionText = t;
		const { value } = tryParse('session', t);
		if (value) parsedSession = value;
	};

	// URL -> state (bookmarkable)
	$effect(() => {
		const q = $page.url.searchParams;
		const nextPlayer = coercePlayerType(q.get('player'));
		const nextEsmSource = coerceEsmSource(q.get('esmSource'));
		// Avoid tracking local state in this effect (it should only depend on URL).
		if (untrack(() => playerType) !== nextPlayer) playerType = nextPlayer;
		if (untrack(() => esmSource) !== nextEsmSource) esmSource = nextEsmSource;

		const nextConfig = q.get('config');
		const nextEnv = q.get('env');
		const nextSession = q.get('session');

		const currentConfig = untrack(() => configText);
		const currentEnv = untrack(() => envText);
		const currentSession = untrack(() => sessionText);

		if (typeof nextConfig === 'string' && nextConfig !== currentConfig) onConfigChange(nextConfig);
		if (typeof nextEnv === 'string' && nextEnv !== currentEnv) onEnvChange(nextEnv);
		if (typeof nextSession === 'string' && nextSession !== currentSession) onSessionChange(nextSession);
	});

	// state -> URL (debounced; avoid pushing history)
	let urlSyncTimer: number | null = null;
	$effect(() => {
		const snapshot = {
			playerType,
			esmSource,
			configText,
			envText,
			sessionText
		};

		if (urlSyncTimer) window.clearTimeout(urlSyncTimer);
		urlSyncTimer = window.setTimeout(() => {
			const url = $page.url;
			const params = new URLSearchParams(url.searchParams);

			params.set('player', snapshot.playerType);
			params.set('esmSource', snapshot.esmSource);
			params.set('config', snapshot.configText);
			params.set('env', snapshot.envText);
			params.set('session', snapshot.sessionText);

			const nextSearch = params.toString();
			const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
			const currentUrl = `${url.pathname}${url.search}`;

			if (nextUrl !== currentUrl) {
				goto(nextUrl, { replaceState: true, keepFocus: true, noScroll: true });
			}
		}, 300);

		return () => {
			if (urlSyncTimer) window.clearTimeout(urlSyncTimer);
		};
	});
</script>

<svelte:head>
	<title>PIE Players - Playground</title>
</svelte:head>

<div class="container mx-auto px-6 py-6">
	<div class="flex items-start justify-between gap-4 mb-4">
		<div>
			<h1 class="text-2xl font-bold">Item playground</h1>
			<p class="text-sm opacity-80">
				Paste/edit PIE <code>config</code>, <code>env</code>, and <code>session</code>, then preview with a player.
			</p>
		</div>

		<div class="join">
			<button class="btn join-item" class:btn-primary={playerType === 'iife'} onclick={() => (playerType = 'iife')}>
				IIFE
			</button>
			<button class="btn join-item" class:btn-primary={playerType === 'esm'} onclick={() => (playerType = 'esm')}>
				ESM
			</button>
		</div>
	</div>

	{#if playerType === 'esm'}
		<div class="flex items-center gap-2 mb-4">
			<span class="text-sm font-medium">esm source:</span>
			<div class="join" role="group" aria-label="Select ESM source">
				<button type="button" class="btn join-item btn-sm" class:btn-primary={esmSource === 'auto'} onclick={() => (esmSource = 'auto')}>
					Auto
				</button>
				<button
					type="button"
					class="btn join-item btn-sm"
					class:btn-primary={esmSource === 'local'}
					onclick={() => (esmSource = 'local')}
				>
					Local
				</button>
				<button
					type="button"
					class="btn join-item btn-sm"
					class:btn-primary={esmSource === 'remote'}
					onclick={() => (esmSource = 'remote')}
				>
					Remote
				</button>
			</div>
			<span class="text-xs opacity-70">(effective: {resolvedEsmSource}, {esmCdnUrl})</span>
		</div>
	{/if}

	{#if parseError}
		<div class="alert alert-error mb-4">
			<span>{parseError}</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="flex flex-col gap-4">
			<div>
				<div class="font-semibold mb-2">config (PIE)</div>
				<CodeEditor content={configText} onContentChange={onConfigChange} language="json" />
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<div class="font-semibold mb-2">env</div>
					<CodeEditor content={envText} onContentChange={onEnvChange} language="json" />
				</div>
				<div>
					<div class="font-semibold mb-2">session</div>
					<CodeEditor content={sessionText} onContentChange={onSessionChange} language="json" />
				</div>
			</div>
		</div>

		<div>
			<div class="font-semibold mb-2">Preview</div>
			<div class="rounded-lg border border-base-300 bg-base-200 p-4 min-h-[240px]">
				{#if playerType === 'iife'}
					<pie-iife-player
						config={JSON.stringify(parsedConfig)}
						env={JSON.stringify(parsedEnv)}
						session={JSON.stringify(parsedSession)}
						hosted={false}
						render-stimulus={true}
						allowed-resize={true}
					></pie-iife-player>
				{:else}
					<pie-esm-player
						config={parsedConfig}
						env={parsedEnv}
						session={parsedSession}
						esm-cdn-url={esmCdnUrl}
						hosted={false}
					></pie-esm-player>
				{/if}
			</div>

			<div class="mt-4 text-xs opacity-70">
				Note: this playground only validates JSON parsing. PIE runtime errors will appear in the browser console.
			</div>
		</div>
	</div>
</div>


