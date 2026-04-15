<svelte:options
	customElement={{
		tag: 'pie-tool-tts-inline',
		shadow: 'open',
		props: {
			catalogId: { type: 'String', attribute: 'catalog-id' },
			language: { type: 'String', attribute: 'language' },
			size: { type: 'String', attribute: 'size' },
			speedOptions: { type: 'Array', attribute: 'speed-options' },
			layoutMode: { type: 'String', attribute: 'layout-mode' }
		}
	}}
/>

<script lang="ts">
	import {
		connectToolRegionScopeContext,
		connectToolRuntimeContext,
		connectToolShellContext,
		DEFAULT_TTS_SPEED_OPTIONS,
		PIE_TTS_CONTROL_HANDOFF_EVENT,
		normalizeTTSSpeedOptions,
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
		speedOptions = [...DEFAULT_TTS_SPEED_OPTIONS] as number[],
		layoutMode = 'expanding-row' as
			| 'reserved-row'
			| 'expanding-row'
			| 'floating-overlay'
			| 'left-aligned'
	}: {
		catalogId?: string;
		language?: string;
		size?: 'sm' | 'md' | 'lg';
		speedOptions?: number[];
		layoutMode?: 'reserved-row' | 'expanding-row' | 'floating-overlay' | 'left-aligned';
	} = $props();

	const isBrowser = typeof window !== 'undefined';
	const ACTIVE_OWNER_KEY = '__pie_tts_inline_active_owner__';
	const OWNER_EVENT = 'pie-tts-inline-owner-change';

	let containerEl = $state<HTMLDivElement | undefined>();
	let toolbarEl = $state<HTMLDivElement | undefined>();
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
	let controlsVisible = $state(false);
	let speaking = $state(false);
	let paused = $state(false);
	let statusMessage = $state('');
	let playbackRate = $state(1);
	let focusedControlIndex = $state(0);
	let playActionInFlight = $state(false);
	let handoffInProgress = $state(false);
	const speedChoices = $derived.by(() => normalizeTTSSpeedOptions(speedOptions));

	const instanceId = `pie-tts-inline-instance-${Math.random().toString(36).slice(2)}`;
	const listenerId = `pie-tts-inline-${Math.random().toString(36).slice(2)}`;
	const panelId = `${instanceId}-controls`;

	function getActiveOwnerId(): string | null {
		if (!isBrowser) return null;
		const value = (window as Window & { [ACTIVE_OWNER_KEY]?: unknown })[ACTIVE_OWNER_KEY];
		return typeof value === 'string' ? value : null;
	}

	function isActiveOwner(): boolean {
		return getActiveOwnerId() === instanceId;
	}

	function emitOwnerChange(ownerId: string | null, previousOwnerId: string | null): void {
		if (!isBrowser) return;
		window.dispatchEvent(
			new CustomEvent(OWNER_EVENT, {
				detail: { ownerId, previousOwnerId },
			}),
		);
	}

	function claimActiveOwner(): void {
		if (!isBrowser) return;
		const previousOwnerId = getActiveOwnerId();
		if (previousOwnerId === instanceId) return;
		(window as Window & { [ACTIVE_OWNER_KEY]?: unknown })[ACTIVE_OWNER_KEY] = instanceId;
		emitOwnerChange(instanceId, previousOwnerId);
	}

	function releaseActiveOwner(): void {
		if (!isBrowser) return;
		const previousOwnerId = getActiveOwnerId();
		if (previousOwnerId !== instanceId) return;
		delete (window as Window & { [ACTIVE_OWNER_KEY]?: unknown })[ACTIVE_OWNER_KEY];
		emitOwnerChange(null, instanceId);
	}

	function resetLocalPlaybackUi(status = '', keepControlsVisible = false): void {
		speaking = false;
		paused = false;
		focusedControlIndex = 0;
		controlsVisible = keepControlsVisible;
		statusMessage = status;
	}

	function focusTriggerIfPanelHadFocus(hadPanelFocus: boolean): void {
		if (!containerEl || !hadPanelFocus) return;
		const root = containerEl.getRootNode();
		if (!(root instanceof ShadowRoot)) return;
		const triggerButton = root.querySelector(
			'.pie-tool-tts-inline__trigger',
		) as HTMLButtonElement | null;
		triggerButton?.focus();
	}

	function handleProgrammaticControlHandoff(
		status = 'Reading switched to another section',
		restoreFocus = false,
	): void {
		if (handoffInProgress) return;
		if (!controlsVisible && !isActiveOwner()) return;
		handoffInProgress = true;
		try {
			const hadPanelFocus = (() => {
				if (!containerEl || !toolbarEl) return false;
				const root = containerEl.getRootNode();
				if (!(root instanceof ShadowRoot)) return false;
				const activeElement = root.activeElement as HTMLElement | null;
				return Boolean(activeElement && toolbarEl.contains(activeElement));
			})();
			if (isActiveOwner()) {
				releaseActiveOwner();
			}
			resetLocalPlaybackUi(status);
			if (restoreFocus) {
				queueMicrotask(() => {
					focusTriggerIfPanelHadFocus(hadPanelFocus);
				});
			}
		} finally {
			handoffInProgress = false;
		}
	}

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
			// Keep trigger state instance-scoped: only the instance with visible controls
			// reflects the shared TTS service playback state.
			if (!controlsVisible || !isActiveOwner()) {
				speaking = false;
				paused = false;
				return;
			}
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
		if (!isBrowser) return;
		const ownerListener = (event: Event) => {
			const ownerChange = event as CustomEvent<{
				ownerId?: string | null;
				previousOwnerId?: string | null;
			}>;
			const { ownerId = null, previousOwnerId = null } = ownerChange.detail || {};
			if (previousOwnerId === instanceId && ownerId !== instanceId) {
				handleProgrammaticControlHandoff('Reading switched to another section');
			}
		};
		window.addEventListener(OWNER_EVENT, ownerListener);
		return () => {
			window.removeEventListener(OWNER_EVENT, ownerListener);
		};
	});

	$effect(() => {
		if (!isBrowser) return;
		const controlHandoffListener = () => {
			handleProgrammaticControlHandoff('Reading switched to another section', true);
		};
		window.addEventListener(PIE_TTS_CONTROL_HANDOFF_EVENT, controlHandoffListener);
		return () => {
			window.removeEventListener(PIE_TTS_CONTROL_HANDOFF_EVENT, controlHandoffListener);
		};
	});

	$effect(() => {
		return () => {
			releaseActiveOwner();
		};
	});

	async function ensureTTSReady(): Promise<boolean> {
		if (!ttsService) return false;
		try {
			await runtimeContext?.toolkitCoordinator?.ensureTTSReady?.();
			return true;
		} catch (error) {
			console.error('[TTS Inline] Failed to initialize TTS:', error);
			return false;
		}
	}

	function getToolbarControls(): HTMLButtonElement[] {
		if (!toolbarEl) return [];
		return Array.from(
			toolbarEl.querySelectorAll<HTMLButtonElement>('[data-pie-tts-control]'),
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

	function startSpeaking(): void {
		if (!ttsService) return;
		const readingTarget = resolveReadingTarget();
		if (!readingTarget) {
			console.warn('[TTS Inline] No target container found from shell scope context');
			return;
		}
		try {
			controlsVisible = true;
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
			void ttsService.speak(text, {
				catalogId: isPassageScope ? undefined : catalogId || undefined,
				language,
				contentElement: readingTarget,
			}).catch((error) => {
				console.error('[TTS Inline] Error:', error);
				statusMessage = 'Unable to start reading';
				if (highlightCoordinator) {
					highlightCoordinator.clearTTS();
				}
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
		if (isActiveOwner() && paused) {
			ttsService.resume();
			statusMessage = 'Reading resumed';
			return;
		}
		if (isActiveOwner() && speaking && !paused) {
			ttsService.pause();
			statusMessage = 'Reading paused';
			return;
		}
		if (playActionInFlight) return;
		playActionInFlight = true;
		try {
			statusMessage = 'Initializing text-to-speech';
			if (!(await ensureTTSReady())) {
				statusMessage = 'Unable to initialize text-to-speech. Try again.';
				return;
			}
			const currentState = String(ttsService.getState?.() || '');
			const hasActivePlayback =
				currentState === 'playing' ||
				currentState === 'paused' ||
				currentState === 'loading';
			if (hasActivePlayback && !isActiveOwner()) {
				ttsService.stop();
			}
			claimActiveOwner();
			startSpeaking();
		} finally {
			playActionInFlight = false;
		}
	}

	function handleStop() {
		if (!ttsService) return;
		ttsService.stop();
		releaseActiveOwner();
		resetLocalPlaybackUi('Reading stopped');
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
	const isControlsRowLayout = $derived(
		layoutMode === 'reserved-row' || layoutMode === 'expanding-row'
	);
	const isFloatingLayout = $derived(
		layoutMode === 'floating-overlay'
	);
	const isLeftAlignedFloatingLayout = $derived(layoutMode === 'left-aligned');

	function resolveHostElement(): HTMLElement | null {
		if (!containerEl) return null;
		const root = containerEl.getRootNode();
		if (root instanceof ShadowRoot) {
			return root.host as HTMLElement;
		}
		return null;
	}

	$effect(() => {
		const host = resolveHostElement();
		if (!host) return;
		const active = controlsVisible === true;
		host.setAttribute('data-active', active ? 'true' : 'false');
		host.dispatchEvent(
			new CustomEvent('pie-tool-active-change', {
				detail: { active },
				bubbles: true,
				composed: true
			})
		);
	});
</script>

{#if isBrowser}
	<div
		bind:this={containerEl}
		class="pie-tool-tts-inline"
		class:pie-tool-tts-inline--controls-row={isControlsRowLayout}
		class:pie-tool-tts-inline--floating={isFloatingLayout}
	>
		{#snippet triggerButton()}
			<button
				type="button"
				class="pie-tool-tts-inline__trigger {sizeClass}"
				class:pie-tool-tts-inline__trigger--active={controlsVisible}
				onclick={handlePlayPause}
				aria-label={speaking && !paused ? 'Pause reading' : paused ? 'Resume reading' : 'Play reading'}
				aria-expanded={controlsVisible}
				aria-controls={controlsVisible ? panelId : undefined}
				disabled={!ttsService || playActionInFlight}
			>
				{#if speaking && !paused}
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
						<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
						<path d="M8 5v14l11-7z" />
					</svg>
				{/if}
			</button>
		{/snippet}

		{#snippet controlsPanel()}
			{#if controlsVisible}
				<div
					id={panelId}
					bind:this={toolbarEl}
					class="pie-tool-tts-inline__panel"
					class:pie-tool-tts-inline__panel--floating={isFloatingLayout}
					class:pie-tool-tts-inline__panel--row={isControlsRowLayout}
					class:pie-tool-tts-inline__panel--left-aligned-inline={isLeftAlignedFloatingLayout}
					role="toolbar"
					aria-label="Reading controls"
					tabindex="-1"
					onkeydown={handleToolbarKeydown}
				>
					{#if speedChoices.length > 0}
						{#each speedChoices as speed, speedIdx (speed)}
							<button
								type="button"
								data-pie-tts-control
								class="pie-tool-tts-inline__control pie-tool-tts-inline__control--speed"
								class:pie-tool-tts-inline__control--speed-active={playbackRate === speed}
								onclick={() => handlePlaybackRate(speed)}
								onfocus={() => (focusedControlIndex = speedIdx)}
								tabindex={focusedControlIndex === speedIdx ? 0 : -1}
								aria-label={`Speed ${speed}x`}
								aria-pressed={playbackRate === speed}
								disabled={!ttsService}
							>
								<span aria-hidden="true">{speed}x</span>
							</button>
						{/each}
					{/if}

					<button
						type="button"
						data-pie-tts-control
						class="pie-tool-tts-inline__control"
						onclick={handleSeekBackward}
						onfocus={() => (focusedControlIndex = speedChoices.length)}
						tabindex={focusedControlIndex === speedChoices.length ? 0 : -1}
						aria-label="Rewind"
						disabled={!ttsService || !speaking}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M20 18V6l-8.5 6L20 18zM10.5 18V6L2 12l8.5 6z" />
						</svg>
					</button>

					<button
						type="button"
						data-pie-tts-control
						class="pie-tool-tts-inline__control"
						onclick={handleSeekForward}
						onfocus={() => (focusedControlIndex = speedChoices.length + 1)}
						tabindex={focusedControlIndex === speedChoices.length + 1 ? 0 : -1}
						aria-label="Fast-forward"
						disabled={!ttsService || !speaking}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M4 18l8.5-6L4 6v12zm9.5 0L22 12l-8.5-6v12z" />
						</svg>
					</button>

					<button
						type="button"
						data-pie-tts-control
						class="pie-tool-tts-inline__control"
						onclick={handleStop}
						onfocus={() => (focusedControlIndex = speedChoices.length + 2)}
						tabindex={focusedControlIndex === speedChoices.length + 2 ? 0 : -1}
						aria-label="Stop reading"
						disabled={!ttsService || (!speaking && !paused)}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M6 6h12v12H6z" />
						</svg>
					</button>
				</div>
			{/if}
		{/snippet}

		{#if isLeftAlignedFloatingLayout}
			{@render controlsPanel()}
			{@render triggerButton()}
		{:else}
			{@render triggerButton()}
			{@render controlsPanel()}
		{/if}

		<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
			{statusMessage}
		</div>
	</div>
{/if}

<style>
	.pie-tool-tts-inline {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.pie-tool-tts-inline--controls-row {
		width: 100%;
		justify-content: flex-end;
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
		display: inline-flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		box-sizing: border-box;
		height: var(--pie-tts-controls-row-height, 2.875rem);
		padding: 0 0.5rem;
		background: var(--pie-surface, var(--pie-background, #fff));
		border: 1px solid var(--pie-border, #d0d0d0);
		border-radius: 0.5rem;
	}

	.pie-tool-tts-inline__panel--floating {
		position: absolute;
		z-index: 2;
		top: 100%;
		right: 0;
		left: auto;
	}

	.pie-tool-tts-inline__panel--left-aligned-inline {
		position: static;
		margin-right: 0.5rem;
	}

	.pie-tool-tts-inline__panel--row {
		position: absolute;
		z-index: 2;
		top: 100%;
		right: 0;
		left: auto;
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
