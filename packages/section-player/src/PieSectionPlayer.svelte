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
      player-type="esm"
      bundle-host="https://cdn.pie.org"
      esm-cdn-url="https://esm.sh">
    </pie-section-player>

  Player Types (player-type attribute):
    - "auto" (default): Automatically choose based on bundle-host/esm-cdn-url
    - "iife": Use IIFE player (SystemJS bundles) - requires bundle-host
    - "esm": Use ESM player (ESM CDN) - requires esm-cdn-url
    - "fixed": Use fixed player (pre-bundled elements)
    - "inline": Use inline player (single-request rendering)

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
			env: { attribute: 'env', type: 'Object' },
			view: { attribute: 'view', type: 'String' },
			layout: { attribute: 'layout', type: 'String' },

			// Item sessions for restoration
			itemSessions: { attribute: 'item-sessions', type: 'Object' },

			// Bundle/CDN configuration
			bundleHost: { attribute: 'bundle-host', type: 'String' },
			esmCdnUrl: { attribute: 'esm-cdn-url', type: 'String' },
			playerVersion: { attribute: 'player-version', type: 'String' },

			// Styling
			customClassname: { attribute: 'custom-classname', type: 'String' },

			// Player type selection
			playerType: { attribute: 'player-type', type: 'String' },

			// Tools toolbar position
			toolbarPosition: { attribute: 'toolbar-position', type: 'String' },

			// Debug
			debug: { attribute: 'debug', type: 'String' },

			// Toolkit coordinator (JS property, not attribute)
			toolkitCoordinator: { type: 'Object', reflect: false }
		}
	}}
/>

