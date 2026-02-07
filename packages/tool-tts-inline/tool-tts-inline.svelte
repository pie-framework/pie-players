<svelte:options
	customElement={{
		tag: 'pie-tool-tts-inline',
		shadow: 'none',
		props: {
			toolId: { type: 'String', attribute: 'tool-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			language: { type: 'String', attribute: 'language' },
			size: { type: 'String', attribute: 'size' },

			// Services (passed as JS properties, not attributes)
			coordinator: { type: 'Object', reflect: false },
			ttsService: { type: 'Object', reflect: false }
		}
	}}
/>

<script lang="ts">
	import type { IToolCoordinator, ITTSService } from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';
	import { onMount } from 'svelte';

	// Props
	let {
		toolId = 'tts-inline',
		catalogId = '', // Explicit catalog ID
		language = 'en-US',
		size = 'md' as 'sm' | 'md' | 'lg',
		coordinator,
		ttsService
	}: {
		toolId?: string;
		catalogId?: string;
		language?: string;
		size?: 'sm' | 'md' | 'lg';
		coordinator?: IToolCoordinator;
		ttsService?: ITTSService;
	} = $props();

	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLButtonElement | undefined>();
	let registered = $state(false);
	let speaking = $state(false);

	// Register with coordinator (standard pattern - coordinator controls visibility)
	$effect(() => {
		if (coordinator && toolId && containerEl && !registered) {
			coordinator.registerTool(toolId, 'TTS Inline', containerEl, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	// Cleanup
	onMount(() => {
		return () => {
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Handle TTS click
	async function handleClick() {
		if (!ttsService || speaking) return;

		try {
			speaking = true;

			// Find target container (parent of this button)
			const targetContainer = containerEl?.closest('.passage-content, .item-content');
			const text = targetContainer?.textContent?.trim() || '';

			if (!text) {
				console.warn('[TTS Inline] No text content found');
				speaking = false;
				return;
			}

			// Speak with catalog support
			await ttsService.speak(text, {
				catalogId: catalogId || undefined,
				language
			});

			speaking = false;
		} catch (error) {
			console.error('[TTS Inline] Error:', error);
			speaking = false;
		}
	}

	// Size classes
	const sizeClass = $derived(
		size === 'sm' ? 'tts-inline--sm' : size === 'lg' ? 'tts-inline--lg' : 'tts-inline--md'
	);
</script>

{#if isBrowser}
	<button
		bind:this={containerEl}
		type="button"
		class="tts-inline {sizeClass}"
		class:tts-inline--speaking={speaking}
		onclick={handleClick}
		aria-label="Read aloud"
		aria-pressed={speaking}
		disabled={speaking || !ttsService}
	>
		<!-- Material Design Speaker Icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			class="tts-inline__icon"
			aria-hidden="true"
		>
			<path
				d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
			/>
		</svg>
	</button>
{/if}

<style>
	.tts-inline {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: 4px;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			transform 0.1s ease;
		padding: 0.25rem;
	}

	.tts-inline:hover:not(:disabled) {
		background-color: rgba(0, 0, 0, 0.05);
	}

	.tts-inline:active:not(:disabled) {
		transform: scale(0.95);
	}

	.tts-inline--speaking {
		background-color: rgba(103, 126, 234, 0.15);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.tts-inline:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Size variants */
	.tts-inline--sm {
		width: 1.5rem;
		height: 1.5rem;
	}

	.tts-inline--sm .tts-inline__icon {
		width: 1rem;
		height: 1rem;
	}

	.tts-inline--md {
		width: 2rem;
		height: 2rem;
	}

	.tts-inline--md .tts-inline__icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.tts-inline--lg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.tts-inline--lg .tts-inline__icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	.tts-inline__icon {
		fill: currentColor;
		color: #555;
	}

	.tts-inline:hover:not(:disabled) .tts-inline__icon {
		color: #667eea;
	}

	.tts-inline--speaking .tts-inline__icon {
		color: #667eea;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.tts-inline,
		.tts-inline--speaking {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
