<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-esm-player.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import '@pie-players/pie-tool-tts-inline';
	import type { ItemEntity } from '@pie-players/pie-players-shared/types';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

	let {
		item,
		mode = 'gather',
		session = { id: '', data: [] },
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		class: className = '',
		onsessionchanged
	}: {
		item: ItemEntity;
		mode?: 'gather' | 'view' | 'evaluate' | 'author';
		session?: any;
		bundleHost?: string;
		esmCdnUrl?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		class?: string;
		onsessionchanged?: (event: CustomEvent) => void;
	} = $props();

	// Get the DOM element reference for service binding
	let itemElement: HTMLElement | null = $state(null);
	let itemContentElement: HTMLElement | null = $state(null);
	let ttsToolElement: HTMLElement | null = $state(null);

	// Bind services and register with coordinator
	$effect(() => {
		if (ttsToolElement) {
			// Set services as JS properties
			if (ttsService) {
				(ttsToolElement as any).ttsService = ttsService;
			}
			if (toolCoordinator) {
				(ttsToolElement as any).coordinator = toolCoordinator;

				// Show/hide tool based on TTS service availability
				if (ttsService) {
					toolCoordinator.showTool(`tts-item-${item.id}`);
				} else {
					toolCoordinator.hideTool(`tts-item-${item.id}`);
				}
			}
		}
	});

	function handleSessionChanged(event: Event) {
		if (onsessionchanged) {
			onsessionchanged(event as CustomEvent);
		}
	}
</script>

{#if item.config}
	<div class="item-renderer {className}" bind:this={itemElement}>
		<div class="item-header">
			<h4 class="item-title">{item.name || 'Question'}</h4>
			<!-- Always rendered, coordinator controls visibility -->
			<pie-tool-tts-inline
				bind:this={ttsToolElement}
				tool-id="tts-item-{item.id}"
				catalog-id={item.id}
				language="en-US"
				size="md"
			></pie-tool-tts-inline>
		</div>

		<div class="item-content" bind:this={itemContentElement}>
			<pie-esm-player
				config={JSON.stringify(item.config)}
				session={JSON.stringify(session)}
				env={JSON.stringify({ mode })}
				bundle-host={bundleHost}
				esm-cdn-url={esmCdnUrl}
				onsessionchanged={handleSessionChanged}
			></pie-esm-player>
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
		padding: 0.75rem 1rem;
		background: #e3f2fd;
		border: 1px solid #90caf9;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
	}

	.item-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #1976d2;
	}

	.item-content {
		border: 1px solid #90caf9;
		border-radius: 0 0 4px 4px;
		padding: 1rem;
		background: white;
	}
</style>
