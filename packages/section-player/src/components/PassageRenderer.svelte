<!--
  PassageRenderer - Internal Component

  Renders a single passage using pie-esm-player.
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	import '@pie-players/pie-tool-tts-inline';
	import type { PassageEntity } from '@pie-players/pie-players-shared/types';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

	let {
		passage,
		bundleHost = '',
		esmCdnUrl = 'https://esm.sh',
		ttsService = null,
		toolCoordinator = null,
		highlightCoordinator = null,
		class: className = ''
	}: {
		passage: PassageEntity;
		bundleHost?: string;
		esmCdnUrl?: string;
		ttsService?: any;
		toolCoordinator?: any;
		highlightCoordinator?: any;
		class?: string;
	} = $props();

	// Get the DOM element reference for service binding
	let passageElement: HTMLElement | null = $state(null);
	let passageContentElement: HTMLElement | null = $state(null);
	let ttsToolElement: HTMLElement | null = $state(null);

	// Bind services to TTS tool (must be JS properties) and register with coordinator
	$effect(() => {
		if (ttsToolElement) {
			// Set services as JS properties
			if (ttsService) {
				(ttsToolElement as any).ttsService = ttsService;
			}
			if (toolCoordinator) {
				(ttsToolElement as any).coordinator = toolCoordinator;

				// Register tool and show if TTS service available
				// Tool will be initially hidden, coordinator controls visibility
				if (ttsService) {
					toolCoordinator.showTool(`tts-passage-${passage.id}`);
				} else {
					toolCoordinator.hideTool(`tts-passage-${passage.id}`);
				}
			}
		}
	});
</script>

{#if passage.config}
	<div class="passage-renderer {className}" bind:this={passageElement}>
		<div class="passage-header">
			<h3 class="passage-title">{passage.name || 'Passage'}</h3>
			<!-- Always rendered, coordinator controls visibility via display:none/block -->
			<pie-tool-tts-inline
				bind:this={ttsToolElement}
				tool-id="tts-passage-{passage.id}"
				catalog-id={passage.id}
				language="en-US"
				size="md"
			></pie-tool-tts-inline>
		</div>

		<div class="passage-content" bind:this={passageContentElement}>
			<pie-esm-player
				config={JSON.stringify(passage.config)}
				env={JSON.stringify({ mode: 'view' })}
				bundle-host={bundleHost}
				esm-cdn-url={esmCdnUrl}
			></pie-esm-player>
		</div>
	</div>
{/if}

<style>
	.passage-renderer {
		display: block;
		margin-bottom: 1rem;
	}

	.passage-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
	}

	.passage-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #333;
	}

	.passage-content {
		border: 1px solid #e0e0e0;
		border-radius: 0 0 4px 4px;
		padding: 1rem;
		background: white;
	}
</style>
