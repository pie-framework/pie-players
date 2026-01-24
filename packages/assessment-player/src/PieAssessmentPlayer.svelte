<!-- pie-assessment-player Custom Element -->
<svelte:options
	customElement={{
		tag: 'pie-assessment-player',
		shadow: 'none',
		props: {
			assessment: { attribute: 'assessment', type: 'Object' },
			bundleHost: { attribute: 'bundle-host', type: 'String' },
			organizationId: { attribute: 'organization-id', type: 'String' },

			// No-backend default / optional backend hook
			itemBank: { attribute: 'item-bank', type: 'Object' },
			fetchBaseUrl: { attribute: 'fetch-base-url', type: 'String' },
			itemEndpoint: { attribute: 'item-endpoint', type: 'String' },

			// Mode/role
			mode: { attribute: 'mode', type: 'String' },
			role: { attribute: 'role', type: 'String' },

			// Authoring mode
			authoringCallbacks: { attribute: 'authoring-callbacks', type: 'Object' },
			configuration: { attribute: 'configuration', type: 'Object' }
		}
	}}
/>

<script lang="ts">
	import '@pie-players/pie-iife-player';
	import '@pie-players/pie-tool-toolbar';

	import { createLoadItem } from '@pie-players/pie-assessment-toolkit';
	import {
		AssessmentPlayer,
		getAllQuestionRefs
	} from '@pie-players/pie-assessment-toolkit/assessment-player';
	import type { PieIifePlayerElement } from '@pie-players/pie-iife-player';
	import {
		type AssessmentAuthoringCallbacks,
		type AssessmentEntity,
		BUILDER_BUNDLE_URL,
		type Env,
		type ItemConfig,
		type ItemEntity,
	} from '@pie-players/pie-players-shared';
	import { onMount, untrack } from 'svelte';

	import './color-schemes.css';
	import './font-sizes.css';

	type LoadItemFn = (itemVId: string, opts?: { organizationId?: string | null }) => Promise<any>;

	let {
		assessment,
		bundleHost = BUILDER_BUNDLE_URL,
		organizationId = null,
		itemBank = undefined,
		fetchBaseUrl = undefined,
		itemEndpoint = undefined,
		loadItem: loadItemProp = undefined,
		mode = 'gather',
		role = 'student',
		authoringCallbacks = undefined,
		configuration = {}
	}: {
		assessment: AssessmentEntity;
		bundleHost?: string;
		organizationId?: string | null;
		itemBank?: Record<string, ItemEntity>;
		fetchBaseUrl?: string;
		itemEndpoint?: string;
		mode?: 'gather' | 'view' | 'evaluate' | 'author';
		role?: 'student' | 'instructor';
		// Note: `loadItem` can be set programmatically as a property on the custom element
		loadItem?: LoadItemFn;
		authoringCallbacks?: AssessmentAuthoringCallbacks;
		configuration?: Record<string, any>;
	} = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let containerHeight = $state('100vh');

	let piePlayerElement = $state<PieIifePlayerElement | null>(null);

	// Reference player instance
	let player = $state<AssessmentPlayer | null>(null);

	// Derived from the assessment model (works for flat + QTI structures)
	let questionRefs = $state<Array<{ identifier: string; itemVId: string }>>([]);

	// Reactive state from player subscriptions
	let currentItem = $state<ItemEntity | null>(null);
	let config = $state<ItemConfig | undefined>(undefined);
	let sessionState = $state<{ id: string; data: any[] }>({ id: '', data: [] });
	let isLoadingItem = $state(true);
	let rubricBlocks = $state<Array<{ view?: string; use?: string; content?: string }>>([]);

	let navigationState = $state({
		currentIndex: 0,
		totalItems: 0,
		canNext: true,
		canPrevious: false,
		isLoading: true
	});

	const env = $derived<Env>({ mode, role });

	function handleNext() {
		player?.navigateNext();
	}

	function handlePrevious() {
		player?.navigatePrevious();
	}

	function handleNavigateToIndex(index: number) {
		player?.navigate(index);
	}

	function toggleAudio() {
		player?.getToolCoordinator()?.toggleTool('tts-accommodation');
	}

	function toggleContrast() {
		player?.getToolCoordinator()?.toggleTool('colorScheme');
	}

	async function toggleFullscreen() {
		if (typeof document === 'undefined') return;
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await containerEl?.requestFullscreen?.();
			}
		} catch {
			// ignore
		}
	}

	let lastConfig: any = null;
	let lastEnv: any = null;

	$effect(() => {
		const currentConfig = config;
		const currentEnv = env;
		const el = piePlayerElement;

		if (el && currentConfig && currentEnv) {
			if (currentConfig !== lastConfig || currentEnv !== lastEnv) {
				untrack(() => {
					el.config = currentConfig;
					el.session = sessionState; // pass session but don't track it
					el.env = currentEnv;
				});

				lastConfig = currentConfig;
				lastEnv = currentEnv;
			}
		}
	});

	onMount(() => {
		// Compute available height for container
		const computeHeight = () => {
			if (!containerEl) return;
			const rect = containerEl.getBoundingClientRect();
			const viewportHeight = window.innerHeight;
			const available = Math.max(0, viewportHeight - rect.top - 1);
			containerHeight = `${available}px`;
		};
		computeHeight();
		window.addEventListener('resize', computeHeight);

		// Build loadItem (client-resolvable default + optional backend hook)
		const loadItem = loadItemProp ??
			createLoadItem({
				itemBank,
				fetchBaseUrl,
				itemEndpoint
			});

		player = new AssessmentPlayer({
			assessment,
			organizationId: organizationId || undefined,
			bundleHost,
			mode,
			loadItem,
			authoringCallbacks,
			onItemChanged: async () => {
				// host can listen to toolkit events if desired; we keep default behavior minimal
			}
		});

		questionRefs = getAllQuestionRefs(assessment);

		// Initialize navigation state now that we know total items
		const totalItems = questionRefs.length;
		navigationState = {
			...navigationState,
			totalItems,
			canNext: totalItems > 1,
			canPrevious: false,
			isLoading: true
		};

		const unsubNav = player.onNavigationChange((state) => {
			navigationState = state;
			rubricBlocks =
				player
					?.getCurrentSectionRubricBlocks?.()
					?.filter((b: any) => b?.view === 'candidate') ?? [];
		});

		const unsubItem = player.onItemChange((item) => {
			currentItem = item;
			config = item?.config as ItemConfig | undefined;
		});

		const unsubLoading = player.onLoadingChange((loading) => {
			isLoadingItem = loading;
		});

		const unsubSession = player.onSessionChange((session) => {
			sessionState = session;
		});

		// Start at first item
		player.navigate(0);

		return () => {
			window.removeEventListener('resize', computeHeight);

			unsubNav();
			unsubItem();
			unsubLoading();
			unsubSession();

			player?.destroy();
		};
	});
