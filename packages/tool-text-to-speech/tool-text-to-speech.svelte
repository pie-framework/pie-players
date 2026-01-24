<svelte:options
	customElement={{
		tag: 'pie-tool-text-to-speech',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			coordinator: { type: 'Object' }
		}
	}}
/>

<script lang="ts">
	
	import type { IToolCoordinator, ITTSService } from '@pie-framework/pie-assessment-toolkit';
	import { BrowserTTSProvider, TTSService, ZIndexLayer } from '@pie-framework/pie-assessment-toolkit';
import { onDestroy, onMount } from 'svelte';

	// Props
	let {
		visible = false,
		toolId = 'textToSpeech',
		coordinator,
		ttsService
	}: {
		visible?: boolean;
		toolId?: string;
		coordinator?: IToolCoordinator;
		ttsService: ITTSService;
	} = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let isDragging = $state(false);
	let position = $state({
		x: isBrowser ? window.innerWidth - 320 : 400,
		y: isBrowser ? 100 : 100
	});
	let dragStart = $state({ x: 0, y: 0 });

	// TTS state
	let isInitialized = $state(false);
	let isSpeaking = $state(false);
	let isPaused = $state(false);
	let selectedText = $state('');
	let rate = $state(1.0);
	let hasSelection = $state(false);
	let initError = $state<string | null>(null);

	// Track registration state
	let registered = $state(false);

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Text-to-Speech', undefined, ZIndexLayer.MODAL);
			registered = true;
		}
	});

	// Initialize and handle lifecycle
	onMount(async () => {
		if (!isBrowser) return;

		try {
			const provider = new BrowserTTSProvider();
			await ttsService.initialize(provider);
			isInitialized = true;
		} catch (error) {
			console.error('[TTSTool] Failed to initialize TTS:', error);
			initError = error instanceof Error ? error.message : 'Failed to initialize TTS';
		}

		// Listen for text selection changes
		document.addEventListener('selectionchange', handleSelectionChange);

		return () => {
			if (isBrowser) {
				document.removeEventListener('selectionchange', handleSelectionChange);
				ttsService.stop();
			}
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// Handle text selection
	function handleSelectionChange() {
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			selectedText = selection.toString().trim();
			hasSelection = true;
		} else {
			hasSelection = false;
		}
	}

	// Speak selected text
	async function speakSelection() {
		if (!isInitialized || !hasSelection || !selectedText) return;

		try {
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);
			const container = range.commonAncestorContainer.parentElement;

			if (!container) return;

			isSpeaking = true;
			isPaused = false;

			// Set the root element for highlighting
			ttsService.setRootElement(container);

			await ttsService.speak(selectedText, {
				rate,
				highlightWords: true
			}, {
				onEnd: () => {
					isSpeaking = false;
					isPaused = false;
				},
				onError: (error) => {
					console.error('[TTSTool] TTS error:', error);
					isSpeaking = false;
					isPaused = false;
				}
			});
		} catch (error) {
			console.error('[TTSTool] Failed to speak:', error);
			isSpeaking = false;
			isPaused = false;
		}
	}

	// Pause/Resume
	function togglePause() {
		if (!isSpeaking) return;

		if (isPaused) {
			ttsService.resume();
			isPaused = false;
		} else {
			ttsService.pause();
			isPaused = true;
		}
	}

	// Stop
	function stopSpeaking() {
		ttsService.stop();
		isSpeaking = false;
		isPaused = false;
	}

	// Update rate
	function handleRateChange(event: Event) {
		const target = event.target as HTMLInputElement;
		rate = parseFloat(target.value);
	}

	// Dragging
	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		// Don't start dragging if clicking buttons or controls
		if (target.closest('button, input, select')) {
			return;
		}

		startDragging(e);
	}

	function startDragging(e: PointerEvent) {
		if (!containerEl) return;

		containerEl.setPointerCapture(e.pointerId);

		isDragging = true;
		dragStart = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};

		coordinator?.bringToFront(containerEl);

		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;

		position = {
			x: e.clientX - dragStart.x,
			y: e.clientY - dragStart.y
		};

		e.preventDefault();
	}

	function handlePointerUp(e: PointerEvent) {
		if (isDragging && containerEl) {
			containerEl.releasePointerCapture(e.pointerId);
			isDragging = false;

			containerEl.removeEventListener('pointermove', handlePointerMove);
			containerEl.removeEventListener('pointerup', handlePointerUp);
		}
	}

	function handleClose() {
		coordinator?.hideTool(toolId);
	}

	// Get rate label
	const rateLabel = $derived(
		rate === 0.5 ? 'Slow' :
		rate === 0.75 ? 'Slower' :
		rate === 1.0 ? 'Normal' :
		rate === 1.25 ? 'Faster' :
		rate === 1.5 ? 'Fast' :
		rate === 2.0 ? 'Very Fast' :
		`${rate}x`
	);
</script>

