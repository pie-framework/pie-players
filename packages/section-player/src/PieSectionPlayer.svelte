<!--
  pie-section-player Custom Element

  A web component for rendering QTI 3.0 assessment sections with passages and items.
  Supports two modes based on keepTogether attribute:
  - keepTogether=true:  Page mode (all items visible with passages)
  - keepTogether=false: Item mode (one item at a time)

  Usage:
    <pie-section-player
      section='{"identifier":"section-1","keepTogether":true,...}'
      mode="gather"
      view="candidate"
      bundle-host="https://cdn.pie.org"
      esm-cdn-url="https://esm.sh">
    </pie-section-player>

  Events:
    - section-loaded: Fired when section is loaded and ready
    - item-changed: Fired when current item changes (item mode only)
    - section-complete: Fired when all items completed
    - player-error: Fired on errors
-->
<svelte:options
	customElement={{
		tag: 'pie-section-player',
		shadow: 'none',
		props: {
			// Core props
			section: { attribute: 'section', type: 'Object' },
			mode: { attribute: 'mode', type: 'String' },
			view: { attribute: 'view', type: 'String' },
			layout: { attribute: 'layout', type: 'String' },

			// Item sessions for restoration
			itemSessions: { attribute: 'item-sessions', type: 'Object' },

			// Bundle/CDN configuration
			bundleHost: { attribute: 'bundle-host', type: 'String' },
			esmCdnUrl: { attribute: 'esm-cdn-url', type: 'String' },
			playerVersion: { attribute: 'player-version', type: 'String' },
			useLegacyPlayer: { attribute: 'use-legacy-player', type: 'Boolean' },

			// Styling
			customClassname: { attribute: 'custom-classname', type: 'String' },

			// Debug
			debug: { attribute: 'debug', type: 'String' }
		}
	}}
/>

<script lang="ts">
	import type {
		ItemEntity,
		PassageEntity,
		QtiAssessmentSection,
		RubricBlock
	} from '@pie-players/pie-players-shared/types';
	import { onMount, untrack } from 'svelte';
	import ItemModeLayout from './components/ItemModeLayout.svelte';
	import SplitPanelLayout from './components/layouts/SplitPanelLayout.svelte';
	import VerticalLayout from './components/layouts/VerticalLayout.svelte';

	// Props
	let {
		section = null as QtiAssessmentSection | null,
		mode = 'gather' as 'gather' | 'view' | 'evaluate' | 'author',
		view = 'candidate' as 'candidate' | 'scorer' | 'author' | 'proctor' | 'testConstructor' | 'tutor',
		layout = 'split-panel' as 'vertical' | 'split-panel',
		itemSessions = {} as Record<string, any>,
		bundleHost = '',
		esmCdnUrl = '',
		playerVersion = 'latest',
		useLegacyPlayer = true,
		customClassname = '',
		debug = '' as string | boolean,

		// Service integration (optional - for TTS, tools, highlighting)
		ttsService = null as any,
		toolCoordinator = null as any,
		highlightCoordinator = null as any,
		catalogResolver = null as any,

		// Event handlers
		onsessionchanged = null as ((event: CustomEvent) => void) | null
	} = $props();

	// State
	let passages = $state<PassageEntity[]>([]);
	let items = $state<ItemEntity[]>([]);
	let rubricBlocks = $state<RubricBlock[]>([]);
	let currentItemIndex = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Computed
	let isPageMode = $derived(section?.keepTogether === true);
	let currentItem = $derived(isPageMode ? null : items[currentItemIndex] || null);
	let canNavigateNext = $derived(!isPageMode && currentItemIndex < items.length - 1);
	let canNavigatePrevious = $derived(!isPageMode && currentItemIndex > 0);

	// Extract content from section
	function extractContent() {
		if (!section) {
			passages = [];
			items = [];
			rubricBlocks = [];
			return;
		}

		const passageMap = new Map<string, PassageEntity>();

		// Extract rubric blocks for current view
		rubricBlocks = (section.rubricBlocks || []).filter(rb => rb.view === view);

		// 1. Extract passages from rubricBlocks
		for (const rb of rubricBlocks) {
			if (rb.use === 'passage' && rb.passage) {
				passageMap.set(rb.passage.id, rb.passage);
			}
		}

		// 2. Extract items and their linked passages
		items = [];
		for (const itemRef of section.assessmentItemRefs || []) {
			if (itemRef.item) {
				items.push(itemRef.item);

				// Item-linked passage (deduplicated)
				if (itemRef.item.passage && typeof itemRef.item.passage === 'object') {
					if (!passageMap.has(itemRef.item.passage.id)) {
						passageMap.set(itemRef.item.passage.id, itemRef.item.passage);
					}
				}
			}
		}

		passages = Array.from(passageMap.values());
	}

	// Navigate to item (item mode only)
	function navigateToItem(index: number) {
		if (isPageMode) {
			console.warn('[PieSectionPlayer] Navigation called in page mode - ignoring');
			return;
		}

		if (index < 0 || index >= items.length) {
			return;
		}

		const previousItemId = currentItem?.id || '';
		currentItemIndex = index;

		// Dispatch event
		dispatchEvent(new CustomEvent('item-changed', {
			detail: {
				previousItemId,
				currentItemId: currentItem?.id || '',
				itemIndex: currentItemIndex,
				totalItems: items.length,
				timestamp: Date.now()
			},
			bubbles: true,
			composed: true
		}));
	}

	// Public navigation methods (for item mode)
	export function navigateNext() {
		if (canNavigateNext) {
			navigateToItem(currentItemIndex + 1);
		}
	}

	export function navigatePrevious() {
		if (canNavigatePrevious) {
			navigateToItem(currentItemIndex - 1);
		}
	}

	export function getNavigationState() {
		return {
			currentIndex: currentItemIndex,
			totalItems: items.length,
			canNext: canNavigateNext,
			canPrevious: canNavigatePrevious,
			isLoading
		};
	}

	// Lifecycle
	onMount(() => {
		extractContent();

		// Dispatch loaded event
		dispatchEvent(new CustomEvent('section-loaded', {
			detail: {
				sectionId: section?.identifier || '',
				itemCount: items.length,
				passageCount: passages.length,
				isPageMode
			},
			bubbles: true,
			composed: true
		}));
	});

	// React to section changes
	$effect(() => {
		// Track section to react to changes, but don't track the execution of extractContent
		const currentSection = section;
		if (currentSection) {
			untrack(() => extractContent());
		}
	});

	// Get instructions
	let instructions = $derived(
		rubricBlocks.filter(rb => rb.use === 'instructions')
	);

	// Get passage rubric blocks
	let passageRubricBlocks = $derived(
		rubricBlocks.filter(rb => rb.use === 'passage')
	);

	// Handle session changes from items
	function handleSessionChanged(itemId: string, sessionDetail: any) {
		console.log('[PieSectionPlayer] handleSessionChanged called:', itemId, sessionDetail);

		// Extract the actual session data from the event detail
		// The sessionDetail contains { complete, component, session }
		// We want to store the session property
		const actualSession = sessionDetail.session || sessionDetail;

		// Update local sessions
		itemSessions = {
			...itemSessions,
			[itemId]: actualSession
		};

		// Create event detail
		const eventDetail = {
			itemId,
			session: actualSession,
			complete: sessionDetail.complete,
			timestamp: Date.now()
		};

		// Call handler prop if provided (for Svelte component usage)
		if (onsessionchanged) {
			const customEvent = new CustomEvent('session-changed', {
				detail: eventDetail,
				bubbles: true,
				composed: true
			});
			onsessionchanged(customEvent);
		}

		// Also dispatch event (for custom element usage)
		dispatchEvent(new CustomEvent('session-changed', {
			detail: eventDetail,
			bubbles: true,
			composed: true
		}));
	}

	// Get current item session
	let currentItemSession = $derived(
		currentItem ? itemSessions[currentItem.id || ''] : undefined
	);
