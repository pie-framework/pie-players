<!--
  PassageRenderer - Internal Component

  Renders a single passage using either pie-iife-player or pie-esm-player.
  Player selection is automatic based on bundleHost (IIFE) vs esmCdnUrl (ESM).
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">

	import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-assessment-toolkit/components/QuestionToolBar.svelte';
	import type { PassageEntity } from '@pie-players/pie-players-shared/types';
	import { onMount, untrack } from 'svelte';

	let {
		passage,
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		assessmentId = '',
		sectionId = '',
		toolkitCoordinator = null,
		class: className = ''
	}: {
		passage: PassageEntity;
		bundleHost?: string;
		esmCdnUrl?: string;
		assessmentId?: string;
		sectionId?: string;
		toolkitCoordinator?: any;
		class?: string;
	} = $props();

	// Extract individual services from coordinator
	const ttsService = $derived(toolkitCoordinator?.ttsService);
	const toolCoordinator = $derived(toolkitCoordinator?.toolCoordinator);
	const highlightCoordinator = $derived(toolkitCoordinator?.highlightCoordinator);
	const catalogResolver = $derived(toolkitCoordinator?.catalogResolver);
	const elementToolStateStore = $derived(toolkitCoordinator?.elementToolStateStore);

	// Get the DOM element reference for service binding
	let passageElement: HTMLElement | null = $state(null);
	let passageContentElement: HTMLElement | null = $state(null);
	let questionToolbarElement: HTMLElement | null = $state(null);
	let playerElement: any = $state(null);
	let calculatorElement: HTMLElement | null = $state(null);

	// Set toolkitCoordinator on calculator element
	$effect(() => {
		if (calculatorElement && toolkitCoordinator) {
			(calculatorElement as any).toolkitCoordinator = toolkitCoordinator;
		}
	});

	// Track if services have been bound
	let toolbarServicesBound = $state(false);
	let calculatorVisible = $state(false);

	// Track last config to avoid unnecessary updates
	let lastConfig: any = null;

	// Check if passage has PIE elements or is just plain HTML
	let hasElements = $derived(
		passage.config?.elements && Object.keys(passage.config.elements).length > 0
	);

	// Determine which player to use based on configuration
	// Prefer IIFE if bundleHost is provided, otherwise use ESM
	let useIifePlayer = $derived(!!bundleHost);

	// Import the appropriate player web component
	onMount(() => {
		// Import components on client side only
		(async () => {
			// Import player (only if passage has PIE elements)
			if (hasElements) {
				if (useIifePlayer) {
					await import('@pie-players/pie-iife-player');
				} else {
					await import('@pie-players/pie-esm-player');
				}
			}
		})();

		// Cleanup: Clear passage catalogs on unmount
		return () => {
			if (catalogResolver) {
				catalogResolver.clearItemCatalogs();
			}
		};
	});

	// Extract SSML from passage config when passage changes
	$effect(() => {
		if (passage?.config && catalogResolver) {
			// Skip if already extracted
			if (passage.config.extractedCatalogs) {
				catalogResolver.clearItemCatalogs();
				catalogResolver.addItemCatalogs(passage.config.extractedCatalogs);
				return;
			}

			const extractor = new SSMLExtractor();
			const result = extractor.extractFromItemConfig(passage.config);

			// Update config with cleaned content (SSML removed, catalog IDs added)
			untrack(() => {
				passage.config = result.cleanedConfig;
				passage.config.extractedCatalogs = result.catalogs;
			});

			// Register catalogs with resolver for TTS lookup
			if (result.catalogs.length > 0) {
				catalogResolver.clearItemCatalogs(); // Clear previous passage's catalogs
				catalogResolver.addItemCatalogs(result.catalogs);
				console.debug(`[PassageRenderer] Extracted ${result.catalogs.length} SSML catalogs for passage ${passage.id}`);
			}
		}
	});


	// Bind services, scope, and IDs to question toolbar (must be JS properties)
	$effect(() => {
		if (questionToolbarElement && !toolbarServicesBound) {
			if (toolCoordinator) {
				(questionToolbarElement as any).toolCoordinator = toolCoordinator;
			}
			if (ttsService) {
				(questionToolbarElement as any).ttsService = ttsService;
			}
			if (highlightCoordinator) {
				(questionToolbarElement as any).highlightCoordinator = highlightCoordinator;
			}
			if (passageContentElement) {
				(questionToolbarElement as any).scopeElement = passageContentElement;
			}
			if (elementToolStateStore) {
				(questionToolbarElement as any).elementToolStateStore = elementToolStateStore;
			}
			if (assessmentId) {
				(questionToolbarElement as any).assessmentId = assessmentId;
			}
			if (sectionId) {
				(questionToolbarElement as any).sectionId = sectionId;
			}
			toolbarServicesBound = true;
		}
	});


	// Subscribe to calculator visibility changes
	$effect(() => {
		if (!toolCoordinator || !passage) return;

		const unsubscribe = toolCoordinator.subscribe(() => {
			calculatorVisible = toolCoordinator.isToolVisible(`calculator-${passage.id}`);
		});

		// Initial update
		calculatorVisible = toolCoordinator.isToolVisible(`calculator-${passage.id}`);

		return unsubscribe;
	});

	// Set player properties imperatively when config changes
	$effect(() => {
		const currentConfig = passage.config;

		if (playerElement && currentConfig) {
			if (currentConfig !== lastConfig) {
				untrack(() => {
					playerElement.config = currentConfig;
					playerElement.env = { mode: 'view' };
				});

				lastConfig = currentConfig;
			}
		}
	});
</script>

{#if passage.config}
	<div
		class="passage-renderer {className}"
		bind:this={passageElement}
		data-assessment-id={assessmentId}
		data-section-id={sectionId}
		data-item-id={passage.id}
	>
		<div class="passage-header">
			<h3 class="passage-title">{passage.name || 'Passage'}</h3>
			<pie-question-toolbar
				bind:this={questionToolbarElement}
				item-id={passage.id}
				catalog-id={passage.id}
				tools="calculator,tts,answerEliminator"
				size="md"
				language="en-US"
			></pie-question-toolbar>
		</div>

		<div class="passage-content" bind:this={passageContentElement}>
			{#if hasElements}
				<!-- Passage with PIE elements - use player -->
				{#if useIifePlayer}
					<pie-iife-player
						bind:this={playerElement}
						bundle-host={bundleHost}
					></pie-iife-player>
				{:else}
					<pie-esm-player
						bind:this={playerElement}
						esm-cdn-url={esmCdnUrl}
					></pie-esm-player>
				{/if}
			{:else}
				<!-- Plain HTML passage - render directly -->
				{@html passage.config.markup}
			{/if}
		</div>
	</div>

	<!-- Calculator Tool Instance (rendered outside panel for floating overlay) -->
	{#if passage}
		<pie-tool-calculator
			bind:this={calculatorElement}
			visible={calculatorVisible}
			tool-id="calculator-{passage.id}"
		></pie-tool-calculator>
	{/if}
{/if}

<style>
	.passage-renderer {
		display: block;
		margin-bottom: 1rem;
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
	}

	.passage-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
		margin-bottom: 0.5rem;
	}

	.passage-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #1976d2;
	}

	.passage-content {
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
	}
</style>