{#if visible && isBrowser}
	<div
		bind:this={containerEl}
		class="tool-tts"
		style="left: {position.x}px; top: {position.y}px;"
		onpointerdown={handlePointerDown}
		role="dialog"
		aria-label="Text-to-Speech Tool"
	>
		<!-- Header -->
		<div class="tool-header">
			<div class="tool-header-left">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.858 18.142a3 3 0 104.243-4.242L12 12.142 7.757 7.899a3 3 0 000 4.242z"/>
				</svg>
				<span class="tool-title">Text-to-Speech</span>
			</div>
			<button
				class="close-button"
				onclick={handleClose}
				aria-label="Close"
				type="button"
			>
				×
			</button>
		</div>

		<!-- Content -->
		<div class="tool-content">
			{#if initError}
				<div class="error-message">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
					</svg>
					<span>{initError}</span>
				</div>
			{:else if !isInitialized}
				<div class="loading-message">
					<span>Initializing...</span>
				</div>
			{:else}
				<!-- Instructions -->
				<div class="instructions">
					{#if hasSelection}
						<div class="selection-info">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
							</svg>
							<span>{selectedText.length} characters selected</span>
						</div>
					{:else}
						<p>Select text on the page to read it aloud.</p>
					{/if}
				</div>

				<!-- Speed Control -->
				<div class="control-group">
					<label for="tts-speed">
						<span>Speed:</span>
						<strong>{rateLabel}</strong>
					</label>
					<input
						id="tts-speed"
						type="range"
						min="0.5"
						max="2.0"
						step="0.25"
						value={rate}
						oninput={handleRateChange}
						disabled={isSpeaking}
					/>
				</div>

				<!-- Playback Controls -->
				<div class="playback-controls">
					<button
						class="btn-primary"
						onclick={speakSelection}
						disabled={!hasSelection || isSpeaking}
						aria-label="Play"
						type="button"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
						</svg>
						<span>Play</span>
					</button>

					<button
						class="btn-secondary"
						onclick={togglePause}
						disabled={!isSpeaking}
						aria-label={isPaused ? 'Resume' : 'Pause'}
						type="button"
					>
						{#if isPaused}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
							</svg>
							<span>Resume</span>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
							<span>Pause</span>
						{/if}
					</button>

					<button
						class="btn-secondary"
						onclick={stopSpeaking}
						disabled={!isSpeaking}
						aria-label="Stop"
						type="button"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
						</svg>
						<span>Stop</span>
					</button>
				</div>

				<!-- Status indicator -->
				{#if isSpeaking}
					<div class="status-indicator" class:paused={isPaused}>
						<div class="status-icon">
							{#if isPaused}
								⏸
							{:else}
								<span class="pulse"></span>
							{/if}
						</div>
						<span>{isPaused ? 'Paused' : 'Speaking...'}</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.tool-tts {
		position: fixed;
		width: 300px;
		background: white;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		cursor: move;
		user-select: none;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.tool-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-radius: 8px 8px 0 0;
		cursor: move;
	}

	.tool-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.tool-title {
		font-weight: 600;
		font-size: 14px;
	}

	.close-button {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		color: white;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.tool-content {
		padding: 16px;
	}

	.error-message,
	.loading-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		border-radius: 6px;
		font-size: 13px;
	}

	.error-message {
		background: #fee;
		color: #c33;
		border: 1px solid #fcc;
	}

	.loading-message {
		background: #f0f4f8;
		color: #4a5568;
		justify-content: center;
	}

	.instructions {
		margin-bottom: 16px;
		font-size: 13px;
		color: #4a5568;
	}

	.instructions p {
		margin: 0;
		line-height: 1.5;
	}

	.selection-info {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: #e6fffa;
		border: 1px solid #81e6d9;
		border-radius: 6px;
		color: #234e52;
		font-size: 12px;
	}

	.selection-info svg {
		flex-shrink: 0;
	}

	.control-group {
		margin-bottom: 16px;
	}

	.control-group label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 13px;
		color: #4a5568;
	}

	.control-group label strong {
		color: #667eea;
		font-weight: 600;
	}

	.control-group input[type="range"] {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: #e2e8f0;
		outline: none;
		-webkit-appearance: none;
	}

	.control-group input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #667eea;
		cursor: pointer;
		transition: all 0.2s;
	}

	.control-group input[type="range"]::-webkit-slider-thumb:hover {
		background: #764ba2;
		transform: scale(1.1);
	}

	.control-group input[type="range"]:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.playback-controls {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.playback-controls button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 12px;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.playback-controls button svg {
		flex-shrink: 0;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
	}

	.btn-secondary {
		background: #f7fafc;
		color: #4a5568;
		border: 1px solid #e2e8f0;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #edf2f7;
	}

	.playback-controls button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #f0fdf4;
		border: 1px solid #86efac;
		border-radius: 6px;
		font-size: 12px;
		color: #166534;
		animation: fadeIn 0.3s;
	}

	.status-indicator.paused {
		background: #fef3c7;
		border-color: #fcd34d;
		color: #92400e;
	}

	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pulse {
		width: 8px;
		height: 8px;
		background: #10b981;
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.2);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.pulse,
		.status-indicator,
		.playback-controls button,
		.control-group input[type="range"]::-webkit-slider-thumb {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