</script>

<div class="pie-section-player {customClassname}" class:page-mode={isPageMode} class:item-mode={!isPageMode}>
	{#if error}
		<div class="error">
			<p>Error loading section: {error}</p>
		</div>
	{:else if section}
		<!-- Instructions -->
		{#if instructions.length > 0}
			<div class="section-instructions">
				{#each instructions as rb}
					{#if rb.passage && rb.passage.config}
						<pie-esm-player
							config={JSON.stringify(rb.passage.config)}
							env={JSON.stringify({ mode: 'view' })}
							bundle-host={bundleHost}
							esm-cdn-url={esmCdnUrl}
						></pie-esm-player>
					{/if}
				{/each}
			</div>
		{/if}

		{#if isPageMode}
			<!-- Page Mode: Choose layout based on layout prop -->
			{#if layout === 'split-panel'}
				<SplitPanelLayout
					{passages}
					{items}
					{itemSessions}
					{mode}
					{bundleHost}
					{esmCdnUrl}
					{playerVersion}
					{useLegacyPlayer}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					{catalogResolver}
					onsessionchanged={handleSessionChanged}
				/>
			{:else}
				<!-- Default: vertical layout -->
				<VerticalLayout
					{passages}
					{items}
					{itemSessions}
					{mode}
					{bundleHost}
					{esmCdnUrl}
					{playerVersion}
					{useLegacyPlayer}
					{ttsService}
					{toolCoordinator}
					{highlightCoordinator}
					{catalogResolver}
					onsessionchanged={handleSessionChanged}
				/>
			{/if}
		{:else}
			<!-- Item Mode: Use internal Svelte component -->
			<ItemModeLayout
				{passages}
				{currentItem}
				currentIndex={currentItemIndex}
				totalItems={items.length}
				canNext={canNavigateNext}
				canPrevious={canNavigatePrevious}
				itemSession={currentItemSession}
				{mode}
				{bundleHost}
				{esmCdnUrl}
				{playerVersion}
				{useLegacyPlayer}
				{ttsService}
				{toolCoordinator}
				{highlightCoordinator}
				{catalogResolver}
				onprevious={navigatePrevious}
				onnext={navigateNext}
				onsessionchanged={(sessionDetail) => handleSessionChanged(currentItem?.id || '', sessionDetail)}
			/>
		{/if}
	{:else}
		<div class="loading">
			<p>Loading section...</p>
		</div>
	{/if}
</div>

<style>
	.pie-section-player {
		display: block;
		width: 100%;
		height: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	.error {
		padding: 1rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c00;
	}

	.loading {
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	.section-instructions {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 4px;
	}
</style>