<script lang="ts">

	import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { type ElementLoaderInterface, EsmElementLoader, IifeElementLoader } from '@pie-players/pie-players-shared/loaders';
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

	// Import section tools toolbar web component
	import '@pie-players/pie-section-tools-toolbar';

	// Props
	let {
		section = null as QtiAssessmentSection | null,
		env = { mode: 'gather', role: 'student' } as { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' },
		view = 'candidate' as 'candidate' | 'scorer' | 'author' | 'proctor' | 'testConstructor' | 'tutor',
		layout = 'split-panel' as 'vertical' | 'split-panel',
		itemSessions = {} as Record<string, any>,
		bundleHost = '',
		esmCdnUrl = '',
		playerVersion = 'latest',
		playerType = 'auto' as 'auto' | 'iife' | 'esm' | 'fixed' | 'inline',
		customClassname = '',
		toolbarPosition = 'right' as 'top' | 'right' | 'bottom' | 'left',
		debug = '' as string | boolean,

		// Toolkit coordinator (optional - creates default if not provided)
		toolkitCoordinator = null as any,

		// Event handlers
		onsessionchanged = null as ((event: CustomEvent) => void) | null
	} = $props();

	// Generate or use provided coordinator
	const coordinator = $derived.by(() => {
		if (toolkitCoordinator) return toolkitCoordinator;

		// Generate default assessmentId for standalone sections
		const fallbackId = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;

		return new ToolkitCoordinator({
			assessmentId: fallbackId,
			tools: {
				tts: { enabled: true },
				answerEliminator: { enabled: true }
			}
		});
	});

	// Extract services from coordinator
	const services = $derived(coordinator.getServiceBundle());
	const assessmentId = $derived(coordinator.assessmentId);

	// Generate or extract sectionId
	const sectionId = $derived.by(() => {
		if (section?.identifier) return section.identifier;
		return `section_${Date.now()}_${Math.random().toString(16).slice(2)}`;
	});

	// State
	let passages = $state<PassageEntity[]>([]);
	let items = $state<ItemEntity[]>([]);
	let rubricBlocks = $state<RubricBlock[]>([]);
	let currentItemIndex = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Element loading state
	let elementsLoaded = $state(false);

	// TTS error state
	let ttsError = $state<string | null>(null);

	// Section tools toolbar element reference
	let toolbarElement = $state<HTMLElement | null>(null);

	// Section toolbar enabled tools (reactive state)
	let sectionToolsEnabled = $state<string[]>([]);

	// Subscribe to floating tools changes from coordinator
	$effect(() => {
		if (coordinator) {
			const unsubscribe = coordinator.onFloatingToolsChange((toolIds: string[]) => {
				sectionToolsEnabled = toolIds;
			});
			return unsubscribe;
		}
	});

	// Computed
	let isPageMode = $derived(section?.keepTogether === true);
	let currentItem = $derived(isPageMode ? null : items[currentItemIndex] || null);
	let canNavigateNext = $derived(!isPageMode && currentItemIndex < items.length - 1);
	let canNavigatePrevious = $derived(!isPageMode && currentItemIndex > 0);

	// Extract mode from env for convenience
	let mode = $derived(env.mode);

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
		// IMPORTANT: Always extract passages from 'candidate' view, regardless of current view
		// Passages should be visible in both candidate and scorer modes
		const allRubricBlocks = section.rubricBlocks || [];
		for (const rb of allRubricBlocks) {
			if (rb.class === 'stimulus' && rb.passage && rb.passage.id) {
				// Include passages from candidate view (always shown) and current view
				if (rb.view === 'candidate' || rb.view === view) {
					passageMap.set(rb.passage.id, rb.passage);
				}
			}
		}

		// 2. Extract items and their linked passages
		items = [];
		for (const itemRef of section.assessmentItemRefs || []) {
			if (itemRef.item) {
				items.push(itemRef.item);

				// Item-linked passage (deduplicated)
				if (itemRef.item.passage && typeof itemRef.item.passage === 'object' && itemRef.item.passage.id) {
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

	// Element pre-loading effect (loads all unique elements before rendering items)
	$effect(() => {
		if (!section) {
			elementsLoaded = false;
			return;
		}

		// Collect all items (passages + questions) that need elements loaded
		const allItems: ItemEntity[] = [
			...passages,
			...items
		];

		if (allItems.length === 0) {
			elementsLoaded = true;
			return;
		}

		// Create appropriate loader based on configuration
		let loader: ElementLoaderInterface | null = null;

		if (esmCdnUrl) {
			loader = new EsmElementLoader({
				esmCdnUrl,
				debugEnabled: () => !!debug
			});
		} else if (bundleHost) {
			loader = new IifeElementLoader({
				bundleHost,
				debugEnabled: () => !!debug
			});
		} else {
			console.warn('[PieSectionPlayer] No loader configuration provided (esmCdnUrl or bundleHost)');
			elementsLoaded = true;
			return;
		}

		// Load all elements upfront
		loader.loadFromItems(allItems, {
			view: mode === 'author' ? 'author' : 'delivery',
			needsControllers: true
		})
			.then(() => {
				elementsLoaded = true;
				console.log(`[PieSectionPlayer] Loaded elements for ${allItems.length} items`);
			})
			.catch((err) => {
				console.error('[PieSectionPlayer] Failed to load elements:', err);
				// Still set loaded to true to allow rendering (items will handle their own errors)
				elementsLoaded = true;
			});

		// Cleanup
		return () => {
			// Cleanup if needed
		};
	});

	// Listen for TTS errors
	$effect(() => {
		const ttsService = services.ttsService;
		if (!ttsService) {
			ttsError = null;
			return;
		}

		const handleTTSStateChange = (state: any) => {
			// PlaybackState.ERROR = "error"
			if (state === 'error') {
				const errorMsg = ttsService.getLastError?.() || 'Text-to-speech error occurred';
				ttsError = errorMsg;
				console.error('[PieSectionPlayer] TTS error:', errorMsg);
			} else if (state === 'playing' || state === 'loading') {
				// Clear error when successfully starting playback
				ttsError = null;
			}
		};

		ttsService.onStateChange?.('section-player', handleTTSStateChange);

		// Cleanup
		return () => {
			ttsService.offStateChange?.('section-player', handleTTSStateChange);
		};
	});

	// Get instructions
	let instructions = $derived(
		rubricBlocks.filter(rb => rb.class === 'instructions')
	);

	// Handle session changes from items
	function handleSessionChanged(itemId: string, sessionDetail: any) {
		console.log('[PieSectionPlayer] handleSessionChanged called:', itemId, sessionDetail);

		// Extract the actual session data from the event detail
		// The sessionDetail contains { complete, component, session }
		// We want to store the session property
		const actualSession = sessionDetail.session || sessionDetail;

		// Only update itemSessions if we have valid session data structure
		// The session should have an 'id' property and a 'data' array
		// Skip metadata-only events that just have { complete, component }
		if (actualSession && ('id' in actualSession || 'data' in actualSession)) {
			// Update local sessions with pure session data (no metadata mixed in)
			itemSessions = {
				...itemSessions,
				[itemId]: actualSession
			};
		}

		// Create event detail with session and metadata kept separate
		const eventDetail = {
			itemId,
			session: itemSessions[itemId] || actualSession,
			complete: sessionDetail.complete,
			component: sessionDetail.component,
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

	// Compute enabled tools string from reactive state
	let enabledToolsString = $derived(sectionToolsEnabled.join(','));

	// Bind toolkitCoordinator, registry, position, and enabled tools to toolbar element
	$effect(() => {
		if (toolbarElement) {
			if (coordinator) {
				(toolbarElement as any).toolCoordinator = coordinator.toolCoordinator;
				(toolbarElement as any).toolProviderRegistry = coordinator.toolProviderRegistry;
			}
			// Set position property and attribute
			(toolbarElement as any).position = toolbarPosition;
			toolbarElement.setAttribute('position', toolbarPosition);
			toolbarElement.setAttribute('data-position', toolbarPosition);
			// Set enabled tools
			(toolbarElement as any).enabledTools = enabledToolsString;
			toolbarElement.setAttribute('enabled-tools', enabledToolsString);
		}
	});
</script>

<div
	class="pie-section-player {customClassname}"
	class:page-mode={isPageMode}
	class:item-mode={!isPageMode}
	data-assessment-id={assessmentId}
	data-section-id={sectionId}
>
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

		<!-- TTS Error Banner -->
		{#if ttsError}
			<div class="tts-error-banner" role="alert">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<span>Text-to-speech unavailable: {ttsError}</span>
				<button
					class="tts-error-dismiss"
					onclick={() => ttsError = null}
					aria-label="Dismiss error"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		{/if}

		<!-- Main content area -->
		<div class="pie-section-player__content">
			{#if elementsLoaded}
				{#if isPageMode}
					<!-- Page Mode: Choose layout based on layout prop -->
					{#if layout === 'split-panel'}
						<SplitPanelLayout
							{passages}
							{items}
							{itemSessions}
							{env}
							{bundleHost}
							{esmCdnUrl}
							{playerVersion}
							{playerType}
							{assessmentId}
							{sectionId}
							toolkitCoordinator={coordinator}

							onsessionchanged={handleSessionChanged}
						/>
					{:else}
						<!-- Default: vertical layout -->
						<VerticalLayout
							{passages}
							{items}
							{itemSessions}
							{env}
							{bundleHost}
							{esmCdnUrl}
							{playerVersion}
							{playerType}
							{assessmentId}
							{sectionId}
							toolkitCoordinator={coordinator}

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
						{env}
						{bundleHost}
						{esmCdnUrl}
						{playerVersion}
						{playerType}
						{assessmentId}
						{sectionId}
						toolkitCoordinator={coordinator}

						onprevious={navigatePrevious}
						onnext={navigateNext}
						onsessionchanged={(sessionDetail) => handleSessionChanged(currentItem?.id || '', sessionDetail)}
					/>
				{/if}
			{:else}
				<div class="loading">
					<p>Loading assessment elements...</p>
				</div>
			{/if}
		</div>

		<!-- Section-level floating tools toolbar -->
		<pie-section-tools-toolbar
			bind:this={toolbarElement}
			position={toolbarPosition}
			enabled-tools={enabledToolsString}
		></pie-section-tools-toolbar>
	{:else}
		<div class="loading">
			<p>Loading section...</p>
		</div>
	{/if}
</div>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}
	.pie-section-player {
		display: flex;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	/* Layout direction based on toolbar position */
	.pie-section-player:has(pie-section-tools-toolbar[position="top"]),
	.pie-section-player:has(pie-section-tools-toolbar[position="bottom"]),
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="top"])),
	.pie-section-player:has(
		:global(pie-section-tools-toolbar[data-position="bottom"])
	),
	.pie-section-player:not(:has(pie-section-tools-toolbar[position])):not(:has(pie-section-tools-toolbar[data-position])) {
		flex-direction: column;
	}

	.pie-section-player:has(pie-section-tools-toolbar[position="left"]),
	.pie-section-player:has(pie-section-tools-toolbar[position="right"]),
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="left"])),
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="right"])) {
		flex-direction: row;
	}

	/* Toolbar ordering - control whether toolbar appears before or after content */
	.pie-section-player:has(pie-section-tools-toolbar[position="top"]) .pie-section-player__content,
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="top"]))
		.pie-section-player__content {
		order: 2;
	}

	.pie-section-player:has(pie-section-tools-toolbar[position="top"]) pie-section-tools-toolbar,
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="top"]))
		pie-section-tools-toolbar {
		order: 1;
	}

	.pie-section-player:has(pie-section-tools-toolbar[position="left"]) .pie-section-player__content,
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="left"]))
		.pie-section-player__content {
		order: 2;
	}

	.pie-section-player:has(pie-section-tools-toolbar[position="left"]) pie-section-tools-toolbar,
	.pie-section-player:has(:global(pie-section-tools-toolbar[data-position="left"]))
		pie-section-tools-toolbar {
		order: 1;
	}

	/* Main content area takes remaining space */
	.pie-section-player__content {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
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

	.tts-error-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		margin-bottom: 1rem;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		color: #856404;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.tts-error-banner svg {
		flex-shrink: 0;
	}

	.tts-error-banner span {
		flex: 1;
	}

	.tts-error-dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		border-radius: 2px;
		color: #856404;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.tts-error-dismiss:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.tts-error-dismiss:focus {
		outline: 2px solid #856404;
		outline-offset: 2px;
	}
</style>
