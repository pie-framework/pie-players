<script lang="ts">
	import '../../lib/players';
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import {
		coerceEsmSource,
		DEFAULT_REMOTE_ESM_CDN_URL,
		type EsmSource, 
		getDefaultLocalEsmCdnUrl,
		probeLocalEsmCdn
	} from '$lib/esm-cdn';
	import { getExampleById, PIE_ELEMENT_GROUPS, type PieExample } from '$lib/sample-library/pie-examples';

	type PlayerType = 'iife' | 'esm';
	type PlayerMode = 'gather' | 'view' | 'evaluate' | 'browse';
	type PlayerRole = 'student' | 'instructor';

	function coercePlayerType(v: string | null): PlayerType {
		return v === 'esm' ? 'esm' : 'iife';
	}
	function coerceMode(v: string | null): PlayerMode {
		return v === 'view' || v === 'evaluate' || v === 'browse' ? v : 'gather';
	}
	function coerceRole(v: string | null): PlayerRole {
		return v === 'instructor' ? 'instructor' : 'student';
	}

	let selectedExample = $state<PieExample | null>(null);
	let playerType = $state<PlayerType>('iife');
	let esmSource = $state<EsmSource>('auto');
	let resolvedEsmSource = $state<'local' | 'remote'>('remote');
	let mode = $state<PlayerMode>('gather');
	let role = $state<PlayerRole>('student');
	let session = $state({ id: 'local', data: [] as any[] });
	let navQuery = $state<string>('');

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

	// Browse mode maps to view mode + instructor role (like pieoneer and eval harness)
	const env = $derived.by(() => {
		return {
			mode: mode === 'browse' ? 'view' : mode,
			role: mode === 'browse' ? 'instructor' : role
		};
	});

	// Browse mode should populate correct responses
	const addCorrectResponse = $derived(mode === 'browse');

	// Player element reference (for potential future use)
	let piePlayerElement = $state<HTMLElement | null>(null);

	// Clear session ONCE when switching into browse mode (so we don't wipe populated correct responses)
	// NOTE: initialize with a non-reactive snapshot to avoid capturing `mode` at definition time.
	let lastMode = $state<PlayerMode>('gather');
	$effect(() => {
		const prev = lastMode;
		const next = mode;
		lastMode = next;

		if (prev !== 'browse' && next === 'browse') {
			session.data.length = 0;
		}
	});

	// Listen for session-changed events to keep parent session in sync
	onMount(() => {
		const handleSessionChanged = (e: Event) => {
			const customEvent = e as CustomEvent;
			const { id, clear, ...sessionData } = customEvent.detail || {};

			if (id) {
				if (clear) {
					// Handle clear flag - remove this entry from session
					const index = session.data.findIndex(d => d.id === id);
					if (index >= 0) {
						session.data.splice(index, 1);
					}
				} else {
					// Find or add session entry
					const existingEntry = session.data.find(d => d.id === id);
					if (existingEntry) {
						Object.assign(existingEntry, sessionData);
					} else {
						session.data.push({ id, ...sessionData });
					}
				}
				// Don't reassign session - mutate in place to preserve reference
			}
		};

		document.addEventListener('session-changed', handleSessionChanged);

		return () => {
			document.removeEventListener('session-changed', handleSessionChanged);
		};
	});

	// ESM player expects ESM-published pie-element versions (e.g. -esmbeta / -esm tags),
	// not the default @latest versions which are typically meant for the IIFE bundle service.
	const ESM_VERSION_OVERRIDES: Record<string, string> = {
		'@pie-element/multiple-choice@latest': '@pie-element/multiple-choice@esmbeta',
		'@pie-element/passage@latest': '@pie-element/passage@esmbeta'
	};

	function toEsmConfig(config: any) {
		if (!config?.elements) return config;
		const next = { ...config, elements: { ...config.elements } };
		for (const [tag, pkg] of Object.entries(next.elements)) {
			if (typeof pkg === 'string' && ESM_VERSION_OVERRIDES[pkg]) {
				next.elements[tag] = ESM_VERSION_OVERRIDES[pkg];
			}
		}
		return next;
	}

	const playerConfig = $derived.by(() => {
		const cfg = selectedExample?.item?.config;
		if (!cfg) return cfg;
		// Only apply ESM version overrides when loading from a remote ESM CDN.
		// In local mode we serve local builds (no -esmbeta/-esm tags required).
		return playerType === 'esm' && resolvedEsmSource === 'remote' ? toEsmConfig(cfg) : cfg;
	});

	const selectExample = (ex: PieExample) => {
		selectedExample = ex;
		// reset session between examples
		session = { id: 'local', data: [] };
	};

	function openSelectedInAuthoring() {
		if (!selectedExample) return;
		const params = new URLSearchParams();
		params.set('example', selectedExample.id);
		params.set('player', playerType);
		params.set('esmSource', esmSource);
		params.set('tab', 'author');

		// Preserve local ESM CDN URL if the user customized it on this page
		const local = $page.url.searchParams.get('localEsmCdnUrl');
		if (local) params.set('localEsmCdnUrl', local);

		void goto(`${base}/authoring/?${params.toString()}`);
	}

	const filteredGroups = $derived.by(() => {
		const q = navQuery.trim().toLowerCase();
		if (!q) return PIE_ELEMENT_GROUPS;

		return PIE_ELEMENT_GROUPS.map((g) => {
			const examples = g.examples.filter((ex) => {
				const hay = `${ex.name} ${ex.description ?? ''} ${g.name} ${g.description ?? ''}`.toLowerCase();
				return hay.includes(q);
			});
			return { ...g, examples };
		}).filter((g) => g.examples.length > 0);
	});

	function shouldGroupBeOpen(groupId: string): boolean {
		if (navQuery.trim()) return true;
		const sel = selectedExample;
		if (!sel) return groupId === PIE_ELEMENT_GROUPS[0]?.id;
		return PIE_ELEMENT_GROUPS.some((g) => g.id === groupId && g.examples.some((ex) => ex.id === sel.id));
	}

	// URL -> state (bookmarkable / back-forward friendly)
	$effect(() => {
		const q = $page.url.searchParams;
		const nextPlayer = coercePlayerType(q.get('player'));
		const nextMode = coerceMode(q.get('mode'));
		const nextRole = coerceRole(q.get('role'));
		const nextEsmSource = coerceEsmSource(q.get('esmSource'));

		// Avoid tracking local state in this effect (it should only depend on URL).
		if (untrack(() => playerType) !== nextPlayer) playerType = nextPlayer;
		if (untrack(() => mode) !== nextMode) mode = nextMode;
		if (untrack(() => role) !== nextRole) role = nextRole;
		if (untrack(() => esmSource) !== nextEsmSource) esmSource = nextEsmSource;

		const exampleId = q.get('example');
		const nextExample = exampleId ? getExampleById(exampleId) ?? null : null;

		const currentExampleId = untrack(() => selectedExample?.id);
		if (nextExample && currentExampleId !== nextExample.id) {
			selectExample(nextExample);
			return;
		}

		// Default selection if nothing is set yet
		if (!currentExampleId) {
			const fallback = PIE_ELEMENT_GROUPS[0]?.examples?.[0] ?? null;
			if (fallback) selectExample(fallback);
		}
	});

	// state -> URL (use replaceState so toggles don’t spam history)
	$effect(() => {
		if (!selectedExample) return;

		const url = $page.url;
		const params = new URLSearchParams(url.searchParams);

		params.set('player', playerType);
		params.set('esmSource', esmSource);
		params.set('mode', mode);
		params.set('role', role);
		params.set('example', selectedExample.id);

		const nextSearch = params.toString();
		const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
		const currentUrl = `${url.pathname}${url.search}`;

		if (nextUrl !== currentUrl) {
			goto(nextUrl, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});
</script>

<svelte:head>
	<title>PIE Players - Item Samples</title>
</svelte:head>

<div class="container mx-auto px-6 py-6">
	<div class="flex flex-col lg:flex-row gap-6">
		<div class="w-full lg:w-80 shrink-0">
			<div class="card bg-base-100 shadow-xl lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
				<div class="card-body flex flex-col h-full">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="card-title">Item Samples</h2>
							<p class="text-sm opacity-80">Seeded from PIEOneer’s <code>pie-examples.ts</code>.</p>
						</div>
						{#if navQuery.trim()}
							<button class="btn btn-ghost btn-sm" onclick={() => (navQuery = '')} title="Clear search">Clear</button>
						{/if}
					</div>

					<label class="form-control w-full mt-3">
						<div class="label py-1">
							<span class="label-text text-xs opacity-70">Find an item</span>
						</div>
						<input
							type="search"
							class="input input-bordered input-sm w-full"
							placeholder="Search by name/description…"
							bind:value={navQuery}
							aria-label="Search items"
						/>
					</label>

					<div class="divider my-3"></div>

					<div class="flex-1 overflow-y-auto pr-1">
						{#if filteredGroups.length === 0}
							<div class="text-sm opacity-70">No items match “{navQuery}”.</div>
						{:else}
							{#each filteredGroups as group (group.id)}
								<details
									class="collapse collapse-arrow bg-base-200 border border-base-300 mb-3"
									open={shouldGroupBeOpen(group.id)}
								>
									<summary class="collapse-title py-3">
										<div class="font-semibold">{group.name}</div>
										{#if group.description}
											<div class="text-xs opacity-70 mt-1">{group.description}</div>
										{/if}
									</summary>
									<div class="collapse-content">
										<div class="mt-1 flex flex-col gap-1">
											{#each group.examples as ex (ex.id)}
												<button
													class="btn btn-sm justify-start"
													class:btn-primary={selectedExample?.id === ex.id}
													class:btn-ghost={selectedExample?.id !== ex.id}
													aria-current={selectedExample?.id === ex.id ? 'page' : undefined}
													onclick={() => selectExample(ex)}
												>
													{ex.name}
												</button>
											{/each}
										</div>
									</div>
								</details>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="flex-1">
			{#if !selectedExample}
				<div class="alert alert-warning">No example selected.</div>
			{:else}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body gap-4">
						<!-- Control bar matching PIEOneer layout -->
						<div class="flex items-center gap-4 flex-wrap p-4 border border-base-300 rounded-lg bg-base-200">
							<!-- Player selection + Mode + Role controls -->
							<div class="flex items-center gap-4 flex-wrap">
								<!-- Player selection toggle (match /authoring/) -->
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">player:</span>
									<div class="join" role="group" aria-label="Select player type">
										<button
											type="button"
											class="btn join-item btn-sm"
											class:btn-primary={playerType === 'iife'}
											onclick={() => (playerType = 'iife')}
										>
											IIFE
										</button>
										<button
											type="button"
											class="btn join-item btn-sm"
											class:btn-primary={playerType === 'esm'}
											onclick={() => (playerType = 'esm')}
										>
											ESM
										</button>
									</div>
								</div>

									{#if playerType === 'esm'}
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium">esm source:</span>
											<div class="join" role="group" aria-label="Select ESM source">
												<button
													type="button"
													class="btn join-item btn-sm"
													class:btn-primary={esmSource === 'auto'}
													onclick={() => (esmSource = 'auto')}
												>
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
											<span class="text-xs opacity-70">(effective: {resolvedEsmSource})</span>
										</div>
									{/if}

								<!-- Mode radio buttons -->
								<div class="flex items-center gap-2">
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="mode"
											value="gather"
											checked={mode === 'gather'}
											onchange={() => (mode = 'gather')}
											class="radio radio-sm"
										/>
										<span class="text-sm">Gather</span>
									</label>
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="mode"
											value="view"
											checked={mode === 'view'}
											onchange={() => (mode = 'view')}
											class="radio radio-sm"
										/>
										<span class="text-sm">View</span>
									</label>
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="mode"
											value="evaluate"
											checked={mode === 'evaluate'}
											onchange={() => (mode = 'evaluate')}
											class="radio radio-sm"
										/>
										<span class="text-sm">Evaluate</span>
									</label>
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="mode"
											value="browse"
											checked={mode === 'browse'}
											onchange={() => (mode = 'browse')}
											class="radio radio-sm"
										/>
										<span class="text-sm">Browse</span>
									</label>
								</div>

								<!-- Subtle separator between mode and role -->
								<div class="h-6 w-px bg-base-300 opacity-80" aria-hidden="true"></div>

								<!-- Role radio buttons -->
								<div class="flex items-center gap-2">
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="role"
											value="student"
											checked={role === 'student'}
											onchange={() => (role = 'student')}
											class="radio radio-sm"
										/>
										<span class="text-sm">Student</span>
									</label>
									<label class="flex items-center gap-1 cursor-pointer">
										<input
											type="radio"
											name="role"
											value="instructor"
											checked={role === 'instructor'}
											onchange={() => (role = 'instructor')}
											class="radio radio-sm"
										/>
										<span class="text-sm">Instructor</span>
									</label>
								</div>
							</div>

							<!-- Clear session button -->
							<button
								class="btn btn-sm btn-ghost ml-auto"
								onclick={() => (session = { id: 'local', data: [] })}
							>
								Clear
							</button>
						</div>

						<!-- Title section -->
						<div>
							<h2 class="text-2xl font-bold">{selectedExample.name}</h2>
							<p class="text-sm opacity-80">{selectedExample.description}</p>
						</div>

						<div class="flex gap-2 flex-wrap">
							<button class="btn btn-sm" onclick={openSelectedInAuthoring}>Open in authoring</button>
						</div>

						<!-- Player content area -->
						<div class="rounded-lg border border-base-300 bg-base-200 p-6 min-h-[400px]">
							{#if playerType === 'iife'}
								<pie-iife-player
									bind:this={piePlayerElement}
									config={playerConfig}
									session={session}
									env={env}
									add-correct-response={addCorrectResponse}
									render-stimulus={true}
									allowed-resize={true}
								></pie-iife-player>
							{:else if playerType === 'esm'}
								<pie-esm-player
									bind:this={piePlayerElement}
									config={playerConfig}
									session={session}
									env={env}
									add-correct-response={addCorrectResponse}
									esm-cdn-url={esmCdnUrl}
								></pie-esm-player>
							{/if}
						</div>

						<!-- Debug section (collapsible) -->
						<details class="collapse collapse-arrow bg-base-200 border border-base-300">
							<summary class="collapse-title text-sm font-medium">Debug: config JSON</summary>
							<div class="collapse-content">
								<pre class="text-xs overflow-auto max-h-72">{JSON.stringify(selectedExample.item.config, null, 2)}</pre>
							</div>
						</details>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>


