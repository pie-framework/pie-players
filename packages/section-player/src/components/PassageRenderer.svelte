<!--
  PassageRenderer - Internal Component

  Renders a single passage using either pie-iife-player or pie-esm-player.
  Player selection is automatic based on bundleHost (IIFE) vs esmCdnUrl (ESM).
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	
	import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';
	import type { PassageEntity } from '@pie-players/pie-players-shared/types';
import { onMount, untrack } from 'svelte';

	let {
		passage,
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		catalogResolver = null,
		class: className = ''
	}: {
		passage: PassageEntity;
		bundleHost?: string;
		esmCdnUrl?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		catalogResolver?: any;
		class?: string;
	} = $props();

	// Get the DOM element reference for service binding
	// @ts-expect-error - Used in bind:this but TypeScript doesn't recognize it
	let passageElement: HTMLElement | null = $state(null);
	// @ts-expect-error - Used in bind:this but TypeScript doesn't recognize it
	let passageContentElement: HTMLElement | null = $state(null);
	let ttsToolElement: HTMLElement | null = $state(null);
	let playerElement: any = $state(null);

	// Track if services have been bound
	let servicesBound = $state(false);

	// Track last config to avoid unnecessary updates
	let lastConfig: any = null;

	// Check if passage has PIE elements or is just plain HTML
	let hasElements = $derived(
		passage.config?.elements && Object.keys(passage.config.elements).length > 0
	);

	// Determine which player to use based on configuration
	// Prefer IIFE if bundleHost is provided, otherwise use ESM
	let useIifePlayer = $derived(!!bundleHost);

	// Import the appropriate player web component (only if passage has PIE elements)
	onMount(() => {
		// Import TTS tool on client side only (avoids SSR customElements error)
		(async () => {
			await import('@pie-players/pie-tool-tts-inline');

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

	// Bind services to TTS tool (must be JS properties)
	$effect(() => {
		if (ttsToolElement && !servicesBound) {
			// Set services as JS properties
			if (toolCoordinator) {
				(ttsToolElement as any).coordinator = toolCoordinator;
			}
			if (ttsService) {
				(ttsToolElement as any).ttsService = ttsService;
			}
			if (highlightCoordinator) {
				(ttsToolElement as any).highlightCoordinator = highlightCoordinator;
			}
			servicesBound = true;
		}
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
	<div class="passage-renderer {className}" bind:this={passageElement}>
		<div class="passage-header">
			<h3 class="passage-title">{passage.name || 'Passage'}</h3>
			<!-- Only render if TTS service available -->
			{#if ttsService}
				<pie-tool-tts-inline
					bind:this={ttsToolElement}
					tool-id="tts-passage-{passage.id}"
					catalog-id={passage.id}
					language="en-US"
					size="md"
				></pie-tool-tts-inline>
			{/if}
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
