<svelte:options
	customElement={{
		tag: 'pie-tool-text-to-speech',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			coordinator: { type: 'Object' }
		}
	}}
/>

<script lang="ts">
	import type { ToolCoordinatorApi, TtsServiceApi } from '@pie-players/pie-assessment-toolkit';
	import { BrowserTTSProvider, ZIndexLayer } from '@pie-players/pie-assessment-toolkit';
	import { createFocusTrap, createPointerDragController } from '@pie-players/pie-players-shared';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import {
		type AssessmentToolkitRuntimeContext,
		connectToolRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit';
	import { onMount } from 'svelte';

	// Props
	let {
		visible = false,
		toolId = 'textToSpeech',
		coordinator,
		ttsService
	}: {
		visible?: boolean;
		toolId?: string;
		coordinator?: ToolCoordinatorApi;
		ttsService: TtsServiceApi;
	} = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let closeButtonEl = $state<HTMLButtonElement | undefined>();
	let position = $state({
		x: isBrowser ? window.innerWidth - 320 : 400,
		y: isBrowser ? 100 : 100
	});
	const dragController = createPointerDragController({
		getPosition: () => position,
		setPosition: (next) => {
			position = next;
		},
		onDragStart: (container) => coordinator?.bringToFront(container as HTMLElement)
	});

	// TTS state
	let isInitialized = $state(false);
	let isSpeaking = $state(false);
	let isPaused = $state(false);
	let selectedText = $state('');
	let rate = $state(1.0);
	let hasSelection = $state(false);
	let initError = $state<string | null>(null);

	// The coordinator a registration was made against, and the id it used. Plain
	// `let` rather than `$state`: this is bookkeeping the registration effect both
	// reads and writes, and a reactive write inside a tracked effect body is what
	// AGENTS.md's Svelte Subscription Safety rules out.
	let registeredCoordinator: ToolCoordinatorApi | null = null;
	let registeredToolId: string | null = null;
	let cleanupFocusTrap: (() => void) | null = null;

	// Re-register whenever the coordinator identity or the tool id changes. The
	// coordinator arrives through a republished runtime context, so a new instance
	// replaces the old one mid-session; a one-shot registration would leave
	// z-index, `bringToFront` and visibility-restore bound to the dead coordinator.
	$effect(() => {
		if (!coordinator || !toolId) return;
		if (
			registeredCoordinator &&
			registeredToolId &&
			(registeredCoordinator !== coordinator || registeredToolId !== toolId)
		) {
			registeredCoordinator.unregisterTool(registeredToolId);
			registeredCoordinator = null;
			registeredToolId = null;
		}
		if (!registeredCoordinator) {
			coordinator.registerTool(toolId, 'Text-to-Speech', undefined, ZIndexLayer.MODAL);
			registeredCoordinator = coordinator;
			registeredToolId = toolId;
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
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
			// Unregister from the coordinator the registration was actually made
			// against, which is not necessarily the one currently in context.
			if (registeredCoordinator && registeredToolId) {
				registeredCoordinator.unregisterTool(registeredToolId);
				registeredCoordinator = null;
				registeredToolId = null;
			}
		};
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	$effect(() => {
		if (!visible || !containerEl) {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
			return;
		}
		cleanupFocusTrap?.();
		cleanupFocusTrap = createFocusTrap(containerEl, {
			initialFocus: closeButtonEl || null,
			onEscape: handleClose
		});
		return () => {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
		};
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

	/**
	 * The nearest docked ancestor that actually holds spoken content.
	 *
	 * `data-catalog-idref` names a card array, not a spoken card, so the nearest
	 * docked ancestor may carry only signing or braille. Stopping there loses the
	 * authored SSML on an outer node — silently, because generated speech reads
	 * plausibly. Falls back to the nearest docked id when the service cannot
	 * answer (no resolver yet), which is the previous behaviour.
	 */
	function findSpokenCatalogId(from: Element): string | undefined {
		let node: Element | null = from;
		let nearest: string | undefined;
		while (node) {
			const docked: Element | null = node.closest('[data-catalog-idref]');
			if (!docked) break;
			const id = docked.getAttribute('data-catalog-idref') || undefined;
			if (id) {
				nearest ??= id;
				if (ttsService?.hasSpokenAlternate?.(id)) return id;
			}
			node = docked.parentElement;
		}
		return nearest;
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

			// Detect catalog reference from selected content (for SSML lookup).
			// Climbs past docked ancestors that hold no spoken card: the attribute
			// names a whole card array, so a signing card docked on an inner node
			// would otherwise shadow the authored SSML on an outer one and the
			// selection would be read as generated speech instead.
			const catalogId = findSpokenCatalogId(container);

			await ttsService.speak(selectedText, {
				catalogId,  // Pass catalog ID for SSML resolution
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

		dragController.startDragging(e, containerEl);

		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragController.isDragging()) return;

		dragController.handlePointerMove(e);

		e.preventDefault();
	}

	function handlePointerUp(e: PointerEvent) {
		if (dragController.isDragging() && containerEl) {
			containerEl.releasePointerCapture(e.pointerId);
			dragController.endDragging();

			containerEl.removeEventListener('pointermove', handlePointerMove);
			containerEl.removeEventListener('pointerup', handlePointerUp);
		}
	}

	function handleClose() {
		coordinator?.hideTool(toolId);
	}

	// This tool has no toolkit runtime-context read of its own, so it opens one
	// purely for the interface locale. The graceful default covers a bare mount.
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value) => {
			runtimeContext = value;
		});
	});

	// Rate label. The `${rate}x` tail is a number plus a unit symbol, not prose,
	// so it needs no catalog entry.
	const rateLabel = $derived(
		rate === 0.5 ? interfaceI18n.t('tools.textToSpeech.rate.slow') :
		rate === 0.75 ? interfaceI18n.t('tools.textToSpeech.rate.slower') :
		rate === 1.0 ? interfaceI18n.t('tools.textToSpeech.rate.normal') :
		rate === 1.25 ? interfaceI18n.t('tools.textToSpeech.rate.faster') :
		rate === 1.5 ? interfaceI18n.t('tools.textToSpeech.rate.fast') :
		rate === 2.0 ? interfaceI18n.t('tools.textToSpeech.rate.veryFast') :
		`${rate}x`
	);
</script>

{#if visible && isBrowser}
	<div
		bind:this={containerEl}
		class="pie-tool-text-to-speech"
		style="left: {position.x}px; top: {position.y}px;"
		onpointerdown={handlePointerDown}
		role="dialog"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.textToSpeech.toolA11y')}
		tabindex="-1"
	>
		<!-- Header -->
		<div class="pie-tool-text-to-speech__header">
			<div class="pie-tool-text-to-speech__header-left">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.858 18.142a3 3 0 104.243-4.242L12 12.142 7.757 7.899a3 3 0 000 4.242z"/>
				</svg>
				<span class="pie-tool-text-to-speech__title">{interfaceI18n.t('tools.textToSpeech.title')}</span>
			</div>
			<button
				bind:this={closeButtonEl}
				class="pie-tool-text-to-speech__close-button"
				onclick={handleClose}
				aria-label={interfaceI18n.t('common.closeA11y')}
				type="button"
			>
				×
			</button>
		</div>

		<!-- Content -->
		<div class="pie-tool-text-to-speech__content">
			{#if initError}
				<div class="pie-tool-text-to-speech__error-message">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
					</svg>
					<span>{initError}</span>
				</div>
			{:else if !isInitialized}
				<div class="pie-tool-text-to-speech__loading-message">
					<span>{interfaceI18n.t('tools.textToSpeech.initializing')}</span>
				</div>
			{:else}
				<!-- Instructions -->
				<div class="pie-tool-text-to-speech__instructions">
					{#if hasSelection}
						<div class="pie-tool-text-to-speech__selection-info">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
							</svg>
							<span>{selectedText.length} characters selected</span>
						</div>
					{:else}
						<p>{interfaceI18n.t('tools.textToSpeech.selectText')}</p>
					{/if}
				</div>

				<!-- Speed Control -->
				<div class="pie-tool-text-to-speech__control-group">
					<label for="tts-speed">
						<span>{interfaceI18n.t('tools.textToSpeech.speed')}</span>
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
				<div class="pie-tool-text-to-speech__playback-controls">
					<button
						class="pie-tool-text-to-speech__button-primary"
						onclick={speakSelection}
						disabled={!hasSelection || isSpeaking}
						aria-label={interfaceI18n.t('tools.textToSpeech.play')}
						type="button"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
						</svg>
						<span>{interfaceI18n.t('tools.textToSpeech.play')}</span>
					</button>

					<button
						class="pie-tool-text-to-speech__button-secondary"
						onclick={togglePause}
						disabled={!isSpeaking}
						aria-label={interfaceI18n.t(
							isPaused ? 'tools.textToSpeech.resume' : 'tools.textToSpeech.pause',
						)}
						type="button"
					>
						{#if isPaused}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
							</svg>
							<span>{interfaceI18n.t('tools.textToSpeech.resume')}</span>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
							<span>{interfaceI18n.t('tools.textToSpeech.pause')}</span>
						{/if}
					</button>

					<button
						class="pie-tool-text-to-speech__button-secondary"
						onclick={stopSpeaking}
						disabled={!isSpeaking}
						aria-label={interfaceI18n.t('tools.textToSpeech.stop')}
						type="button"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
						</svg>
						<span>{interfaceI18n.t('tools.textToSpeech.stop')}</span>
					</button>
				</div>

				<!-- Status indicator -->
				{#if isSpeaking}
					<div class="pie-tool-text-to-speech__status-indicator" class:pie-tool-text-to-speech__status-indicator--paused={isPaused}>
						<div class="pie-tool-text-to-speech__status-icon">
							{#if isPaused}
								⏸
							{:else}
								<span class="pie-tool-text-to-speech__pulse"></span>
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
	.pie-tool-text-to-speech {
		position: fixed;
		width: 300px;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
		border: 1px solid var(--pie-border-light, #cbd5e0);
		border-radius: 8px;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
		cursor: move;
		user-select: none;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.pie-tool-text-to-speech__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--pie-primary-dark, #283593);
		color: var(--pie-white, #fff);
		border-radius: 8px 8px 0 0;
		cursor: move;
	}

	.pie-tool-text-to-speech__header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-tool-text-to-speech__title {
		font-weight: 600;
		font-size: 14px;
	}

	.pie-tool-text-to-speech__close-button {
		background: color-mix(in srgb, var(--pie-white, #fff) 20%, transparent);
		border: none;
		color: var(--pie-white, #fff);
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

	.pie-tool-text-to-speech__close-button:hover {
		background: color-mix(in srgb, var(--pie-white, #fff) 30%, transparent);
	}

	.pie-tool-text-to-speech__content {
		padding: 16px;
	}

	.pie-tool-text-to-speech__error-message,
	.pie-tool-text-to-speech__loading-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		border-radius: 6px;
		font-size: 13px;
	}

	.pie-tool-text-to-speech__error-message {
		background: color-mix(in srgb, var(--pie-incorrect, #c33) 12%, transparent);
		color: var(--pie-incorrect-icon, #c33);
		border: 1px solid color-mix(in srgb, var(--pie-incorrect, #c33) 30%, transparent);
	}

	.pie-tool-text-to-speech__loading-message {
		background: var(--pie-secondary-background, #f0f4f8);
		color: var(--pie-text, #4a5568);
		justify-content: center;
	}

	.pie-tool-text-to-speech__instructions {
		margin-bottom: 16px;
		font-size: 13px;
		color: var(--pie-text, #4a5568);
	}

	.pie-tool-text-to-speech__instructions p {
		margin: 0;
		line-height: 1.5;
	}

	.pie-tool-text-to-speech__selection-info {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: color-mix(in srgb, var(--pie-correct, #10b981) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--pie-correct, #10b981) 35%, transparent);
		border-radius: 6px;
		color: var(--pie-correct-icon, #234e52);
		font-size: 12px;
	}

	.pie-tool-text-to-speech__selection-info svg {
		flex-shrink: 0;
	}

	.pie-tool-text-to-speech__control-group {
		margin-bottom: 16px;
	}

	.pie-tool-text-to-speech__control-group label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 13px;
		color: var(--pie-text, #4a5568);
	}

	.pie-tool-text-to-speech__control-group label strong {
		color: var(--pie-primary, #667eea);
		font-weight: 600;
	}

	.pie-tool-text-to-speech__control-group input[type="range"] {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: var(--pie-secondary-background, #e2e8f0);
		outline: none;
		-webkit-appearance: none;
	}

	.pie-tool-text-to-speech__control-group input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--pie-primary, #667eea);
		cursor: pointer;
		transition: all 0.2s;
	}

	.pie-tool-text-to-speech__control-group input[type="range"]::-webkit-slider-thumb:hover {
		background: var(--pie-primary-dark, #764ba2);
		transform: scale(1.1);
	}

	.pie-tool-text-to-speech__control-group input[type="range"]:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pie-tool-text-to-speech__playback-controls {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.pie-tool-text-to-speech__playback-controls button {
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

	.pie-tool-text-to-speech__playback-controls button svg {
		flex-shrink: 0;
	}

	.pie-tool-text-to-speech__button-primary {
		background: var(--pie-primary, #667eea);
		color: var(--pie-white, #fff);
	}

	.pie-tool-text-to-speech__button-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px color-mix(in srgb, var(--pie-primary, #667eea) 35%, transparent);
	}

	.pie-tool-text-to-speech__button-secondary {
		background: var(--pie-button-bg, #f7fafc);
		color: var(--pie-button-color, #4a5568);
		border: 1px solid var(--pie-button-border, #e2e8f0);
	}

	.pie-tool-text-to-speech__button-secondary:hover:not(:disabled) {
		background: var(--pie-button-hover-bg, #edf2f7);
	}

	.pie-tool-text-to-speech__playback-controls button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	.pie-tool-text-to-speech__status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: color-mix(in srgb, var(--pie-correct, #4caf50) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--pie-correct, #4caf50) 30%, transparent);
		border-radius: 6px;
		font-size: 12px;
		color: var(--pie-correct-icon, #166534);
		animation: fadeIn 0.3s;
	}

	.pie-tool-text-to-speech__status-indicator.pie-tool-text-to-speech__status-indicator--paused {
		background: color-mix(in srgb, var(--pie-missing, #fcd34d) 18%, transparent);
		border-color: color-mix(in srgb, var(--pie-missing, #fcd34d) 45%, transparent);
		color: var(--pie-missing-icon, #92400e);
	}

	.pie-tool-text-to-speech__status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pie-tool-text-to-speech__pulse {
		width: 8px;
		height: 8px;
		background: var(--pie-correct, #10b981);
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
		.pie-tool-text-to-speech__pulse,
		.pie-tool-text-to-speech__status-indicator,
		.pie-tool-text-to-speech__playback-controls button,
		.pie-tool-text-to-speech__control-group input[type="range"]::-webkit-slider-thumb {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
