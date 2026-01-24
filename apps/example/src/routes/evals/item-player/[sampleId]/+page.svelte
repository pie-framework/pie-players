<script lang="ts">
	import '../../../../lib/players';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import {
		coerceEsmSource,
		DEFAULT_REMOTE_ESM_CDN_URL,
		type EsmSource, 
		getDefaultLocalEsmCdnUrl,
		probeLocalEsmCdn
	} from '$lib/esm-cdn';
	import type { PieExample } from '$lib/sample-library/pie-examples';
	import { getExampleById } from '$lib/sample-library/pie-examples';

	type PlayerType = 'iife' | 'esm';
	type PlayerMode = 'gather' | 'view' | 'evaluate' | 'browse' | 'author';
	type PlayerRole = 'student' | 'instructor';

	const sampleId = $derived($page.params.sampleId ?? '');

	function coercePlayerType(v: string | null): PlayerType {
		return v === 'esm' ? 'esm' : 'iife';
	}
	function coerceMode(v: string | null): PlayerMode {
		return v === 'view' || v === 'evaluate' || v === 'browse' || v === 'author' ? v : 'gather';
	}
	function coerceRole(v: string | null): PlayerRole {
		return v === 'instructor' ? 'instructor' : 'student';
	}

	const query = $derived($page.url.searchParams);
	const playerType = $derived<PlayerType>(coercePlayerType(query.get('player')));
	const mode = $derived<PlayerMode>(coerceMode(query.get('mode')));
	const role = $derived<PlayerRole>(coerceRole(query.get('role')));
	const esmSource = $derived<EsmSource>(coerceEsmSource(query.get('esmSource')));

	let resolvedEsmSource = $state<'local' | 'remote'>('remote');
	const localEsmCdnUrl = $derived<string>(query.get('localEsmCdnUrl') ?? getDefaultLocalEsmCdnUrl());
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

	// Browse mode maps to view mode + instructor role (like pieoneer)
	const env = $derived.by(() => {
		const mappedEnv = {
			mode: mode === 'author' ? 'gather' : mode === 'browse' ? 'view' : mode,
			role: mode === 'browse' ? 'instructor' : role
		};
		console.log('[eval-harness] Creating env:', mappedEnv, 'from mode:', mode, 'role:', role);
		return mappedEnv;
	});

	// Browse mode should populate correct responses
	const addCorrectResponse = $derived(mode === 'browse');

	// Debug logging
	$effect(() => {
		console.log('[eval-harness] Reactive values updated:');
		console.log('  mode:', mode);
		console.log('  role:', role);
		console.log('  env:', env);
		console.log('  addCorrectResponse:', addCorrectResponse);
	});
	const example = $derived.by(() => getExampleById(sampleId));

	// Align with /samples: ESM player needs ESM-published versions (esmbeta/esm).
	const ESM_VERSION_OVERRIDES: Record<string, string> = {
		'@pie-element/multiple-choice@latest': '@pie-element/multiple-choice@esmbeta',
		'@pie-element/passage@latest': '@pie-element/passage@esmbeta',
	};

	const playerItemConfig = $derived.by(() => {
		const cfg = example?.item?.config;
		if (!cfg) return cfg;
		if (playerType !== 'esm') return cfg;
		if (resolvedEsmSource !== 'remote') return cfg;
		if (!cfg.elements) return cfg;
		const next = { ...cfg, elements: { ...cfg.elements } } as any;
		for (const [tag, pkg] of Object.entries(next.elements)) {
			if (typeof pkg === 'string' && ESM_VERSION_OVERRIDES[pkg]) {
				next.elements[tag] = ESM_VERSION_OVERRIDES[pkg];
			}
		}
		return next;
	});

	// Session state - must be managed in parent to persist across updates
	let sessionState = $state<{ id: string; data: any[] }>({ id: 'local', data: [] });

	let lastEventType = $state<string>('');
	let lastEventDetail = $state<any>(null);
	let lastSessionChanged = $state<any>(null);
	let lastModelUpdated = $state<any>(null);
	let lastPlayerError = $state<any>(null);

	function handleAnyPlayerEvent(type: string, detail: any) {
		lastEventType = type;
		lastEventDetail = detail ?? null;
		if (type === 'session-changed') lastSessionChanged = detail ?? null;
		if (type === 'model-updated') lastModelUpdated = detail ?? null;
		if (type === 'player-error') lastPlayerError = detail ?? null;
	}

	// Deterministic event injection: dispatch directly on the internal PieItemPlayer root node
	// (a div with class `pie-item-player` inside the custom element's light DOM).
	let playerHostEl: HTMLElement | null = $state(null);
	let playerEventSinkEl: HTMLElement | null = $state(null);

	$effect(() => {
		// Some players re-dispatch events from their parentElement. Others dispatch directly
		// from the custom element. Listen on both when available.
		const targets = [playerHostEl, playerEventSinkEl].filter(Boolean) as HTMLElement[];
		const uniqueTargets = Array.from(new Set(targets));
		if (uniqueTargets.length === 0) return;

		const onLoadComplete = (e: Event) => handleAnyPlayerEvent('load-complete', (e as CustomEvent).detail);
		const onPlayerError = (e: Event) => handleAnyPlayerEvent('player-error', (e as CustomEvent).detail);
		const onSessionChanged = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			handleAnyPlayerEvent('session-changed', detail);

			// Keep parent session in sync (like PIEOneer)
			const { id, ...sessionData } = detail;
			if (id) {
				const existingEntry = sessionState.data.find(d => d.id === id);
				if (existingEntry) {
					Object.assign(existingEntry, sessionData);
				} else {
					sessionState.data.push({ id, ...sessionData });
				}
			}
		};
		const onModelUpdated = (e: Event) => handleAnyPlayerEvent('model-updated', (e as CustomEvent).detail);

		for (const el of uniqueTargets) {
			el.addEventListener('load-complete', onLoadComplete as EventListener);
			el.addEventListener('player-error', onPlayerError as EventListener);
			el.addEventListener('session-changed', onSessionChanged as EventListener);
			el.addEventListener('model-updated', onModelUpdated as EventListener);
		}

		return () => {
			for (const el of uniqueTargets) {
				el.removeEventListener('load-complete', onLoadComplete as EventListener);
				el.removeEventListener('player-error', onPlayerError as EventListener);
				el.removeEventListener('session-changed', onSessionChanged as EventListener);
				el.removeEventListener('model-updated', onModelUpdated as EventListener);
			}
		};
	});

	function dispatchFromHarness(eventType: string, detail: any) {
		if (!playerHostEl) return;
		const root = playerHostEl.querySelector('[data-testid="pie-item-player-root"]');
		if (!root) return;
		root.dispatchEvent(new CustomEvent(eventType, { detail, bubbles: true, composed: true }));
	}

	function dispatchSessionChanged() {
		dispatchFromHarness('session-changed', { complete: false, component: 'manual' });
	}

	function dispatchModelUpdated() {
		// PieItemPlayer listens for `model.updated` (from configure elements) and re-dispatches `model-updated`.
		dispatchFromHarness('model.updated', { update: { id: 'manual', foo: 'bar' }, reset: false });
	}
