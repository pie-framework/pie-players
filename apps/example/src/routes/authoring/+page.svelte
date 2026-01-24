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
	import { getExampleById, MULTIPLE_CHOICE_BASIC, type PieExample } from '$lib/sample-library/pie-examples';

	type PlayerType = 'iife' | 'esm';

	function coercePlayerType(v: string | null): PlayerType {
		return v === 'esm' ? 'esm' : 'iife';
	}
	function coerceAuthorTab(v: string | null): 'author' | 'preview' {
		return v === 'preview' ? 'preview' : 'author';
	}

	let playerType = $state<PlayerType>('iife');
	let esmSource = $state<EsmSource>('auto');
	let resolvedEsmSource = $state<'local' | 'remote'>('remote');
	let mode = $state<'author' | 'preview'>('author');
	let exampleId = $state<string | null>(null);
	let selectedExample = $state<PieExample | null>(null);
	let exampleDefaultConfigText = $state<string | null>(null);

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

	function setConfigFromExample(ex: PieExample) {
		const cfg = ex.item?.config ?? MULTIPLE_CHOICE_BASIC.config;
		const nextText = JSON.stringify(cfg, null, 2);
		configText = nextText;
		exampleDefaultConfigText = nextText;
		parsedConfig = cfg;
		parseError = null;
	}

	// Start with multiple choice config (but allow URL to override)
	let configText = $state(JSON.stringify(MULTIPLE_CHOICE_BASIC.config, null, 2));
	let parsedConfig = $state<any>(MULTIPLE_CHOICE_BASIC.config);
	let parseError = $state<string | null>(null);

	// Configuration for authoring mode (element-level settings)
	let configurationText = $state(
		JSON.stringify(
			{
				'@pie-element/multiple-choice': {
					// Example configuration options for multiple-choice configure element
					// These would be used to control what authoring features are available
				},
			},
			null,
			2
		)
	);
	let parsedConfiguration = $state<any>({});

	let envText = $state(JSON.stringify({ mode: 'gather', role: 'student' }, null, 2));
	let parsedEnv = $state<any>({ mode: 'gather', role: 'student' });

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

	const onConfigurationChange = (t: string) => {
		configurationText = t;
		const { value } = tryParse('configuration', t);
		if (value) parsedConfiguration = value;
	};

	const onEnvChange = (t: string) => {
		envText = t;
		const { value } = tryParse('env', t);
		if (value) parsedEnv = value;
	};

	// Handle model updates from authoring mode
	function handleModelUpdated(event: CustomEvent) {
		console.log('[Authoring Example] Model updated:', event.detail);
		// Update the config text with the new model
		if (event.detail?.update) {
			// Merge the update into the current config
			const updatedConfig = {
				...parsedConfig,
				models: parsedConfig.models.map((m: any) =>
					m.id === event.detail.update.id ? { ...m, ...event.detail.update } : m
				),
			};
			parsedConfig = updatedConfig;
			configText = JSON.stringify(updatedConfig, null, 2);
		}
	}

	// URL -> state (bookmarkable)
	$effect(() => {
		const q = $page.url.searchParams;
		const nextPlayer = coercePlayerType(q.get('player'));
		const nextTab = coerceAuthorTab(q.get('tab'));
		const nextEsmSource = coerceEsmSource(q.get('esmSource'));
		const nextExampleId = q.get('example');

		// Avoid tracking local state in this effect (it should only depend on URL).
		if (untrack(() => playerType) !== nextPlayer) playerType = nextPlayer;
		if (untrack(() => mode) !== nextTab) mode = nextTab;
		if (untrack(() => esmSource) !== nextEsmSource) esmSource = nextEsmSource;

		const nextConfig = q.get('config');
		const nextConfiguration = q.get('configuration');
		const nextEnv = q.get('env');

		const currentConfig = untrack(() => configText);
		const currentConfiguration = untrack(() => configurationText);
		const currentEnv = untrack(() => envText);

		// Example selection: only applies when no explicit config=... is present.
		const currentExampleId = untrack(() => exampleId);
		if (nextConfig == null && nextExampleId !== currentExampleId) {
			exampleId = nextExampleId;
			const ex = nextExampleId ? getExampleById(nextExampleId) ?? null : null;
			selectedExample = ex;
			if (ex) {
				setConfigFromExample(ex);
			} else if (!nextExampleId) {
				// Reset to default if example param is cleared
				const nextText = JSON.stringify(MULTIPLE_CHOICE_BASIC.config, null, 2);
				configText = nextText;
				exampleDefaultConfigText = null;
				parsedConfig = MULTIPLE_CHOICE_BASIC.config;
				parseError = null;
			}
		}

		if (typeof nextConfig === 'string' && nextConfig !== currentConfig) onConfigChange(nextConfig);
		if (typeof nextConfiguration === 'string' && nextConfiguration !== currentConfiguration)
			onConfigurationChange(nextConfiguration);
		if (typeof nextEnv === 'string' && nextEnv !== currentEnv) onEnvChange(nextEnv);
	});

	// state -> URL (debounced; avoid pushing history)
	let urlSyncTimer: number | null = null;
	$effect(() => {
		const snapshot = {
			playerType,
			esmSource,
			mode,
			exampleId,
			configText,
			configurationText,
			envText
		};

		if (urlSyncTimer) window.clearTimeout(urlSyncTimer);
		urlSyncTimer = window.setTimeout(() => {
			const url = $page.url;
			const params = new URLSearchParams(url.searchParams);

			params.set('player', snapshot.playerType);
			params.set('esmSource', snapshot.esmSource);
			params.set('tab', snapshot.mode);
			if (snapshot.exampleId) params.set('example', snapshot.exampleId);
			else params.delete('example');
			// Keep URLs short: if config matches the example's default, omit config=...
			if (
				snapshot.exampleId &&
				exampleDefaultConfigText &&
				snapshot.configText === exampleDefaultConfigText
			) {
				params.delete('config');
			} else {
				params.set('config', snapshot.configText);
			}
			params.set('configuration', snapshot.configurationText);
			params.set('env', snapshot.envText);

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
	<title>PIE Players - Authoring Mode</title>
</svelte:head>

<div class="container mx-auto px-6 py-6">
	<div class="flex items-start justify-between gap-4 mb-4">
		<div>
			<h1 class="text-2xl font-bold">Item Authoring</h1>
			<p class="text-sm opacity-80">
				Edit PIE items using authoring mode with configure elements. Toggle between author and preview modes.
			</p>
		</div>

		<div class="flex gap-2">
			<div class="join">
				<button
					class="btn join-item btn-sm"
					class:btn-primary={playerType === 'iife'}
					onclick={() => (playerType = 'iife')}
				>
					IIFE
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-primary={playerType === 'esm'}
					onclick={() => (playerType = 'esm')}
				>
					ESM
				</button>
			</div>

			{#if playerType === 'esm'}
				<div class="join">
					<button class="btn join-item btn-sm" class:btn-primary={esmSource === 'auto'} onclick={() => (esmSource = 'auto')}>
						Auto
					</button>
					<button
						class="btn join-item btn-sm"
						class:btn-primary={esmSource === 'local'}
						onclick={() => (esmSource = 'local')}
					>
						Local
					</button>
					<button
						class="btn join-item btn-sm"
						class:btn-primary={esmSource === 'remote'}
						onclick={() => (esmSource = 'remote')}
					>
						Remote
					</button>
				</div>
			{/if}

			<div class="join">
				<button
					class="btn join-item btn-sm"
					class:btn-primary={mode === 'author'}
					onclick={() => (mode = 'author')}
				>
					Author
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-primary={mode === 'preview'}
					onclick={() => (mode = 'preview')}
				>
					Preview
				</button>
			</div>
		</div>
	</div>

	{#if parseError}
		<div class="alert alert-error mb-4">
			<span>{parseError}</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="flex flex-col gap-4">
			<div>
				<div class="font-semibold mb-2">config (PIE Item)</div>
				<CodeEditor content={configText} onContentChange={onConfigChange} language="json" />
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<div class="font-semibold mb-2">configuration (Authoring Settings)</div>
					<CodeEditor content={configurationText} onContentChange={onConfigurationChange} language="json" />
				</div>
				<div>
					<div class="font-semibold mb-2">env (Preview Mode)</div>
					<CodeEditor content={envText} onContentChange={onEnvChange} language="json" />
				</div>
			</div>
		</div>

		<div>
			<div class="font-semibold mb-2">
				{mode === 'author' ? 'Author Mode' : 'Preview Mode'}
			</div>
			<div class="rounded-lg border border-base-300 bg-base-200 p-4 min-h-[400px]">
				{#if playerType === 'iife'}
					<pie-iife-player
						config={parsedConfig}
						env={parsedEnv}
						session={{ id: 'local', data: [] }}
						hosted={false}
						mode={mode}
						configuration={parsedConfiguration}
						onmodel-updated={handleModelUpdated}
					></pie-iife-player>
				{:else}
					<pie-esm-player
						config={parsedConfig}
						env={parsedEnv}
						session={{ id: 'local', data: [] }}
						esm-cdn-url={esmCdnUrl}
						hosted={false}
						mode={mode}
						configuration={parsedConfiguration}
						onmodel-updated={handleModelUpdated}
					></pie-esm-player>
				{/if}
			</div>

			<div class="mt-4 space-y-2">
				<div class="text-xs opacity-70">
					<strong>Author Mode:</strong> Uses configure elements (with -config suffix) for editing. Configure elements
					emit model-updated events when changes are made.
				</div>
				<div class="text-xs opacity-70">
					<strong>Preview Mode:</strong> Uses regular player elements in view mode to see how students will interact
					with the item.
				</div>
				<div class="text-xs opacity-70">
					<strong>Note:</strong> Model updates are logged to the browser console. In a real application, these would
					be saved to your backend.
				</div>
			</div>
		</div>
	</div>
</div>