</script>

<div
	bind:this={containerEl}
	class="assessment-player grid grid-rows-[auto_1fr_auto_auto] bg-base-200"
	style={`height:${containerHeight}`}
>
	<!-- Pieoneer / SchoolCity-like header -->
	<div class="bg-base-100 border-b border-base-300">
		<div class="px-4 py-3 flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="text-sm font-semibold truncate">{assessment?.name || 'Assessment'}</div>
				<div class="text-xs opacity-70">{navigationState.totalItems} Questions</div>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs opacity-70 mr-2">Student Name</span>
				<button class="btn btn-sm btn-outline" onclick={toggleAudio}>Audio</button>
				<button class="btn btn-sm btn-outline" onclick={toggleContrast}>Contrast</button>
				<button class="btn btn-sm btn-outline" onclick={toggleFullscreen}>Fullscreen</button>
			</div>
		</div>

		<!-- Question strip -->
		<div class="px-4 pb-3 overflow-x-auto">
			<div class="flex items-center gap-2 min-w-max">
				{#each questionRefs as _ref, i}
					<button
						class="btn btn-sm"
						class:btn-primary={i === navigationState.currentIndex}
						class:btn-outline={i !== navigationState.currentIndex}
						onclick={() => handleNavigateToIndex(i)}
					>
						{i + 1}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Content area -->
	<div class="overflow-hidden">
		<main class="h-full overflow-hidden p-3">
			<div
				class="h-full grid gap-3"
				class:grid-cols-1={rubricBlocks.length === 0}
				class:grid-cols-[minmax(280px,40%)_1fr]={rubricBlocks.length > 0}
			>
				{#if rubricBlocks.length > 0}
					<aside class="overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-4">
						{#each rubricBlocks as block, idx (idx)}
							<section class="prose max-w-none">
								{@html block.content || ''}
							</section>
							{#if idx < rubricBlocks.length - 1}
								<div class="divider my-4"></div>
							{/if}
						{/each}
					</aside>
				{/if}

				<section class="overflow-y-auto rounded-lg border border-base-300 bg-base-100">
					{#if isLoadingItem}
						<div class="flex items-center justify-center h-full">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if currentItem && config}
						<pie-iife-player
							bind:this={piePlayerElement}
							hosted={false}
							show-bottom-border={true}
							bundle-host={bundleHost}
							mode={mode}
							configuration={configuration}
							style="--pie-item-padding: 0.75rem; --pie-choice-gap: 0.5rem;"
						></pie-iife-player>
					{:else}
						<div class="flex items-center justify-center h-full">
							<div class="prose text-center">
								<h1>Item could not be loaded.</h1>
								<p>
									There was an error loading question {navigationState.currentIndex + 1}.
								</p>
							</div>
						</div>
					{/if}
				</section>
			</div>
		</main>
	</div>

	<!-- Bottom tool strip -->
	<div class="bg-base-100 border-t border-base-300 px-4 py-2 min-h-14 relative z-[3500]">
		<div class="text-xs opacity-60 mb-2">Tools</div>
		<pie-tool-toolbar
			class="block w-full"
			position="bottom"
			show-labels={true}
			tools="calculator,graph,periodicTable,protractor,lineReader,magnifier,ruler"
			toolCoordinator={player?.getToolCoordinator()}
			highlightCoordinator={player?.getHighlightCoordinator()}
		></pie-tool-toolbar>
	</div>

	<!-- Bottom navigation -->
	<footer class="flex items-center justify-center gap-3 px-4 py-2 bg-base-100 border-t border-base-300 min-h-0">
		{#if navigationState.currentIndex !== -1}
			<span class="text-xs opacity-70">
				Question {navigationState.currentIndex + 1} of {navigationState.totalItems}
			</span>
		{/if}
		<div class="join">
			<button class="btn btn-sm join-item btn-outline" onclick={handlePrevious} disabled={!navigationState.canPrevious}>
				← Back
			</button>
			<button class="btn btn-sm join-item btn-primary" onclick={handleNext} disabled={!navigationState.canNext}>
				Next →
			</button>
		</div>
	</footer>
</div>