</script>

<svelte:head>
	<title>PIE Players - Evals: Item Player ({sampleId})</title>
</svelte:head>

<div class="container mx-auto px-6 py-6" data-testid="player-root">
	<div class="prose max-w-none">
		<h1>Eval harness: item player</h1>
		<p>
			This page is designed for deterministic local evals. Use query params:
			<code>?player=iife|esm&amp;mode=gather|view|evaluate|browse|author&amp;role=student|instructor</code>.
		</p>
		<p class="text-sm opacity-70">
			Note: <code>browse</code> mode automatically shows correct answers (maps to view+instructor+addCorrectResponse).
		</p>
	</div>

	{#if !example}
		<div class="alert alert-error mt-4" role="alert" data-testid="missing-sample">
			<span>Unknown sampleId: <code>{sampleId}</code></span>
		</div>
	{:else}
		<div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
			<!-- Player -->
			<div class="rounded-lg border border-base-300 bg-base-100 p-4">
				<div class="flex flex-wrap items-center justify-between gap-3 mb-3">
					<div class="text-sm opacity-80">
						<div><strong>sampleId:</strong> <code data-testid="sample-id">{sampleId}</code></div>
						<div>
							<strong>player:</strong> <code data-testid="player-type">{playerType}</code>,
							<strong>mode:</strong> <code data-testid="player-mode">{mode}</code>,
							<strong>role:</strong> <code data-testid="player-role">{role}</code>
						</div>
					</div>

					<div class="join">
						<button class="btn btn-sm join-item" data-testid="dispatch-session-changed" onclick={dispatchSessionChanged}>
							Dispatch session-changed
						</button>
						<button class="btn btn-sm join-item" data-testid="dispatch-model-updated" onclick={dispatchModelUpdated}>
							Dispatch model.updated
						</button>
					</div>
				</div>

				<!--
					IMPORTANT: players currently re-dispatch events from the custom-element host’s parentElement.
					So we attach listeners on this wrapper (the parentElement), not on the custom element itself.
				-->
				<div
					bind:this={playerEventSinkEl}
					data-testid="player-event-sink"
				>
					{#if playerType === 'iife'}
						<pie-iife-player
							bind:this={playerHostEl}
							data-testid="player-host"
							debug="true"
							config={playerItemConfig}
							env={env}
							session={sessionState}
							hosted={false}
							add-correct-response={addCorrectResponse}
						></pie-iife-player>
					{:else}
						<pie-esm-player
							bind:this={playerHostEl}
							data-testid="player-host"
							debug="true"
							config={playerItemConfig}
							env={env}
							session={sessionState}
							esm-cdn-url={esmCdnUrl}
							hosted={false}
							add-correct-response={addCorrectResponse}
						></pie-esm-player>
					{/if}
				</div>
			</div>

			<!-- Debug panel -->
			<div class="rounded-lg border border-base-300 bg-base-100 p-4">
				<div class="font-semibold mb-2">Debug (stable testids)</div>

				<div class="space-y-3 text-sm">
					<div>
						<div class="opacity-70">Last event type</div>
						<div class="font-mono" data-testid="last-event-type">{lastEventType}</div>
					</div>

					<div>
						<div class="opacity-70">Last session-changed</div>
						<pre class="text-xs overflow-auto max-h-36 bg-base-200 p-2 rounded" data-testid="last-session-changed">{JSON.stringify(lastSessionChanged, null, 2)}</pre>
					</div>

					<div>
						<div class="opacity-70">Last model-updated</div>
						<pre class="text-xs overflow-auto max-h-36 bg-base-200 p-2 rounded" data-testid="last-model-updated">{JSON.stringify(lastModelUpdated, null, 2)}</pre>
					</div>

					<div>
						<div class="opacity-70">Last player-error</div>
						<pre class="text-xs overflow-auto max-h-36 bg-base-200 p-2 rounded" data-testid="last-player-error">{JSON.stringify(lastPlayerError, null, 2)}</pre>
					</div>

					<div>
						<div class="opacity-70">Raw last event detail</div>
						<pre class="text-xs overflow-auto max-h-72 bg-base-200 p-2 rounded" data-testid="last-event-detail">{JSON.stringify(lastEventDetail, null, 2)}</pre>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>


