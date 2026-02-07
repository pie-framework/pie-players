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
			ttsService: { type: 'Object', reflect: false },
			highlightCoordinator: { type: 'Object', reflect: false }
		}
	}}
/>

<script lang="ts">
	import type {
		IToolCoordinator,
		ITTSService,
		IHighlightCoordinator
	} from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

	// Props
	let {
		toolId = 'tts-inline',
		catalogId = '', // Explicit catalog ID
		language = 'en-US',
		size = 'md' as 'sm' | 'md' | 'lg',
		coordinator,
		ttsService,
		highlightCoordinator
	}: {
		toolId?: string;
		catalogId?: string;
		language?: string;
		size?: 'sm' | 'md' | 'lg';
		coordinator?: IToolCoordinator;
		ttsService?: ITTSService;
		highlightCoordinator?: IHighlightCoordinator;
	} = $props();

	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let registered = $state(false);
	let speaking = $state(false);
	let paused = $state(false);
	let statusMessage = $state('');

	// Register with coordinator (don't control visibility here - let parent handle it)
	$effect(() => {
		if (coordinator && toolId && containerEl && !registered) {
			coordinator.registerTool(toolId, 'TTS Inline', containerEl, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	// Cleanup when component unmounts
	$effect(() => {
		return () => {
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Handle Play/Pause click
	async function handlePlayPause() {
		if (!ttsService) return;

		// If paused, resume
		if (paused) {
			ttsService.resume();
			paused = false;
			statusMessage = 'Reading resumed';
			return;
		}

		// If speaking, pause
		if (speaking && !paused) {
			ttsService.pause();
			paused = true;
			statusMessage = 'Reading paused';
			return;
		}

		// Otherwise, start speaking
		try {
			speaking = true;
			paused = false;
			statusMessage = 'Reading started';

			// Find target container
			// First check if button is in a header with a sibling content div
			const header = containerEl?.closest('.passage-header, .item-header');
			let targetContainer: Element | null = null;

			if (header) {
				// Look for sibling content div
				const parent = header.parentElement;
				targetContainer = parent?.querySelector('.passage-content, .item-content') || null;
			}

			// Fallback: look up the parent chain
			if (!targetContainer) {
				targetContainer = containerEl?.closest('.passage-content, .item-content') || null;
			}

			if (!targetContainer) {
				console.warn('[TTS Inline] No target container found');
				speaking = false;
				return;
			}

			// Get text and normalize whitespace to match what TTS will speak
			// This ensures the text matches what's in the contentElement
			const range = document.createRange();
			range.selectNodeContents(targetContainer);
			const rawText = range.toString();

			// Normalize: trim and collapse whitespace (this is what TTS providers expect)
			const text = rawText.trim().replace(/\s+/g, ' ');

			console.log('[TTS Inline] Text extraction:', {
				rawLength: rawText.length,
				normalizedLength: text.length,
				preview: text.substring(0, 100)
			});

			if (!text) {
				console.warn('[TTS Inline] No text content found');
				speaking = false;
				return;
			}

			// Set highlightCoordinator on TTS service if available
			if (highlightCoordinator && ttsService.setHighlightCoordinator) {
				ttsService.setHighlightCoordinator(highlightCoordinator);
			}

			// Speak with catalog support and highlighting
			await ttsService.speak(text, {
				catalogId: catalogId || undefined,
				language,
				contentElement: targetContainer
			});

			speaking = false;
			paused = false;

			// Clear highlights when done
			if (highlightCoordinator) {
				highlightCoordinator.clearTTS();
			}
		} catch (error) {
			console.error('[TTS Inline] Error:', error);
			speaking = false;
			paused = false;

			// Clear highlights on error
			if (highlightCoordinator) {
				highlightCoordinator.clearTTS();
			}
		}
	}

	// Handle Stop click
	function handleStop() {
		if (!ttsService) return;
		ttsService.stop();
		speaking = false;
		paused = false;
		statusMessage = 'Reading stopped';

		// Clear highlights
		if (highlightCoordinator) {
			highlightCoordinator.clearTTS();
		}
	}

	// Size classes
	const sizeClass = $derived(
		size === 'sm' ? 'tts-inline--sm' : size === 'lg' ? 'tts-inline--lg' : 'tts-inline--md'
	);
</script>

{#if isBrowser}
	<div bind:this={containerEl} class="tts-inline-controls">
		<!-- Play/Pause Button -->
		<button
			type="button"
			class="tts-inline {sizeClass}"
			class:tts-inline--speaking={speaking}
			class:tts-inline--paused={paused}
			onclick={handlePlayPause}
			aria-label={paused ? 'Resume reading' : speaking ? 'Pause reading' : 'Read aloud'}
			aria-pressed={speaking || paused}
			disabled={!ttsService}
		>
			{#if paused}
				<!-- Material Design Play Icon (for resume) -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="tts-inline__icon"
					aria-hidden="true"
				>
					<path d="M8 5v14l11-7z" />
				</svg>
			{:else if speaking}
				<!-- Material Design Pause Icon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="tts-inline__icon"
					aria-hidden="true"
				>
					<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
				</svg>
			{:else}
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
			{/if}
		</button>

		<!-- Stop Button (only show when speaking or paused) -->
		{#if speaking || paused}
			<button
				type="button"
				class="tts-inline tts-inline--stop {sizeClass}"
				onclick={handleStop}
				aria-label="Stop reading"
				disabled={!ttsService}
			>
				<!-- Material Design Stop Icon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="tts-inline__icon"
					aria-hidden="true"
				>
					<path d="M6 6h12v12H6z" />
				</svg>
			</button>
		{/if}

		<!-- Screen reader status announcements -->
		<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
			{statusMessage}
		</div>
	</div>
{/if}

<style>
	.tts-inline-controls {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

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
		position: relative;
	}

	.tts-inline:hover:not(:disabled) {
		background-color: rgba(0, 0, 0, 0.05);
	}

	.tts-inline:active:not(:disabled) {
		transform: scale(0.95);
	}

	/* Focus indicator - WCAG 2.4.7, 2.4.13 */
	.tts-inline:focus-visible {
		outline: 2px solid #0066cc;
		outline-offset: 2px;
		box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.2);
		z-index: 1;
	}

	.tts-inline--speaking {
		background-color: rgba(103, 126, 234, 0.15);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.tts-inline--paused {
		background-color: rgba(255, 152, 0, 0.15);
	}

	.tts-inline--stop {
		background-color: transparent;
	}

	.tts-inline--stop:hover:not(:disabled) {
		background-color: rgba(244, 67, 54, 0.1);
	}

	.tts-inline--stop .tts-inline__icon {
		color: #c62828; /* Darker red for better contrast - WCAG 1.4.11 */
	}

	.tts-inline:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Size variants */
	.tts-inline--sm {
		width: 1.5rem;
		height: 1.5rem;
		/* Increase padding to meet 44px touch target - WCAG 2.5.2 */
		padding: 0.625rem;
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

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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
