<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-iife-player or pie-esm-player.
  Handles SSML extraction, TTS service binding, and player lifecycle.
-->
<script lang="ts">
	
	import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';
	import type { ItemEntity } from '@pie-players/pie-players-shared/types';
import { onMount, untrack } from 'svelte';

	let {
		item,
		env = { mode: 'gather', role: 'student' },
		session = { id: '', data: [] },
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		playerVersion = 'latest',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		catalogResolver = null,
		class: className = '',
		onsessionchanged
	}: {
		item: ItemEntity;
		env?: { mode: 'gather' | 'view' | 'evaluate' | 'author'; role: 'student' | 'instructor' };
		session?: any;
		bundleHost?: string;
		esmCdnUrl?: string;
		playerVersion?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		catalogResolver?: any;
		class?: string;
		onsessionchanged?: (event: CustomEvent) => void;
	} = $props();

	// Get the DOM element reference for service binding
	// @ts-expect-error - Used in bind:this but TypeScript doesn't recognize it
	let itemElement: HTMLElement | null = $state(null);
	// @ts-expect-error - Used in bind:this but TypeScript doesn't recognize it
	let itemContentElement: HTMLElement | null = $state(null);
	let ttsToolElement: HTMLElement | null = $state(null);
	let playerElement: any = $state(null);

	// Track if services have been bound
	let servicesBound = $state(false);

	// Track last values to avoid unnecessary updates
	let lastConfig: any = null;
	let lastEnv: any = null;

	// Determine which player to use based on configuration
	// Priority: IIFE (if bundleHost) > ESM (if esmCdnUrl)
	let playerType = $derived.by(() => {
		if (bundleHost) return 'iife';
		if (esmCdnUrl) return 'esm';
		return 'iife'; // fallback
	});

	// Import the appropriate player web component
	onMount(() => {
		// Import TTS tool on client side only (avoids SSR customElements error)
		(async () => {
			await import('@pie-players/pie-tool-tts-inline');

			if (playerType === 'iife') {
				await import('@pie-players/pie-iife-player');
			} else {
				await import('@pie-players/pie-esm-player');
			}
		})();

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

	// Set player properties imperatively when config or env changes
	$effect(() => {
		const currentConfig = item.config;
		const currentEnv = env;
		const currentSession = session;

		if (playerElement && currentConfig) {
			// Check if config or env changed
			const envChanged = !lastEnv || lastEnv.mode !== currentEnv.mode || lastEnv.role !== currentEnv.role;

			if (currentConfig !== lastConfig || envChanged) {
				untrack(() => {
					playerElement.config = currentConfig;
					playerElement.session = currentSession;
					playerElement.env = currentEnv;
				});

				lastConfig = currentConfig;
				lastEnv = currentEnv;
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
		return undefined;
	});
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
			{#if playerType === 'iife'}
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
