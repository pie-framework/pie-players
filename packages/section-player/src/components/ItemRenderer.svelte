<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-legacy-player, pie-iife-player, or pie-esm-player.
  Player selection: legacy (default) > IIFE (if bundleHost) > ESM (if esmCdnUrl).
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { ItemEntity } from '@pie-players/pie-players-shared/types';
	import { ZIndexLayer } from '../utils/z-index';
	import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

	let {
		item,
		mode = 'gather',
		session = { id: '', data: [] },
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		playerVersion = 'latest',
		useLegacyPlayer = true,
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		catalogResolver = null,
		class: className = '',
		onsessionchanged
	}: {
		item: ItemEntity;
		mode?: 'gather' | 'view' | 'evaluate' | 'author';
		session?: any;
		bundleHost?: string;
		esmCdnUrl?: string;
		playerVersion?: string;
		useLegacyPlayer?: boolean;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		catalogResolver?: any;
		class?: string;
		onsessionchanged?: (event: CustomEvent) => void;
	} = $props();

	// Get the DOM element reference for service binding
	let itemElement: HTMLElement | null = $state(null);
	let itemContentElement: HTMLElement | null = $state(null);
	let ttsToolElement: HTMLElement | null = $state(null);
	let playerElement: any = $state(null);

	// Track if services have been bound
	let servicesBound = $state(false);

	// Track last values to avoid unnecessary updates
	let lastConfig: any = null;
	let lastMode: string | null = null;

	// Determine which player to use based on configuration
	// Priority: legacy > IIFE (if bundleHost) > ESM (if esmCdnUrl)
	let playerType = $derived.by(() => {
		if (useLegacyPlayer) return 'legacy';
		if (bundleHost) return 'iife';
		if (esmCdnUrl) return 'esm';
		return 'legacy'; // fallback
	});

	// Import the appropriate player web component
	onMount(async () => {
		// Import TTS tool on client side only (avoids SSR customElements error)
		await import('@pie-players/pie-tool-tts-inline');

		if (playerType === 'legacy') {
			await import('@pie-players/pie-legacy-player');
		} else if (playerType === 'iife') {
			await import('@pie-players/pie-iife-player');
		} else {
			await import('@pie-players/pie-esm-player');
		}

		// Cleanup: Clear item catalogs on unmount
		return () => {
			if (catalogResolver) {
				catalogResolver.clearItemCatalogs();
			}
		};
	});

	// Extract SSML from item config when item changes
	$effect(() => {
		if (item?.config && catalogResolver) {
			// Skip if already extracted
			if (item.config.extractedCatalogs) {
				catalogResolver.clearItemCatalogs();
				catalogResolver.addItemCatalogs(item.config.extractedCatalogs);
				return;
			}

			const extractor = new SSMLExtractor();
			const result = extractor.extractFromItemConfig(item.config);

			// Update config with cleaned content (SSML removed, catalog IDs added)
			untrack(() => {
				item.config = result.cleanedConfig;
				item.config.extractedCatalogs = result.catalogs;
			});

			// Register catalogs with resolver for TTS lookup
			if (result.catalogs.length > 0) {
				catalogResolver.clearItemCatalogs(); // Clear previous item's catalogs
				catalogResolver.addItemCatalogs(result.catalogs);
				console.debug(`[ItemRenderer] Extracted ${result.catalogs.length} SSML catalogs for item ${item.id}`);
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

	// Set player properties imperatively when config or mode changes
	$effect(() => {
		const currentConfig = item.config;
		const currentMode = mode;
		const currentSession = session;

		if (playerElement && currentConfig) {
			if (currentConfig !== lastConfig || currentMode !== lastMode) {
				untrack(() => {
					playerElement.config = currentConfig;
					playerElement.session = currentSession;
					playerElement.env = { mode: currentMode };
				});

				lastConfig = currentConfig;
				lastMode = currentMode;
			}
		}
	});

	// Attach event listener to player element imperatively
	$effect(() => {
		if (playerElement && onsessionchanged) {
			const handler = (event: Event) => {
				console.log('[ItemRenderer] Session changed event received:', event);
				console.log('[ItemRenderer] Full event detail:', (event as CustomEvent).detail);
				onsessionchanged(event as CustomEvent);
			};

			playerElement.addEventListener('session-changed', handler);

			return () => {
				playerElement.removeEventListener('session-changed', handler);
			};
		}
	});

	function handleSessionChanged(event: Event) {
		console.log('[ItemRenderer] handleSessionChanged called:', event);
		console.log('[ItemRenderer] Full event detail:', (event as CustomEvent).detail);
		if (onsessionchanged) {
			onsessionchanged(event as CustomEvent);
		}
	}
</script>

{#if item.config}
	<div class="item-renderer {className}" bind:this={itemElement}>
		<div class="item-header">
			<h4 class="item-title">{item.name || 'Question'}</h4>
			<!-- Only render if TTS service available -->
			{#if ttsService}
				<pie-tool-tts-inline
					bind:this={ttsToolElement}
					tool-id="tts-item-{item.id}"
					catalog-id={item.id}
					language="en-US"
					size="md"
				></pie-tool-tts-inline>
			{/if}
		</div>

		<div class="item-content" bind:this={itemContentElement}>
			{#if playerType === 'legacy'}
				<pie-legacy-player
					bind:this={playerElement}
					player-version={playerVersion}
				></pie-legacy-player>
			{:else if playerType === 'iife'}
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
		</div>
	</div>
{/if}

<style>
	.item-renderer {
		display: block;
		margin-bottom: 1rem;
	}

	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
		margin-bottom: 0.5rem;
	}

	.item-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #1976d2;
	}

	.item-content {
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
	}
</style>
