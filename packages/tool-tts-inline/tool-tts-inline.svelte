<svelte:options
	customElement={{
		tag: 'pie-tool-tts-inline',
		shadow: 'open',
		props: {
			catalogId: { type: 'String', attribute: 'catalog-id' },
			language: { type: 'String', attribute: 'language' },
			size: { type: 'String', attribute: 'size' },
			speedOptions: { type: 'Array', attribute: 'speed-options' }
		}
	}}
/>

<script lang="ts">
	import {
		connectToolRegionScopeContext,
		connectToolRuntimeContext,
		connectToolShellContext,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitRuntimeContext,
		type AssessmentToolkitShellContext,
		type HighlightCoordinatorApi,
		type TtsServiceApi,
	} from '@pie-players/pie-assessment-toolkit';

	let {
		catalogId = '', // Explicit catalog ID
		language = 'en-US',
		size = 'md' as 'sm' | 'md' | 'lg',
		speedOptions = [1.5, 2] as number[]
	}: {
		catalogId?: string;
		language?: string;
		size?: 'sm' | 'md' | 'lg';
		speedOptions?: number[];
	} = $props();

	const isBrowser = typeof window !== 'undefined';

	let containerEl = $state<HTMLDivElement | undefined>();
	let panelEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let regionScopeContext = $state<AssessmentToolkitRegionScopeContext | null>(null);
	const ttsService = $derived(runtimeContext?.ttsService as TtsServiceApi | undefined);
	const highlightCoordinator = $derived(
		runtimeContext?.highlightCoordinator as HighlightCoordinatorApi | undefined,
	);
	const targetContainer = $derived(
		regionScopeContext?.scopeElement || shellContext?.scopeElement || null,
	);
	let panelOpen = $state(false);
	let speaking = $state(false);
	let paused = $state(false);
	let statusMessage = $state('');
	let playbackRate = $state(1);
	let focusedControlIndex = $state(0);
	let ttsReady = $state(false);
	const STATIC_CONTROL_COUNT = 4;
	const speedChoices = $derived.by(() => {
		if (!Array.isArray(speedOptions)) return [1.5, 2];
		const deduped = new Set<number>();
		for (const value of speedOptions) {
			if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
			const rounded = Math.round(value * 100) / 100;
			if (rounded === 1) continue;
			deduped.add(rounded);
		}
		return deduped.size ? Array.from(deduped) : [1.5, 2];
	});

	const listenerId = `pie-tts-inline-${Math.random().toString(36).slice(2)}`;

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		if (!containerEl) return;
		const cleanupShell = connectToolShellContext(
			containerEl,
			(value: AssessmentToolkitShellContext) => {
				shellContext = value;
			},
		);
		const cleanupRegion = connectToolRegionScopeContext(
			containerEl,
			(value: AssessmentToolkitRegionScopeContext) => {
				regionScopeContext = value;
			},
		);
		return () => {
			cleanupRegion();
			cleanupShell();
		};
	});

	$effect(() => {
		if (!ttsService) return;
		const syncFromState = (state: string) => {
			speaking = state === 'playing' || state === 'paused';
			paused = state === 'paused';
		};
		const stateListener = (state: unknown) => {
			syncFromState(state as string);
		};
		ttsService.onStateChange(listenerId, stateListener as (state: any) => void);
		syncFromState(ttsService.getState() as unknown as string);
		return () => {
			ttsService.offStateChange(listenerId, stateListener as (state: any) => void);
		};
	});

	$effect(() => {
		let cancelled = false;
		const initializeTTS = async () => {
			if (!runtimeContext?.toolkitCoordinator?.ensureTTSReady) {
				ttsReady = !!ttsService;
				return;
			}
			try {
				await runtimeContext.toolkitCoordinator.ensureTTSReady();
				if (!cancelled) ttsReady = true;
			} catch (error) {
				if (!cancelled) {
					ttsReady = false;
					console.error('[TTS Inline] Failed to initialize TTS:', error);
				}
			}
		};
		void initializeTTS();
		return () => {
			cancelled = true;
		};
	});

	function getToolbarControls(): HTMLButtonElement[] {
		if (!panelEl) return [];
		return Array.from(
			panelEl.querySelectorAll<HTMLButtonElement>('[data-pie-tts-control]'),
		);
	}

	function focusToolbarControl(index: number): void {
		const controls = getToolbarControls();
		if (!controls.length) return;
		const wrapped = (index + controls.length) % controls.length;
		focusedControlIndex = wrapped;
		controls[wrapped].focus();
	}

	function handleToolbarKeydown(event: KeyboardEvent): void {
		const controls = getToolbarControls();
		if (!controls.length) return;
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault();
				focusToolbarControl(focusedControlIndex + 1);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault();
				focusToolbarControl(focusedControlIndex - 1);
				break;
			case 'Home':
				event.preventDefault();
				focusToolbarControl(0);
				break;
			case 'End':
				event.preventDefault();
				focusToolbarControl(controls.length - 1);
				break;
		}
	}

	function togglePanel(): void {
		panelOpen = !panelOpen;
		if (panelOpen) {
			queueMicrotask(() => focusToolbarControl(focusedControlIndex));
		}
	}

	function resolveReadingTarget(): Element | null {
		if (!targetContainer) return null;
		const asElement = targetContainer as Element;
		if (asElement.getAttribute?.('data-region') === 'content') {
			return asElement;
		}
		const contentRegion = asElement.querySelector?.("[data-region='content']");
		if (contentRegion instanceof Element) return contentRegion;
		return asElement;
	}

	async function startSpeaking(): Promise<void> {
		if (!ttsService) return;
		if (!ttsReady) {
			statusMessage = 'Text-to-speech is still initializing';
			return;
		}
		const readingTarget = resolveReadingTarget();
		if (!readingTarget) {
			console.warn('[TTS Inline] No target container found from shell scope context');
			return;
		}
		try {
			panelOpen = true;
			const text = (readingTarget as HTMLElement).textContent || '';
			if (!text) {
				console.warn('[TTS Inline] No text content found');
				return;
			}
			if (highlightCoordinator && ttsService.setHighlightCoordinator) {
				ttsService.setHighlightCoordinator(highlightCoordinator);
			}
			(ttsService as any).setRootElement?.(readingTarget as HTMLElement);
			const isPassageScope = Boolean(readingTarget.closest('pie-passage-shell'));
			statusMessage = 'Reading started';
			await ttsService.speak(text, {
				catalogId: isPassageScope ? undefined : catalogId || undefined,
				language,
				contentElement: readingTarget,
			});
		} catch (error) {
			console.error('[TTS Inline] Error:', error);
			statusMessage = 'Unable to start reading';
			if (highlightCoordinator) {
				highlightCoordinator.clearTTS();
			}
		}
	}

	async function handlePlayPause() {
		if (!ttsService) return;
		if (paused) {
			ttsService.resume();
			statusMessage = 'Reading resumed';
			return;
		}
		if (speaking && !paused) {
			ttsService.pause();
			statusMessage = 'Reading paused';
			return;
		}
		await startSpeaking();
	}

	function handleStop() {
		if (!ttsService) return;
		ttsService.stop();
		panelOpen = false;
		statusMessage = 'Reading stopped';
		if (highlightCoordinator) {
			highlightCoordinator.clearTTS();
		}
	}

	async function handleSeekForward() {
		if (!ttsService || !speaking) return;
		try {
			await (ttsService as any).seekForward?.(1);
			statusMessage = 'Skipped forward';
		} catch (error) {
			console.error('[TTS Inline] Seek forward failed:', error);
			statusMessage = 'Unable to skip forward';
		}
	}

	async function handleSeekBackward() {
		if (!ttsService || !speaking) return;
		try {
			await (ttsService as any).seekBackward?.(1);
			statusMessage = 'Skipped backward';
		} catch (error) {
			console.error('[TTS Inline] Seek backward failed:', error);
			statusMessage = 'Unable to skip backward';
		}
	}

	async function handlePlaybackRate(rate: number) {
		if (!ttsService) return;
		const nextRate = playbackRate === rate ? 1 : rate;
		playbackRate = nextRate;
		await ttsService.updateSettings({ rate: nextRate });
		statusMessage =
			nextRate === 1
				? 'Playback speed reset to 1x'
				: `Playback speed ${nextRate}x`;
	}

	const sizeClass = $derived(
		size === 'sm'
			? 'pie-tool-tts-inline__trigger--sm'
			: size === 'lg'
				? 'pie-tool-tts-inline__trigger--lg'
				: 'pie-tool-tts-inline__trigger--md',
	);
