<svelte:options
	customElement={{
		tag: 'pie-tool-tts-inline',
		shadow: 'open',
		props: {
			catalogId: { type: 'String', attribute: 'catalog-id' },
			language: { type: 'String', attribute: 'language' },
			size: { type: 'String', attribute: 'size' },
			speedOptions: { type: 'Array', attribute: 'speed-options' },
			showSingleSpeedOption: { type: 'Boolean', attribute: 'show-single-speed-option' },
			layoutMode: { type: 'String', attribute: 'layout-mode' }
		}
	}}
/>

<script lang="ts">
	import {
		connectToolRegionScopeContext,
		connectToolRuntimeContext,
		connectToolShellContext,
		PIE_TTS_CONTROL_HANDOFF_EVENT,
		normalizeTTSSpeedControlOptions,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitRuntimeContext,
		type AssessmentToolkitShellContext,
		type HighlightCoordinatorApi,
		type NormalizedTTSSpeedOption,
		type TTSSpeedOption,
		type TtsServiceApi,
	} from '@pie-players/pie-assessment-toolkit';

	let {
		catalogId = '', // Explicit catalog ID
		language = 'en-US',
		size = 'md' as 'sm' | 'md' | 'lg',
		speedOptions = undefined,
		showSingleSpeedOption = false,
		layoutMode = 'expanding-row' as
			| 'reserved-row'
			| 'expanding-row'
			| 'floating-overlay'
			| 'left-aligned'
	}: {
		catalogId?: string;
		language?: string;
		size?: 'sm' | 'md' | 'lg';
		speedOptions?: TTSSpeedOption[];
		showSingleSpeedOption?: boolean;
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
	let moreMenuOpen = $state(false);
	let speaking = $state(false);
	let paused = $state(false);
	let statusMessage = $state('');
	let requestedPlaybackRate = $state<number | null>(null);
	let requestedPlaybackChoicesKey = $state<string | null>(null);
	let focusedControlIndex = $state(0);
	let playActionInFlight = $state(false);
	let handoffInProgress = $state(false);
	let highlightTargetResolverProviderDisposer: (() => void) | null = null;
	const speedChoices = $derived.by(() => normalizeTTSSpeedControlOptions(speedOptions));
	const speedChoicesKey = $derived.by(() => getSpeedChoicesKey(speedChoices));
	const visibleSpeedChoices = $derived.by(() =>
		speedChoices.length > 1 || showSingleSpeedOption ? speedChoices : [],
	);
	const speedControlCount = $derived(visibleSpeedChoices.length);
	const toolbarControlCount = $derived(speedControlCount + 3);
	const focusedToolbarIndex = $derived(
		focusedControlIndex >= toolbarControlCount ? 0 : focusedControlIndex,
	);
	const playbackRate = $derived.by(() => {
		if (
			requestedPlaybackRate !== null &&
			requestedPlaybackChoicesKey === speedChoicesKey &&
			speedChoices.some((option) => option.rate === requestedPlaybackRate)
		) {
			return requestedPlaybackRate;
		}
		return resolveDefaultPlaybackRate(speedChoices);
	});

	const instanceId = `pie-tts-inline-instance-${Math.random().toString(36).slice(2)}`;
	const listenerId = `pie-tts-inline-${Math.random().toString(36).slice(2)}`;
	const panelId = `${instanceId}-controls`;
	const moreMenuId = `${instanceId}-more-menu`;

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
		moreMenuOpen = false;
		statusMessage = status;
	}

	function getSpeedChoicesKey(choices: NormalizedTTSSpeedOption[]): string {
		return choices
			.map(
				(option) =>
					`${option.rate}:${option.label}:${option.ariaLabel}:${option.isDefault ? '1' : '0'}`,
			)
			.join('|');
	}

	function resolveDefaultPlaybackRate(choices: NormalizedTTSSpeedOption[]): number {
		return (
			choices.find((option) => option.isDefault)?.rate ??
			choices.find((option) => option.rate === 1)?.rate ??
			choices[0]?.rate ??
			1
		);
	}

	async function syncTTSPlaybackRate(service: TtsServiceApi, rate: number): Promise<void> {
		if (typeof service.setPlaybackRate === 'function') {
			await service.setPlaybackRate(rate);
			return;
		}
		await service.updateSettings({ rate });
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
			clearHighlightTargetResolverProvider();
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
			clearHighlightTargetResolverProvider();
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
		).filter((control) => window.getComputedStyle(control).display !== 'none');
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

	function resolveCatalogContext(): Record<string, string> | undefined {
		if (!shellContext) return undefined;
		if (shellContext.kind === 'passage') {
			return {
				ownerKind: 'passage',
				assessmentId: runtimeContext?.assessmentId || '',
				sectionId: runtimeContext?.sectionId || '',
				passageId: shellContext.canonicalItemId || shellContext.itemId,
			};
		}
		return {
			ownerKind: 'itemModel',
			assessmentId: runtimeContext?.assessmentId || '',
			sectionId: runtimeContext?.sectionId || '',
			itemId: shellContext.itemId,
			canonicalItemId: shellContext.canonicalItemId || shellContext.itemId,
		};
	}

	function syncHighlightTargetResolverProvider(readingTarget: Element): (() => void) | null {
		clearHighlightTargetResolverProvider();
		const provider = () => ({
			context: {
				scopeElement:
					regionScopeContext?.scopeElement || (readingTarget as HTMLElement) || null,
				kind: shellContext?.kind,
				itemId: shellContext?.itemId,
				canonicalItemId: shellContext?.canonicalItemId,
				contentKind: shellContext?.contentKind,
				regionPolicy: shellContext?.regionPolicy,
			},
			resolver: regionScopeContext?.ttsHighlightTargetResolver || null,
		});
		highlightTargetResolverProviderDisposer =
			ttsService?.setHighlightTargetResolverProvider?.(provider) || null;
		return highlightTargetResolverProviderDisposer;
	}

	function clearHighlightTargetResolverProvider(
		disposer = highlightTargetResolverProviderDisposer,
	): void {
		disposer?.();
		if (disposer === highlightTargetResolverProviderDisposer) {
			highlightTargetResolverProviderDisposer = null;
		}
	}

	function shouldRetainHighlightTargetResolverProvider(): boolean {
		if (!isActiveOwner()) return false;
		const state = String(ttsService?.getState?.() || '');
		return state === 'playing' || state === 'paused' || state === 'loading';
	}

	async function startSpeaking(): Promise<void> {
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
			await syncTTSPlaybackRate(ttsService, playbackRate);
			const resolverDisposer = syncHighlightTargetResolverProvider(readingTarget);
			(ttsService as any).setRootElement?.(readingTarget as HTMLElement);
			statusMessage = 'Reading started';
			void ttsService.speak(text, {
				catalogId: catalogId || undefined,
				catalogContext: resolveCatalogContext(),
				language,
				contentElement: readingTarget,
			} as any).catch((error) => {
				console.error('[TTS Inline] Error:', error);
				statusMessage = 'Unable to start reading';
				if (highlightCoordinator) {
					highlightCoordinator.clearTTS();
				}
				clearHighlightTargetResolverProvider(resolverDisposer);
			}).finally(() => {
				if (!shouldRetainHighlightTargetResolverProvider()) {
					clearHighlightTargetResolverProvider(resolverDisposer);
				}
			});
		} catch (error) {
			console.error('[TTS Inline] Error:', error);
			statusMessage = 'Unable to start reading';
			if (highlightCoordinator) {
				highlightCoordinator.clearTTS();
			}
			clearHighlightTargetResolverProvider();
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
			await startSpeaking();
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
		clearHighlightTargetResolverProvider();
	}

	function getMoreMenuItems(): HTMLButtonElement[] {
		if (!containerEl) return [];
		const root = containerEl.getRootNode();
		if (!(root instanceof ShadowRoot)) return [];
		return Array.from(
			root.querySelectorAll<HTMLButtonElement>('[data-pie-tts-more-control]'),
		);
	}

	function focusMoreMenuItem(index: number): void {
		const enabledItems = getMoreMenuItems().filter((item) => !item.disabled);
		if (!enabledItems.length) return;
		const wrapped = (index + enabledItems.length) % enabledItems.length;
		enabledItems[wrapped].focus();
	}

	function openMoreMenu(): void {
		moreMenuOpen = true;
		queueMicrotask(() => {
			focusMoreMenuItem(0);
		});
	}

	function toggleMoreMenu(): void {
		if (moreMenuOpen) {
			closeMoreMenu();
			return;
		}
		openMoreMenu();
	}

	function closeMoreMenu(): void {
		moreMenuOpen = false;
	}

	function handleMoreMenuKeydown(event: KeyboardEvent): void {
		const items = getMoreMenuItems().filter((item) => !item.disabled);
		const currentIndex = items.findIndex((item) => item === event.target);
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault();
				focusMoreMenuItem(currentIndex + 1);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault();
				focusMoreMenuItem(currentIndex - 1);
				break;
			case 'Home':
				event.preventDefault();
				focusMoreMenuItem(0);
				break;
			case 'End':
				event.preventDefault();
				focusMoreMenuItem(items.length - 1);
				break;
			case 'Escape': {
				event.preventDefault();
				closeMoreMenu();
				const root = containerEl?.getRootNode();
				if (!(root instanceof ShadowRoot)) return;
				const moreButton = root.querySelector(
					'.pie-tool-tts-inline__more-button',
				) as HTMLButtonElement | null;
				moreButton?.focus();
				break;
			}
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

	async function handlePlaybackRate(option: NormalizedTTSSpeedOption) {
		const service = ttsService;
		if (!service) return;
		if (playbackRate === option.rate) {
			statusMessage = `Playback speed ${option.label}`;
			return;
		}
		const previousRequestedRate = requestedPlaybackRate;
		const previousRequestedChoicesKey = requestedPlaybackChoicesKey;
		requestedPlaybackRate = option.rate;
		requestedPlaybackChoicesKey = speedChoicesKey;
		statusMessage = `Playback speed ${option.label}`;
		try {
			await syncTTSPlaybackRate(service, option.rate);
		} catch (error) {
			console.error('[TTS Inline] Playback speed change failed:', error);
			requestedPlaybackRate = previousRequestedRate;
			requestedPlaybackChoicesKey = previousRequestedChoicesKey;
			statusMessage = 'Unable to change playback speed';
		}
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
	const OVERLAY_GUTTER_PX = 8;
	// Host-declared boundary (panel's horizontal container) and protected
	// sibling (e.g. a heading) the panel must not crowd.
	const OVERLAY_BOUNDARY_SELECTOR = '[data-pie-tool-overlay-boundary]';
	const OVERLAY_PROTECTED_SELECTOR = '[data-pie-tool-overlay-protect]';
	let leftAlignedCompact = $state(false);
	let leftAlignedOverlayStyle = $state('');
	// Only refreshed while non-compact; measuring while compact excludes
	// hidden secondary controls and would prevent re-expansion.
	let leftAlignedNaturalWidthPx = $state(0);

	$effect(() => {
		const service = ttsService;
		const rate = playbackRate;
		const active = speaking || paused;
		if (!service || !active || !isActiveOwner()) return;
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled) return;
			void syncTTSPlaybackRate(service, rate);
		});
		return () => {
			cancelled = true;
		};
	});

	function findComposedAncestor(
		start: Element | null,
		selector: string,
	): HTMLElement | null {
		let cursor: Element | null = start;
		while (cursor) {
			if ((cursor as HTMLElement).matches?.(selector)) return cursor as HTMLElement;
			cursor = cursor.parentElement ??
				(cursor.getRootNode() instanceof ShadowRoot
					? ((cursor.getRootNode() as ShadowRoot).host as Element)
					: null);
		}
		return null;
	}

	function getTriggerElement(): HTMLElement | null {
		const root = containerEl?.getRootNode();
		if (!(root instanceof ShadowRoot)) return null;
		return root.querySelector('.pie-tool-tts-inline__trigger');
	}

	// Independent of wrap state, unlike scrollWidth on flex-wrap:wrap.
	function measureNaturalWidth(panel: HTMLElement): number {
		const style = window.getComputedStyle(panel);
		const gap = parseFloat(style.columnGap || style.gap) || 0;
		const chrome =
			(parseFloat(style.paddingLeft) || 0) +
			(parseFloat(style.paddingRight) || 0) +
			(parseFloat(style.borderLeftWidth) || 0) +
			(parseFloat(style.borderRightWidth) || 0);
		const visible = Array.from(panel.children).filter(
			(c) => window.getComputedStyle(c as HTMLElement).display !== 'none',
		) as HTMLElement[];
		if (!visible.length) return 0;
		return (
			visible.reduce((sum, c) => sum + c.offsetWidth, 0) +
			(visible.length - 1) * gap +
			chrome
		);
	}

	function measureLeftAlignedOverlay(): void {
		const trigger = getTriggerElement();
		if (!trigger || !toolbarEl) return;
		const triggerRect = trigger.getBoundingClientRect();
		const boundary = findComposedAncestor(trigger, OVERLAY_BOUNDARY_SELECTOR);
		const boundaryLeft = boundary?.getBoundingClientRect().left ?? 0;
		// Compact-mode triggers when the panel reaches this left limit —
		// the protected sibling's right edge (plus clearance) if declared,
		// otherwise the boundary itself.
		const protectedEl = boundary?.querySelector(OVERLAY_PROTECTED_SELECTOR);
		const leftLimit = protectedEl
			? protectedEl.getBoundingClientRect().right + OVERLAY_GUTTER_PX
			: boundaryLeft;
		const availableWidth = Math.max(
			0,
			triggerRect.left - leftLimit - OVERLAY_GUTTER_PX * 2,
		);
		if (!leftAlignedCompact) {
			const natural = measureNaturalWidth(toolbarEl);
			if (natural > 0) leftAlignedNaturalWidthPx = natural;
		}
		leftAlignedCompact =
			leftAlignedNaturalWidthPx > 0 &&
			availableWidth < leftAlignedNaturalWidthPx;
		const panelHeight = toolbarEl.offsetHeight || triggerRect.height;
		const top = Math.max(
			OVERLAY_GUTTER_PX,
			Math.min(
				window.innerHeight - OVERLAY_GUTTER_PX - panelHeight,
				triggerRect.top + triggerRect.height / 2 - panelHeight / 2,
			),
		);
		const right =
			window.innerWidth - triggerRect.left + OVERLAY_GUTTER_PX;
		// CSS min() lets the browser resolve the host's optional
		// --pie-tts-left-aligned-panel-width (rem/px/calc) at paint time.
		leftAlignedOverlayStyle =
			`top: ${top}px; right: ${right}px; left: auto; max-width: min(${availableWidth}px, var(--pie-tts-left-aligned-panel-width, ${availableWidth}px));`;
	}

	$effect(() => {
		if (!isLeftAlignedFloatingLayout || !controlsVisible) {
			leftAlignedOverlayStyle = '';
			leftAlignedCompact = false;
			leftAlignedNaturalWidthPx = 0;
			return;
		}
		if (typeof window === 'undefined') return;
		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				measureLeftAlignedOverlay();
			});
		};
		measureLeftAlignedOverlay();
		window.addEventListener('resize', schedule);
		window.addEventListener('scroll', schedule, true);
		const trigger = getTriggerElement();
		const observer = new ResizeObserver(schedule);
		if (trigger) observer.observe(trigger);
		if (toolbarEl) observer.observe(toolbarEl);
		const boundary = trigger
			? findComposedAncestor(trigger, OVERLAY_BOUNDARY_SELECTOR)
			: null;
		if (boundary) observer.observe(boundary);
		const protectedEl = boundary?.querySelector(OVERLAY_PROTECTED_SELECTOR);
		if (protectedEl) observer.observe(protectedEl);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', schedule);
			window.removeEventListener('scroll', schedule, true);
			observer.disconnect();
		};
	});

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
		// Defer the broadcast so listeners (e.g. the parent toolbar's
		// `subscribeActive` callback) never run inside our own mount /
		// update flush. Without this, a parent that synchronously creates
		// or reconnects this element during its template/derivation pass
		// — which happens when the section player layout collapses on
		// resize — would receive the event re-entrantly and fail with
		// `state_unsafe_mutation`. The microtask boundary still fires
		// before paint, so consumers see the active state in the same
		// frame.
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled) return;
			host.dispatchEvent(
				new CustomEvent('pie-tool-active-change', {
					detail: { active },
					bubbles: true,
					composed: true
				})
			);
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (controlsVisible) return;
		moreMenuOpen = false;
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
					class:pie-tool-tts-inline__panel--compact={isLeftAlignedFloatingLayout && leftAlignedCompact}
					style={isLeftAlignedFloatingLayout ? leftAlignedOverlayStyle : ''}
					role="toolbar"
					aria-label="Reading controls"
					tabindex="-1"
					onkeydown={handleToolbarKeydown}
				>
					{#if visibleSpeedChoices.length > 0}
						<div class="pie-tool-tts-inline__speed-group" role="radiogroup" aria-label="Playback speed">
							{#each visibleSpeedChoices as option, speedIdx (option.rate)}
								<button
									type="button"
									role="radio"
									data-pie-tts-control
									class="pie-tool-tts-inline__control pie-tool-tts-inline__control--speed"
									onclick={() => handlePlaybackRate(option)}
									onfocus={() => (focusedControlIndex = speedIdx)}
									tabindex={focusedToolbarIndex === speedIdx ? 0 : -1}
									aria-label={option.ariaLabel}
									aria-checked={playbackRate === option.rate}
									disabled={!ttsService}
								>
									<span class="pie-tool-tts-inline__speed-label">{option.label}</span>
								</button>
							{/each}
						</div>
					{/if}

					<button
						type="button"
						data-pie-tts-control
						class="pie-tool-tts-inline__control pie-tool-tts-inline__control--secondary"
						onclick={handleSeekBackward}
						onfocus={() => (focusedControlIndex = speedControlCount)}
						tabindex={focusedToolbarIndex === speedControlCount ? 0 : -1}
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
						class="pie-tool-tts-inline__control pie-tool-tts-inline__control--secondary"
						onclick={handleSeekForward}
						onfocus={() => (focusedControlIndex = speedControlCount + 1)}
						tabindex={focusedToolbarIndex === speedControlCount + 1 ? 0 : -1}
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
						class="pie-tool-tts-inline__control pie-tool-tts-inline__control--secondary"
						onclick={handleStop}
						onfocus={() => (focusedControlIndex = speedControlCount + 2)}
						tabindex={focusedToolbarIndex === speedControlCount + 2 ? 0 : -1}
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

		{#snippet moreMenuButton()}
			{#if isLeftAlignedFloatingLayout && controlsVisible && leftAlignedCompact}
				<div class="pie-tool-tts-inline__more">
					<button
						type="button"
						class="pie-tool-tts-inline__trigger pie-tool-tts-inline__trigger--md pie-tool-tts-inline__more-button"
						onclick={toggleMoreMenu}
						aria-label="More reading controls"
						aria-haspopup="menu"
						aria-expanded={moreMenuOpen}
						aria-controls={moreMenuOpen ? moreMenuId : undefined}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true">
							<path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
						</svg>
					</button>
					{#if moreMenuOpen}
						<div
							id={moreMenuId}
							class="pie-tool-tts-inline__more-menu"
							role="menu"
							aria-label="More reading controls"
							onkeydown={handleMoreMenuKeydown}
						>
							<button type="button" role="menuitem" data-pie-tts-more-control onclick={() => { closeMoreMenu(); void handleSeekBackward(); }} disabled={!ttsService || !speaking}>
								Rewind
							</button>
							<button type="button" role="menuitem" data-pie-tts-more-control onclick={() => { closeMoreMenu(); void handleSeekForward(); }} disabled={!ttsService || !speaking}>
								Fast-forward
							</button>
							<button type="button" role="menuitem" data-pie-tts-more-control onclick={() => { closeMoreMenu(); handleStop(); }} disabled={!ttsService || (!speaking && !paused)}>
								Stop reading
							</button>
						</div>
					{/if}
				</div>
			{/if}
		{/snippet}

		{@render triggerButton()}
		{@render controlsPanel()}
		{@render moreMenuButton()}

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
		gap: 0.5rem;
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
		border: 1px solid var(--pie-button-border-color, var(--pie-button-border, var(--pie-border, #c6c6c6)));
		background-color: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-background, #fff)));
		color: var(--pie-button-color, var(--pie-text, #333));
		border-radius: 0.25rem;
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.pie-tool-tts-inline__trigger:hover:not(:disabled),
	.pie-tool-tts-inline__control:hover:not(:disabled) {
		background-color: var(--pie-button-hover-background-color, var(--pie-button-hover-bg, var(--pie-secondary-background, #f2f4f8)));
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
		border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1565c0));
		background-color: var(
			--pie-tool-trigger-active-background,
			color-mix(in srgb, var(--pie-primary, #1565c0) 10%, var(--pie-background, #fff))
		);
		color: var(--pie-tool-trigger-active-color, var(--pie-button-color, var(--pie-text, #333)));
	}

	.pie-tool-tts-inline__trigger--active:hover:not(:disabled) {
		border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1565c0));
		background-color: var(
			--pie-tool-trigger-active-background,
			color-mix(in srgb, var(--pie-primary, #1565c0) 10%, var(--pie-background, #fff))
		);
		color: var(--pie-tool-trigger-active-color, var(--pie-button-color, var(--pie-text, #333)));
	}

	.pie-tool-tts-inline__panel {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		box-sizing: border-box;
		min-height: var(--pie-tts-controls-row-height, 2.875rem);
		max-width: min(100vw - 1rem, 32rem);
		padding: 0.25rem 0.5rem;
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
		/* Fixed so it escapes overflow-clipping ancestors; top / right /
		   max-width are set inline by measureLeftAlignedOverlay(). */
		position: fixed;
	}

	.pie-tool-tts-inline__panel--compact .pie-tool-tts-inline__control--secondary {
		display: none;
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
		border: 1px solid var(--pie-button-border-color, var(--pie-button-border, var(--pie-border, #c6c6c6)));
		border-radius: 0.25rem;
		background: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-background, #fff)));
		color: var(--pie-button-color, var(--pie-text, #222));
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.pie-tool-tts-inline__speed-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.pie-tool-tts-inline__control--speed {
		width: auto;
		min-width: 2.75rem;
		height: 2rem;
		padding: 0 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0;
		white-space: nowrap;
	}

	.pie-tool-tts-inline__control--speed[aria-checked='true'] {
		border-color: var(--pie-primary, #1565c0);
		background: color-mix(in srgb, var(--pie-primary, #1565c0) 14%, var(--pie-background, #fff));
		color: var(--pie-primary, #1565c0);
		font-weight: 600;
	}

	.pie-tool-tts-inline__speed-label {
		line-height: 1.2;
	}

	.pie-tool-tts-inline__more {
		position: relative;
		display: inline-flex;
	}

	.pie-tool-tts-inline__more-menu {
		position: absolute;
		z-index: 3;
		top: calc(100% + 0.25rem);
		right: 0;
		display: flex;
		flex-direction: column;
		min-width: 10rem;
		padding: 0.25rem;
		border: 1px solid var(--pie-border, #d0d0d0);
		border-radius: 0.375rem;
		background: var(--pie-surface, var(--pie-background, #fff));
		box-shadow: 0 0.25rem 0.75rem color-mix(in srgb, var(--pie-shadow, #000) 18%, transparent);
	}

	.pie-tool-tts-inline__more-menu button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		width: 100%;
		padding: 0.5rem 0.625rem;
		border: 0;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--pie-button-color, var(--pie-text, #222));
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pie-tool-tts-inline__more-menu button:hover:not(:disabled),
	.pie-tool-tts-inline__more-menu button:focus-visible {
		background: var(--pie-button-hover-background-color, var(--pie-button-hover-bg, var(--pie-secondary-background, #f2f4f8)));
		outline: 2px solid var(--pie-focus-outline, var(--pie-button-focus-outline, var(--pie-primary, #0066cc)));
		outline-offset: 2px;
	}

	.pie-tool-tts-inline__more-menu button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
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
		/* Default explicit size so control-button icons (rewind/fast-forward/stop)
		   render in WebKit, which sizes an inline SVG that has only a viewBox (no
		   width/height attributes) to 0. The play/pause trigger icon already works
		   because the __trigger--sm/md/lg rules below set these dimensions; this
		   gives the control-panel icons the same treatment. Keep the SVG's default
		   inline display — forcing display:block makes WebKit collapse it to 0. */
		width: 1.25rem;
		height: 1.25rem;
		fill: currentColor;
		color: currentColor;
	}

	@media (max-width: 839px) {
		.pie-tool-tts-inline {
			gap: 0.375rem;
		}

		.pie-tool-tts-inline__panel--compact {
			padding: 0.1875rem 0.375rem;
		}

		.pie-tool-tts-inline__trigger,
		.pie-tool-tts-inline__trigger--md,
		.pie-tool-tts-inline__control {
			width: 1.75rem;
			height: 1.75rem;
		}

		.pie-tool-tts-inline__trigger .pie-tool-tts-inline__icon,
		.pie-tool-tts-inline__control .pie-tool-tts-inline__icon {
			width: 1rem;
			height: 1rem;
		}

		.pie-tool-tts-inline__control--speed {
			width: auto;
			min-width: 2.5rem;
			height: 1.75rem;
			padding: 0 0.5rem;
		}
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
