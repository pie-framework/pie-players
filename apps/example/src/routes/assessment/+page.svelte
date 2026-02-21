<script lang="ts">
	import '@pie-players/pie-section-player';
	import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

	import type { AssessmentEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		ASSESSMENT_EXAMPLES,
		type AssessmentExample, 
		createAssessmentFromExample
	} from '$lib/sample-library/assessment-examples';
	import { getAllExamples, getExampleById, PIE_ELEMENT_GROUPS } from '$lib/sample-library/pie-examples';

	const examples = getAllExamples();

	// Template selection
	let selectedTemplate = $state<string>('math-quiz');
	let customMode = $state<boolean>(false);
	let searchQuery = $state<string>('');

	// Assessment display options
	let started = $state<boolean>(false);

	// Get current template or create custom
	const currentTemplate = $derived.by<AssessmentExample | null>(() => {
		if (customMode) return null;
		return ASSESSMENT_EXAMPLES.find((t) => t.id === selectedTemplate) || null;
	});

	// Initialize with first template
	let selectedIds = $state<string[]>(
		ASSESSMENT_EXAMPLES[0]?.itemIds || examples.slice(0, 3).map((e) => e.id).filter(Boolean)
	);

	function coerceBool(v: string | null, fallback: boolean): boolean {
		if (v === null) return fallback;
		return v === '1' || v === 'true' || v === 'yes' || v === 'on';
	}
	function coerceTemplate(v: string | null): string {
		if (v && ASSESSMENT_EXAMPLES.some((t) => t.id === v)) return v;
		return ASSESSMENT_EXAMPLES[0]?.id ?? 'math-quiz';
	}
	function coerceSelectedIds(v: string | null): string[] | null {
		if (!v) return null;
		// The UI and templates use the example's stable public id (e.g. "mc_basic"),
		// but we allow item.id too for compatibility.
		const allowed = new Set(
			examples.flatMap((e) => [e.id, e.item.id].filter(Boolean) as string[]),
		);
		const parts = v
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.filter((id) => allowed.has(id));
		const unique = Array.from(new Set(parts));
		return unique.length ? unique : null;
	}

	// Update selectedIds when template changes
	$effect(() => {
		if (!customMode && currentTemplate) {
			selectedIds = [...currentTemplate.itemIds];
		}
	});

	// Filter examples by search query
	const filteredExamples = $derived.by(() => {
		if (!searchQuery.trim()) return examples;
		const query = searchQuery.toLowerCase();
		return examples.filter(
			(ex) =>
				ex.name.toLowerCase().includes(query) || ex.description?.toLowerCase().includes(query)
		);
	});

	const itemBank = $derived.by<Record<string, ItemEntity>>(() => {
		const bank: Record<string, ItemEntity> = {};
		for (const id of selectedIds) {
			// selectedIds are example ids (preferred), but we also allow passing item.id.
			const ex = getExampleById(id);
			const item = ex?.item;
			if (!item?.config) continue;
			bank[id] = { id, config: item.config } as unknown as ItemEntity;
		}
		return bank;
	});

	const assessment = $derived.by<AssessmentEntity>(() => {
		if (!customMode && currentTemplate) {
			return createAssessmentFromExample(currentTemplate);
		}

		const name = currentTemplate?.name || 'Custom Assessment';
		return {
			name,
			questions: selectedIds.map((itemVId, idx) => ({
				id: `q-${idx + 1}`,
				itemVId
			}))
		} as AssessmentEntity;
	});

	// URL -> state (bookmarkable)
	$effect(() => {
		const q = $page.url.searchParams;

		const nextCustomMode = coerceBool(q.get('custom'), untrack(() => customMode));
		const nextTemplate = coerceTemplate(q.get('template'));
		const nextSearchQuery = q.get('q') ?? '';
		const nextStarted = coerceBool(q.get('start'), untrack(() => started));

		// Avoid tracking local state in this effect (it should only depend on URL).
		if (untrack(() => customMode) !== nextCustomMode) customMode = nextCustomMode;
		if (untrack(() => selectedTemplate) !== nextTemplate) selectedTemplate = nextTemplate;
		if (untrack(() => searchQuery) !== nextSearchQuery) searchQuery = nextSearchQuery;
		if (untrack(() => started) !== nextStarted) started = nextStarted;

		// Only apply ids from URL in custom mode (otherwise template drives selection)
		// Avoid mutating the selection mid-run unless explicitly toggling custom mode.
		if (nextCustomMode && !nextStarted) {
			const nextIds = coerceSelectedIds(q.get('ids'));
			if (nextIds && JSON.stringify(nextIds) !== JSON.stringify(selectedIds)) {
				selectedIds = nextIds;
			}
		}
	});

	// Reference to section player and coordinator
	let sectionPlayerElement = $state<any>(null);
	let toolkitCoordinator = $state<ToolkitCoordinator | null>(null);
	let itemSessions = $state<Record<string, any>>({});
	let itemMetadata = $state<Record<string, { complete?: boolean; component?: string }>>({});
	let showSessionPanel = $state(false);
	const testAttemptSessionSnapshot = $derived.by(
		() => (toolkitCoordinator as any)?.testAttemptSessionTracker?.getSnapshot?.() ?? null
	);
	const persistentItemSessionSnapshot = $derived.by(() => ({
		itemSessionsByItemId: itemSessions,
		itemMetadataByItemId: itemMetadata
	}));
	const canonicalSessionSnapshot = $derived.by(() => ({
		testAttemptSession: testAttemptSessionSnapshot,
		itemSessionsByItemId: itemSessions,
		itemMetadataByItemId: itemMetadata
	}));

	const section = $derived.by(() => {
		const refs = selectedIds
			.map((id) => {
				const item = itemBank[id];
				if (!item?.config) return null;
				return {
					identifier: id,
					item
				};
			})
			.filter(Boolean);

		return {
			identifier: 'assessment-section',
			keepTogether: false,
			assessmentItemRefs: refs
		};
	});

	// Set complex object properties on section-player web component after start
	$effect(() => {
		if (started && !toolkitCoordinator) {
			toolkitCoordinator = new ToolkitCoordinator({
				assessmentId: `assessment-demo-${selectedTemplate || 'custom'}`
			});
		}
	});

	$effect(() => {
		if (sectionPlayerElement && started && toolkitCoordinator) {
			sectionPlayerElement.section = section;
			sectionPlayerElement.env = { mode: 'gather', role: 'student' };
			sectionPlayerElement.itemSessions = itemSessions;
			sectionPlayerElement.toolkitCoordinator = toolkitCoordinator;
		}
	});

	function handleSessionChanged(event: CustomEvent) {
		const { itemId, session, complete, component } = event.detail || {};
		if (!itemId || !session) return;
		itemSessions = { ...itemSessions, [itemId]: session };
		itemMetadata = { ...itemMetadata, [itemId]: { complete, component } };
	}

	function toggleSelectedItem(exampleId: string, event: Event) {
		const target = event.target as HTMLInputElement | null;
		const checked = !!target?.checked;
		selectedIds = checked
			? Array.from(new Set([...selectedIds, exampleId]))
			: selectedIds.filter((x) => x !== exampleId);
	}

	// state -> URL (debounced; avoid pushing history)
	let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const snapshot = {
			selectedTemplate,
			customMode,
			searchQuery,
			started,
			selectedIds: [...selectedIds]
		};

		if (urlSyncTimer) clearTimeout(urlSyncTimer);
		urlSyncTimer = setTimeout(() => {
			const url = $page.url;
			const params = new URLSearchParams(url.searchParams);

			params.set('template', snapshot.selectedTemplate);
			params.set('custom', snapshot.customMode ? '1' : '0');
			params.set('start', snapshot.started ? '1' : '0');
			if (snapshot.searchQuery) params.set('q', snapshot.searchQuery);
			else params.delete('q');

			// Clean up legacy params that used to exist on this page.
			params.delete('progress');
			params.delete('nav');
			params.delete('meta');
			params.delete('idx');

			if (snapshot.customMode) {
				params.set('ids', snapshot.selectedIds.join(','));
			} else {
				params.delete('ids');
			}

			const nextSearch = params.toString();
			const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
			const currentUrl = `${url.pathname}${url.search}`;

			if (nextUrl !== currentUrl) {
				goto(nextUrl, { replaceState: true, keepFocus: true, noScroll: true });
			}
		}, 250);

		return () => {
			if (urlSyncTimer) clearTimeout(urlSyncTimer);
		};
	});