</script>

{#if isBrowser}
	<div bind:this={containerEl} class="pie-tool-tts-inline">
		<button
			type="button"
			class="pie-tool-tts-inline__trigger {sizeClass}"
			class:pie-tool-tts-inline__trigger--active={panelOpen}
			onclick={togglePanel}
			aria-label={panelOpen ? 'Close reading controls' : 'Open reading controls'}
			aria-expanded={panelOpen}
			disabled={!ttsService || !ttsReady}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
				<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
			</svg>
		</button>

		{#if panelOpen}
			<div
				bind:this={panelEl}
				class="pie-tool-tts-inline__panel"
				role="toolbar"
				aria-label="Reading controls"
				tabindex="-1"
				onkeydown={handleToolbarKeydown}
			>
				<button
					type="button"
					data-pie-tts-control
					class="pie-tool-tts-inline__control pie-tool-tts-inline__control--primary"
					onclick={handlePlayPause}
					onfocus={() => (focusedControlIndex = 0)}
					tabindex={focusedControlIndex === 0 ? 0 : -1}
					aria-label={paused ? 'Resume reading' : speaking ? 'Pause reading' : 'Read aloud'}
					aria-pressed={speaking}
					disabled={!ttsService || !ttsReady}
				>
					{#if paused}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					{:else if speaking}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					{/if}
				</button>

				<button
					type="button"
					data-pie-tts-control
					class="pie-tool-tts-inline__control"
					onclick={handleStop}
					onfocus={() => (focusedControlIndex = 1)}
					tabindex={focusedControlIndex === 1 ? 0 : -1}
					aria-label="Stop reading"
					disabled={!ttsService || !ttsReady || (!speaking && !paused)}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
						<path d="M6 6h12v12H6z" />
					</svg>
				</button>

				<button
					type="button"
					data-pie-tts-control
					class="pie-tool-tts-inline__control"
					onclick={handleSeekForward}
					onfocus={() => (focusedControlIndex = 2)}
					tabindex={focusedControlIndex === 2 ? 0 : -1}
					aria-label="Fast-forward"
					disabled={!ttsService || !ttsReady || !speaking}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
						<path d="M4 18l8.5-6L4 6v12zm9.5 0L22 12l-8.5-6v12z" />
					</svg>
				</button>

				<button
					type="button"
					data-pie-tts-control
					class="pie-tool-tts-inline__control"
					onclick={handleSeekBackward}
					onfocus={() => (focusedControlIndex = 3)}
					tabindex={focusedControlIndex === 3 ? 0 : -1}
					aria-label="Rewind"
					disabled={!ttsService || !ttsReady || !speaking}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
						<path d="M20 18V6l-8.5 6L20 18zM10.5 18V6L2 12l8.5 6z" />
					</svg>
				</button>

				{#each speedChoices as speed, speedIdx (speed)}
					<button
						type="button"
						data-pie-tts-control
						class="pie-tool-tts-inline__control pie-tool-tts-inline__control--speed"
						class:pie-tool-tts-inline__control--speed-active={playbackRate === speed}
						onclick={() => handlePlaybackRate(speed)}
						onfocus={() => (focusedControlIndex = STATIC_CONTROL_COUNT + speedIdx)}
						tabindex={focusedControlIndex === STATIC_CONTROL_COUNT + speedIdx ? 0 : -1}
						aria-label={`Speed ${speed}x`}
						aria-pressed={playbackRate === speed}
						disabled={!ttsService || !ttsReady}
					>
						<span aria-hidden="true">{speed} x</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
			{statusMessage}
		</div>
	</div>
{/if}

<style>
	.pie-tool-tts-inline {
		position: relative;
		display: inline-block;
	}

	.pie-tool-tts-inline__trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--pie-button-border-color, var(--pie-border, #c6c6c6));
		background-color: var(--pie-button-background-color, var(--pie-background, #fff));
		color: var(--pie-button-color, var(--pie-text, #333));
		border-radius: 0.25rem;
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.pie-tool-tts-inline__trigger:hover:not(:disabled),
	.pie-tool-tts-inline__control:hover:not(:disabled) {
		background-color: var(--pie-button-hover-background-color, var(--pie-secondary-background, #f2f4f8));
		transform: translateY(-1px);
		box-shadow: 0 2px 6px color-mix(in srgb, var(--pie-shadow, #000) 14%, transparent);
	}

	.pie-tool-tts-inline__trigger:active:not(:disabled),
	.pie-tool-tts-inline__control:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.pie-tool-tts-inline__trigger:focus-visible,
	.pie-tool-tts-inline__control:focus-visible {
		outline: 2px solid var(--pie-focus-outline, var(--pie-button-focus-outline, var(--pie-primary, #0066cc)));
		outline-offset: 2px;
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--pie-primary, #0066cc) 22%, transparent);
	}

	.pie-tool-tts-inline__trigger--active {
		border-color: var(--pie-primary, #1565c0);
		background-color: color-mix(in srgb, var(--pie-primary, #1565c0) 10%, var(--pie-background, #fff));
	}

	.pie-tool-tts-inline__panel {
		position: absolute;
		z-index: 2;
		top: calc(100% + 0.5rem);
		right: 0;
		left: auto;
		transform-origin: top right;
		display: grid;
		grid-auto-flow: row;
		justify-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		min-width: 3rem;
		background: var(--pie-surface, var(--pie-background, #fff));
		border: 1px solid var(--pie-border, #d0d0d0);
		border-radius: 0.75rem;
		box-shadow: 0 6px 18px color-mix(in srgb, var(--pie-shadow, #000) 18%, transparent);
	}

	.pie-tool-tts-inline__control {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--pie-button-border-color, var(--pie-border, #c6c6c6));
		border-radius: 0.25rem;
		background: var(--pie-button-background-color, var(--pie-background, #fff));
		color: var(--pie-button-color, var(--pie-text, #222));
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.pie-tool-tts-inline__control--speed {
		font-size: 0.6875rem;
		font-weight: 400;
		letter-spacing: 0;
		white-space: nowrap;
	}

	.pie-tool-tts-inline__control--speed-active {
		border-color: var(--pie-primary, #1565c0);
		background: color-mix(in srgb, var(--pie-primary, #1565c0) 14%, var(--pie-background, #fff));
		color: var(--pie-primary, #1565c0);
		font-weight: 600;
	}

	.pie-tool-tts-inline__trigger:disabled,
	.pie-tool-tts-inline__control:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.pie-tool-tts-inline__trigger--sm {
		width: 1.75rem;
		height: 1.75rem;
	}

	.pie-tool-tts-inline__trigger--sm .pie-tool-tts-inline__icon {
		width: 1rem;
		height: 1rem;
	}

	.pie-tool-tts-inline__trigger--md {
		width: 2rem;
		height: 2rem;
	}

	.pie-tool-tts-inline__trigger--md .pie-tool-tts-inline__icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.pie-tool-tts-inline__trigger--lg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.pie-tool-tts-inline__trigger--lg .pie-tool-tts-inline__icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	.pie-tool-tts-inline__icon {
		fill: currentColor;
		color: currentColor;
	}

	.pie-sr-only {
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

	@media (prefers-reduced-motion: reduce) {
		.pie-tool-tts-inline__trigger,
		.pie-tool-tts-inline__control {
			transition: none !important;
		}
	}
</style>