</script>

<div class="h-[calc(100vh-4rem)]">
	<!-- SchoolCity-like shell: settings panel (setup) + full-height player (run) -->
	<div class="h-full grid grid-rows-[auto_1fr]">
		<div class="px-4 py-3">
			{#if started}
				<div class="flex items-center justify-between">
					<div class="text-sm font-semibold truncate">
						{assessment?.name ?? 'Assessment'}
					</div>
					<div class="flex items-center gap-2">
						<button class="btn btn-sm btn-outline" onclick={() => (showSessionPanel = !showSessionPanel)}>
							Session
						</button>
						<button class="btn btn-sm btn-outline" onclick={() => { started = false; showSessionPanel = false; }}>
							Back to setup
						</button>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-between">
					<div class="text-sm font-semibold">Assessment setup</div>
					<span class="text-xs opacity-70">Local demo • no backend</span>
				</div>
			{/if}
		</div>

		<div class="h-full px-4 pb-4">
			{#if !started}
				<div class="h-full grid gap-4 lg:grid-cols-[420px_1fr]">
					<!-- Settings panel -->
					<div class="rounded-lg border border-base-300 bg-base-100 p-4 overflow-hidden">
						<div class="flex items-center justify-between mb-3">
							<h2 class="text-sm font-semibold">Template</h2>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									class="toggle toggle-sm"
									bind:checked={customMode}
									aria-label="Toggle custom mode"
								/>
								<span class="text-xs">Custom</span>
							</label>
						</div>

						{#if !customMode}
							<select
								class="select select-bordered w-full"
								bind:value={selectedTemplate}
								aria-label="Select assessment template"
							>
								{#each ASSESSMENT_EXAMPLES as template (template.id)}
									<option value={template.id}>{template.name}</option>
								{/each}
							</select>

							{#if currentTemplate}
								<div class="mt-3 text-sm opacity-80">{currentTemplate.description}</div>
								<div class="mt-3 flex flex-wrap gap-2 items-center text-xs">
									<span class="badge badge-sm">{currentTemplate.itemIds.length} items</span>
									{#if currentTemplate.estimatedMinutes}
										<span class="badge badge-sm badge-secondary">{currentTemplate.estimatedMinutes} min</span>
									{/if}
									{#each currentTemplate.tags || [] as tag}
										<span class="badge badge-sm badge-ghost">{tag}</span>
									{/each}
								</div>
							{/if}
						{:else}
							<div class="space-y-3">
								<div class="flex items-center gap-2">
									<input
										type="search"
										placeholder="Search items..."
										class="input input-bordered input-sm flex-1"
										bind:value={searchQuery}
										aria-label="Search items"
									/>
									<span class="text-xs opacity-70">{selectedIds.length}</span>
								</div>

								<div class="h-[calc(100vh-18rem)] overflow-y-auto border border-base-300 rounded-lg p-3">
									{#each PIE_ELEMENT_GROUPS as group (group.id)}
										<div class="mb-4">
											<div class="font-semibold text-xs mb-2 opacity-70">{group.name}</div>
											<div class="grid grid-cols-1 gap-2">
												{#each group.examples as ex (ex.id)}
													{#if !searchQuery || filteredExamples.includes(ex)}
														<label class="flex items-center justify-between gap-3 cursor-pointer rounded-md px-2 py-1 hover:bg-base-200">
															<span class="flex items-center gap-2">
																<input
																	type="checkbox"
																	class="checkbox checkbox-xs"
																	checked={selectedIds.includes(ex.id)}
																	onchange={(e) => toggleSelectedItem(ex.id, e)}
																/>
																<span class="text-sm">{ex.name}</span>
															</span>
															<span class="text-xs opacity-50 font-mono">{ex.id}</span>
														</label>
													{/if}
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<div class="mt-4 flex items-center justify-end">
							<button
								class="btn btn-primary btn-sm"
								disabled={selectedIds.length === 0}
								onclick={() => {
									started = true;
								}}
							>
								Start
							</button>
						</div>
					</div>

					<!-- Preview / explainer panel -->
					<div class="rounded-lg border border-base-300 bg-base-100 p-4 overflow-hidden">
						<div class="text-sm font-semibold mb-2">What you’re looking at</div>
						<p class="text-sm opacity-80">
							This assessment demo runs through <code>pie-section-player</code> with toolkit coordination,
							using an in-memory item bank (no backend calls).
						</p>
						<div class="divider my-3"></div>
						<div class="text-xs opacity-70">
							Start the assessment to see the full “SchoolCity-like” player layout (rubric/passage sidebar + themed navigation).
						</div>
					</div>
				</div>
			{:else if selectedIds.length > 0}
				<div class="h-full rounded-lg border border-base-300 bg-base-100 overflow-hidden">
					<pie-section-player
						bind:this={sectionPlayerElement}
						view="candidate"
						onsessionchanged={handleSessionChanged}
					></pie-section-player>
				</div>
			{:else}
				<div class="alert alert-warning">
					<span>No items selected. Please select at least one item to create an assessment.</span>
				</div>
			{/if}
		</div>
	</div>
</div>

{#if started && showSessionPanel}
	<div class="fixed right-4 top-20 z-[100] w-[440px] max-h-[70vh] overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-xl">
		<div class="flex items-center justify-between border-b border-base-300 px-3 py-2">
			<div class="text-sm font-semibold">Session Data</div>
			<button class="btn btn-xs btn-ghost" onclick={() => (showSessionPanel = false)}>Close</button>
		</div>
		<div class="space-y-3 overflow-y-auto p-3 max-h-[calc(70vh-42px)]">
			{#if toolkitCoordinator}
				<div>
					<div class="mb-1 text-xs font-semibold text-warning">Tool State (Ephemeral)</div>
					<pre class="rounded bg-base-200 p-2 text-xs">{JSON.stringify(toolkitCoordinator.elementToolStateStore.getAllState(), null, 2)}</pre>
				</div>
				<div>
					<div class="mb-1 text-xs font-semibold text-info">TestAttemptSession (Canonical Orchestration Model)</div>
					{#if testAttemptSessionSnapshot}
						<pre class="rounded bg-base-200 p-2 text-xs">{JSON.stringify(testAttemptSessionSnapshot, null, 2)}</pre>
					{:else}
						<div class="rounded bg-base-200 p-2 text-xs opacity-80">
							Not initialized yet. It will populate after section-player establishes the attempt/session state.
						</div>
					{/if}
				</div>
			{/if}
			<div>
				<div class="mb-1 text-xs font-semibold">PIE Item Sessions (Persistent)</div>
				{#if Object.keys(itemSessions).length === 0}
					<div class="text-xs opacity-70">No session data yet. Interact with questions to populate.</div>
				{:else}
					<pre class="rounded bg-base-200 p-2 text-xs">{JSON.stringify(persistentItemSessionSnapshot, null, 2)}</pre>
				{/if}
			</div>
			<div>
				<div class="mb-1 text-xs font-semibold">Combined Session View (Canonical Shape)</div>
				<pre class="rounded bg-base-200 p-2 text-xs">{JSON.stringify(canonicalSessionSnapshot, null, 2)}</pre>
			</div>
		</div>
	</div>
{/if}
