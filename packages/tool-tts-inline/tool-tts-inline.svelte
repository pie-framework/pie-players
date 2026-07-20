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
	// Side-effect import: registers <nds-icon-button>. Single vendored source of
	// truth lives in players-shared (Lit inlined, self-contained); see
	// players-shared/src/components/vendor/nds/README.md. players-shared is not
	// externalized by this package's Vite build, so the bundle is inlined here.
	import '@pie-players/pie-players-shared/nds-icon-button';
	import { useZoomCompensation, ICON_BUTTON_ZOOM_OPTIONS } from '@pie-players/pie-players-shared/ui/use-zoom-compensation';

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

	// ── FontAwesome + Roboto wiring for <nds-icon-button> ─────────────────────
	// The vendored NDS button renders `<i class="fa-light fa-…">` and expects
	// Roboto. Mirror @pie-players/pie-assessment-toolkit's ItemToolBar: prefetch
	// the stylesheets into document <head>, then clone whatever FA <link>s the
	// host has into this element's shadow root (document-head styles don't cross
	// the shadow boundary). See the toolkit's ItemToolBar for the full rationale.
	const FA_PRO_HREFS = ['/_fa-pro/fontawesome.min.css', '/_fa-pro/light.min.css'];
	const FA_FREE_HREF =
		'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css';
	const ROBOTO_HREF =
		'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap';
	const FA_HREF_PATTERN = /font.?awesome|fa-?pro/i;
	let ndsAssetsInstalled = false;
	const ensureNdsAssets = () => {
		if (!isBrowser || ndsAssetsInstalled) return;
		ndsAssetsInstalled = true;
		if (!document.querySelector('link[href*="Roboto"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = ROBOTO_HREF;
			document.head.appendChild(link);
		}
		const hostHasFa = Array.from(
			document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
		).some((link) => FA_HREF_PATTERN.test(link.href));
		if (hostHasFa) return;
		if (!document.querySelector(`link[href="${FA_FREE_HREF}"]`)) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = FA_FREE_HREF;
			document.head.appendChild(link);
		}
		for (const href of FA_PRO_HREFS) {
			if (document.querySelector(`link[href="${href}"]`)) continue;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			document.head.appendChild(link);
		}
	};
	const FA_SHADOW_INSTALLED = '__pieFaTtsShadowInstalled';
	const installFaInShadow = (node: HTMLElement) => {
		const shadow = node.getRootNode();
		if (!(shadow instanceof ShadowRoot)) return;
		const marker = shadow as ShadowRoot & { [FA_SHADOW_INSTALLED]?: boolean };
		if (marker[FA_SHADOW_INSTALLED]) return;
		marker[FA_SHADOW_INSTALLED] = true;
		const seenHrefs = new Set<string>();
		const appendLink = (href: string) => {
			if (!href || seenHrefs.has(href)) return;
			seenHrefs.add(href);
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			shadow.appendChild(link);
		};
		const documentFaLinks = Array.from(
			document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
		).filter((link) => FA_HREF_PATTERN.test(link.href));
		for (const link of documentFaLinks) appendLink(link.href);
	};
	// Svelte action applied to every <nds-icon-button>: install the FA assets its
	// glyphs need (into <head> and this component's shadow root), and force the
	// glyphs to the Solid weight. The NDS bundle hardcodes `fa-light fa-${name}`
	// (thin outline); play/pause read as proper media-control icons in Solid, and
	// Solid is the weight FA Free ships, so it renders even without FA Pro. The
	// swap re-applies whenever Lit rewrites the icon class (e.g. play↔pause).
	const ndsIconButtonAction = (node: HTMLElement) => {
		ensureNdsAssets();
		installFaInShadow(node);
		const applySolid = () => {
			for (const icon of node.querySelectorAll<HTMLElement>('i.fa-light')) {
				icon.classList.remove('fa-light');
				icon.classList.add('fa-solid');
			}
		};
		applySolid();
		// Watch both the initial <i> insertion (childList) and Lit's in-place class
		// rewrites on icon-name change (attributes). Our own class edit removes
		// `fa-light`, so the follow-up callback is a no-op — no infinite loop.
		const observer = new MutationObserver(applySolid);
		observer.observe(node, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
		});
		return {
			destroy() {
				observer.disconnect();
			},
		};
	};

	// <nds-icon-button> only exposes `button-aria-label` on its inner light-DOM
	// <button>. Reflect any additional ARIA relationships (expanded / controls /
	// pressed / haspopup) onto that inner button so the trigger keeps its
	// disclosure + toggle semantics. The button is created by Lit after the
	// element's first update, so we watch for it and re-apply on re-render.
	const reflectAria = (node: HTMLElement, attrs: Record<string, string | null>) => {
		let current = attrs;
		const apply = () => {
			const inner = node.querySelector('button');
			if (!inner) return;
			for (const [name, value] of Object.entries(current)) {
				if (value == null) inner.removeAttribute(name);
				else inner.setAttribute(name, value);
			}
		};
		apply();
		// childList/subtree only — attribute writes above don't retrigger this.
		const observer = new MutationObserver(apply);
		observer.observe(node, { childList: true, subtree: true });
		return {
			update(next: Record<string, string | null>) {
				current = next;
				apply();
			},
			destroy() {
				observer.disconnect();
			},
		};
	};

	// Lightweight sibling of `ndsIconButtonAction` for the non-NDS fallback
	// trigger: still install the FA assets the panel's `<i class="fa-…">`
	// glyphs depend on (normally installed as a side effect of rendering the
	// NDS trigger), but skip the fa-light→fa-solid swap since the fallback
	// authors its glyphs as `fa-solid` directly.
	const faAssetsAction = (node: HTMLElement) => {
		ensureNdsAssets();
		installFaInShadow(node);
		return {};
	};

	let containerEl = $state<HTMLDivElement | undefined>();
	let toolbarEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Presentation gate from the host runtime. The trigger renders as an
	// <nds-icon-button> only when the host explicitly opts in
	// (`ndsIcons === true`); otherwise it is a plain <button>.
	const useNdsIcons = $derived(runtimeContext?.ndsIcons === true);
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
	let leftAlignedCompact = $state(false);
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
		// The trigger is now an <nds-icon-button> host whose real focusable
		// control is its inner light-DOM <button>; fall back to the host for any
		// non-nds rendering.
		const trigger = root.querySelector('.pie-tool-tts-inline__trigger');
		const focusTarget = (trigger?.querySelector('button') ??
			trigger) as HTMLElement | null;
		focusTarget?.focus();
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

	// Freeze the TTS buttons' physical size at their 200%-zoom appearance once
	// browser zoom exceeds 200%, matching the passage/questions toggle. The
	// factor is 1 at zoom <= 200% (behaviour unchanged below that) and applied
	// as CSS `zoom` to the trigger + control buttons, with the surrounding
	// panel/gap spacing compensated via calc(). It is NOT applied to the panel
	// or root container: the left-aligned popper is position:fixed and its
	// top/right are JS-computed from real viewport coordinates, so zooming the
	// container would double-scale and misplace it. See minCompensation note on
	// SectionPlayerTabbedContent — 0.25 keeps the 200% cap holding past 500%.
	// Shared with the calculator button (assessment-toolkit) so both icon
	// buttons cap identically — see ICON_BUTTON_ZOOM_OPTIONS.
	const buttonZoom = useZoomCompensation(ICON_BUTTON_ZOOM_OPTIONS);
	const OVERLAY_GUTTER_PX = 8;
	// Host-declared boundary (panel's horizontal container) and protected
	// sibling (e.g. a heading) the panel must not crowd.
	const OVERLAY_BOUNDARY_SELECTOR = '[data-pie-tool-overlay-boundary]';
	const OVERLAY_PROTECTED_SELECTOR = '[data-pie-tool-overlay-protect]';
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
		// The panel is allowed to sit on top of the header title, so it can extend
		// all the way to the card/boundary left edge. Compact only kicks in once
		// even that full width isn't enough — not merely when it reaches the
		// heading. (The heading is still observed for re-measure on resize.)
		const availableWidth = Math.max(
			0,
			triggerRect.left - boundaryLeft - OVERLAY_GUTTER_PX * 2,
		);
		if (!leftAlignedCompact) {
			const natural = measureNaturalWidth(toolbarEl);
			if (natural > 0) leftAlignedNaturalWidthPx = natural;
		}
		leftAlignedCompact =
			leftAlignedNaturalWidthPx > 0 &&
			availableWidth < leftAlignedNaturalWidthPx;
		const panelHeight = toolbarEl.offsetHeight || triggerRect.height;
		// Position is anchored to the trigger (the TTS button) and re-tracked on
		// scroll, with NO viewport clamp — so the panel stays glued to the button
		// and scrolls off with it (disappears) instead of sticking to the viewport
		// edge. Roomy: centre the 48px card on the trigger. Compact: anchor the
		// tall popper's top to the trigger's top so its media row lines up with the
		// play/pause circle and the speeds hang below.
		const top = leftAlignedCompact
			? triggerRect.top
			: triggerRect.top + triggerRect.height / 2 - panelHeight / 2;
		const right = window.innerWidth - triggerRect.left + OVERLAY_GUTTER_PX;
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
</script>

{#if isBrowser}
	<div
		bind:this={containerEl}
		class="pie-tool-tts-inline"
		class:pie-tool-tts-inline--controls-row={isControlsRowLayout}
		class:pie-tool-tts-inline--floating={isFloatingLayout}
		class:pie-tool-tts-inline--left-aligned={isLeftAlignedFloatingLayout}
		style={`--pie-tts-zoom-comp: ${buttonZoom.current};`}
	>
		{#snippet triggerButton()}
			{#if useNdsIcons}
				<!-- 200% zoom cap lives on this WRAPPER, never on the nds-icon-button
			     host directly: CSS `zoom` on an nds-icon-button (light-DOM render +
			     injected global <style>) mis-sizes it. Wrapping matches the proven
			     section-player scroll-hint pattern. -->
			<span class="pie-tool-tts-inline__trigger-zoom">
				<!-- NDS circular icon button. `variant="primary"` (filled) marks the
					     active/open state; `ghost` is the resting state. The native click
					     bubbles out of the component's inner <button>, so `onclick` still
					     runs handlePlayPause. `reflectAria` mirrors the disclosure/toggle
					     relationships onto that inner button (nds exposes only aria-label). -->
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<nds-icon-button
						use:ndsIconButtonAction
						use:reflectAria={{
							'aria-expanded': controlsVisible ? 'true' : 'false',
							'aria-controls': controlsVisible ? panelId : null,
							'aria-pressed': controlsVisible ? 'true' : 'false',
						}}
						class="pie-tool-tts-inline__trigger {sizeClass}"
						type="circle"
						size="small"
						variant="tertiary"
						icon-name={speaking && !paused ? 'pause' : 'play'}
						button-aria-label={speaking && !paused ? 'Pause reading' : paused ? 'Resume reading' : 'Play reading'}
						disabled={!ttsService || playActionInFlight}
						onclick={handlePlayPause}
					></nds-icon-button>
			{:else}
				<!-- Non-NDS fallback: plain <button> with the same play/pause FA
				     glyph the panel controls use. Keeps the `__trigger` class so
				     the focus-restore helpers still find it, and the `__control`
				     styling so it matches the other plain controls. -->
				<button
					use:faAssetsAction
					type="button"
					class="pie-tool-tts-inline__control pie-tool-tts-inline__trigger pie-tool-tts-inline__trigger--plain {sizeClass}"
					aria-expanded={controlsVisible ? 'true' : 'false'}
					aria-controls={controlsVisible ? panelId : undefined}
					aria-pressed={controlsVisible ? 'true' : 'false'}
					aria-label={speaking && !paused ? 'Pause reading' : paused ? 'Resume reading' : 'Play reading'}
					disabled={!ttsService || playActionInFlight}
					onclick={handlePlayPause}
				>
					<i
						class={`fa-solid ${speaking && !paused ? 'fa-pause' : 'fa-play'} pie-tool-tts-inline__icon`}
						aria-hidden="true"
					></i>
				</button>
			{/if}
			</span>
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
						<!-- Speed radios. Roomy: inline row before the media controls.
						     Compact left-aligned overlay: stacked vertically in a card
						     that sits below the media row (the media controls stay on the
						     top line). Same radiogroup + roving tabindex in both layouts;
						     only the arrangement changes (see the --stacked CSS). -->
						<div
							class="pie-tool-tts-inline__speed-group"
							class:pie-tool-tts-inline__speed-group--stacked={leftAlignedCompact}
							role="radiogroup"
							aria-label="Playback speed"
						>
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
									<span class="pie-tool-tts-inline__speed-label" data-label={option.label}>{option.label}</span>
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
						<i class="fa-solid fa-backward pie-tool-tts-inline__icon" aria-hidden="true"></i>
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
						<i class="fa-solid fa-forward pie-tool-tts-inline__icon" aria-hidden="true"></i>
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
						<i class="fa-solid fa-stop pie-tool-tts-inline__icon" aria-hidden="true"></i>
					</button>
				</div>
			{/if}
		{/snippet}

		{@render triggerButton()}
		{@render controlsPanel()}

		<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
			{statusMessage}
		</div>
	</div>
{/if}

<style>
	/* Lay the component out as a flex box, not the default inline custom element.
	   As `display: inline` the host is blockified into a block flex item that
	   wraps its content in a line box, so the inline-flex root sits on the text
	   baseline — a zoom-shrunk play button then rides that baseline and drifts
	   LOW versus the calculator button (whose flex-item wrapper has no line box).
	   inline-flex + center removes the line box and keeps the trigger centered. */
	:host {
		display: inline-flex;
		align-items: center;
	}

	.pie-tool-tts-inline {
		position: relative;
		display: inline-flex;
		align-items: center;
		/* Gap between trigger and panel lives outside the zoomed buttons, so it
		   is compensated separately or it keeps growing with browser zoom. */
		gap: calc(0.5rem * var(--pie-tts-zoom-comp, 1));
	}

	.pie-tool-tts-inline--controls-row {
		width: 100%;
		justify-content: flex-end;
	}

	/* The play/pause trigger and the "more" overflow control are now
	   <nds-icon-button> hosts; the NDS component owns their shape, colours,
	   hover/active/focus states, and the filled active (`variant="primary"`)
	   appearance. This class only drives the host's size via NDS's own size
	   custom properties (see the size variants below), so the light-DOM inner
	   button matches the toolbar's md/sm/lg dimensions. */
	/* Freeze the play/pause button at its 200%-zoom appearance (factor is 1 at
	   zoom <= 200%, so behaviour below that is unchanged). The zoom goes on this
	   wrapper, not the nds-icon-button host — see the snippet. */
	.pie-tool-tts-inline__trigger-zoom {
		display: inline-flex;
		zoom: var(--pie-tts-zoom-comp, 1);
	}

	.pie-tool-tts-inline__trigger {
		display: inline-flex;
		/* Outer button size follows the toolbar size variants (below); the glyph
		   keeps the NDS-native icon size (size="small") so it isn't oversized. */
		--height-32: 2rem;
		/* Host-settable accent: the NDS tertiary glyph colour derives from
		   --color-interactive-blue, remapped here to a themeable variable. */
		--color-interactive-blue: var(--pie-tts-button-color, #146eb3);
	}

	/* Non-NDS fallback trigger (host opted out of nds-icon-button). Inherits
	   the plain `__control` box; only override to keep the round trigger
	   shape and the themeable accent colour on its glyph. */
	.pie-tool-tts-inline__trigger--plain {
		border-radius: 50%;
		color: var(--pie-tts-button-color, #146eb3);
	}

	.pie-tool-tts-inline__control:hover:not(:disabled) {
		background-color: var(--pie-button-hover-background-color, var(--pie-button-hover-bg, var(--pie-secondary-background, #f2f4f8)));
		transform: translateY(-1px);
		box-shadow: 0 2px 6px color-mix(in srgb, var(--pie-shadow, #000) 14%, transparent);
	}

	.pie-tool-tts-inline__control:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.pie-tool-tts-inline__control:focus-visible {
		outline: 2px solid var(--pie-focus-outline, var(--pie-button-focus-outline, var(--pie-primary, #0066cc)));
		outline-offset: 2px;
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--pie-primary, #0066cc) 22%, transparent);
	}

	.pie-tool-tts-inline__panel {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		/* Buttons inside are zoom-capped (see __control); compensate the panel's
		   own spacing/height with the same factor so its chrome doesn't keep
		   growing around the frozen buttons past 200%. */
		gap: calc(0.25rem * var(--pie-tts-zoom-comp, 1));
		box-sizing: border-box;
		min-height: calc(var(--pie-tts-controls-row-height, 2.875rem) * var(--pie-tts-zoom-comp, 1));
		padding: calc(0.25rem * var(--pie-tts-zoom-comp, 1)) calc(0.5rem * var(--pie-tts-zoom-comp, 1));
		background: var(--pie-surface, var(--pie-background, #fff));
		border: 1px solid var(--pie-border, #d0d0d0);
		border-radius: 0.5rem;
	}

	.pie-tool-tts-inline__panel--floating {
		position: absolute;
		z-index: 2;
		top: 50%;
		right: 0;
		left: auto;
	}

	.pie-tool-tts-inline__panel--left-aligned-inline {
		/* Fixed so it escapes overflow-clipping ancestors; top / right /
		   max-width are set inline by measureLeftAlignedOverlay(). */
		position: fixed;
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
		/* Cap each control (rewind / fast-forward / stop / speed) at its
		   200%-zoom size; matches the trigger and the passage/questions toggle. */
		zoom: var(--pie-tts-zoom-comp, 1);
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--pie-button-border-color, var(--pie-button-border, var(--pie-border, #c6c6c6)));
		border-radius: 0.25rem;
		background: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-background, #fff)));
		color: var(--pie-button-color, var(--pie-text, #222));
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	/* Icon-only panel controls (rewind / fast-forward / stop) are round to match
	   the circular NDS trigger; the pill-shaped speed radios keep square corners. */
	.pie-tool-tts-inline__control--secondary {
		border-radius: 50%;
	}

	.pie-tool-tts-inline__speed-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(0.25rem * var(--pie-tts-zoom-comp, 1));
	}

	.pie-tool-tts-inline__control--speed {
		width: auto;
		height: 2rem;
		padding: 0;
		font-size: 1rem;
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
		/* Render speed labels lowercase regardless of the configured casing.
		   Applied to the visible text only; the radio's accessible name comes
		   from aria-label (option.ariaLabel), so screen readers still hear the
		   canonical "Slow speed" / "Normal speed" / "Fast speed". */
		text-transform: lowercase;
	}

	/* Reserve the bold (selected) width — stacked popper only. Switching the
	   selected speed there would otherwise change the label width and resize the
	   fit-content card. The ghost is a zero-height, hidden grid row whose bold text
	   sets the column width. The inline (roomy) row keeps its natural sizing. */
	.pie-tool-tts-inline__speed-group--stacked .pie-tool-tts-inline__speed-label {
		display: inline-grid;
		justify-items: center;
	}

	.pie-tool-tts-inline__speed-group--stacked .pie-tool-tts-inline__speed-label::before {
		content: attr(data-label);
		height: 0;
		overflow: hidden;
		font-weight: 700;
		visibility: hidden;
	}

	.pie-tool-tts-inline__control:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* ── Overlay layouts (floating-overlay + left-aligned) ──────────────────────
	   Per the Knowledge-Check design the controls sit transparently on the
	   surrounding Question/Passage header: no panel chrome, media controls are
	   accent-blue icon-only glyphs, and the speed radios are plain muted text with
	   the selected one lifted into a white chip. The accent stays the same
	   host-settable variable as the play/pause + calculator buttons
	   (--pie-tts-button-color). Themeable knobs: --pie-tts-inline-muted-color,
	   --pie-tts-selected-bg/-border/-shadow, --pie-tts-menu-shadow,
	   --pie-tts-trigger-shadow. */
	.pie-tool-tts-inline__panel--floating,
	.pie-tool-tts-inline__panel--left-aligned-inline {
		min-height: 0;
		height: calc(3rem * var(--pie-tts-zoom-comp, 1)); /* Figma: 48px */
		justify-content: center;
		gap: calc(0.375rem * var(--pie-tts-zoom-comp, 1));
		background: var(--pie-tts-selected-bg, #fff);
		border: 0;
		border-radius: 0.5rem; /* Figma: --radius-8 (8px) */
		box-shadow: var(--pie-tts-menu-shadow, 0 1px 5px 0 rgba(0, 0, 0, 0.3));
	}

	/* Compact: the popper card holds the media row (rewind / fast-forward / stop)
	   on top and the speed radios stacked below. The white card bg + shadow come
	   from the shared overlay rule above; this only tunes the compact layout. */
	.pie-tool-tts-inline__panel--compact {
		gap: 0;
		width: fit-content;
		min-width: calc(7.5rem * var(--pie-tts-zoom-comp, 1)); /* ~120px floor; grows with content beyond that */
		height: auto; /* stacked popper grows past the 48px roomy toolbar height */
		padding: 0;
	}

	/* Media controls (rewind / fast-forward / stop): accent-blue, no chrome. */
	.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--secondary,
	.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--secondary {
		border: 0;
		background: transparent;
		color: var(--pie-tts-button-color, #146eb3);
	}

	.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--secondary:hover:not(:disabled),
	.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--secondary:hover:not(:disabled) {
		transform: none;
		box-shadow: none;
		background: color-mix(in srgb, var(--pie-tts-button-color, #146eb3) 12%, transparent);
	}

	/* Speed radios (inline / roomy): plain muted text with breathing room between
	   options — min-width + side padding, matching the original inline spacing. */
	.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--speed,
	.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--speed {
		min-width: 2.75rem;
		padding: 0 0.625rem;
		border: 1px solid transparent;
		background: transparent;
		box-shadow: none;
		color: var(--pie-tts-inline-muted-color, #5b6b73);
		font-size: 1rem;
	}

	.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--speed:hover:not(:disabled),
	.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--speed:hover:not(:disabled) {
		transform: none;
		box-shadow: none;
		background: color-mix(in srgb, var(--pie-tts-button-color, #146eb3) 8%, transparent);
	}

	/* Selected inline radio: white "chip" treatment. Placed after the muted rule
	   so it wins at equal specificity. */
	.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--speed[aria-checked='true'],
	.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--speed[aria-checked='true'] {
		border: 1px solid var(--pie-selected-button-border, #d9dada);
		border-radius: 6px;
		background: var(--pie-selected-button-background, #f3f5f7);
		color: var(--pie-tts-button-color, #146eb3);
		font-weight: 600;
	}

	/* ── Compact left-aligned overlay ───────────────────────────────────────────
	   Inside the popper card the media controls occupy the top row and the speed
	   radios drop onto their own full-width line below, stacked vertically.
	   `order` puts the speeds after the media buttons even though they are first in
	   the DOM; flex-basis:100% forces the wrap so media occupy the top line. */
	.pie-tool-tts-inline__speed-group--stacked {
		order: 1;
		flex-basis: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
	}

	/* In the card every option reads in the accent colour; the selected one is
	   lifted into a bordered white chip. Options size to their content and centre
	   (no full-width stretch), keeping the popper compact. */
	.pie-tool-tts-inline__speed-group--stacked .pie-tool-tts-inline__control--speed {
		justify-content: center;
		width: auto;
		min-width: 0;
		height: auto;
		padding: 0.25rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		box-shadow: none;
		color: var(--pie-tts-button-color, #146eb3);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.pie-tool-tts-inline__speed-group--stacked .pie-tool-tts-inline__control--speed[aria-checked='true'] {
		border: 1px solid var(--pie-selected-button-border, #d9dada);
		border-radius: 6px;
		background: var(--pie-selected-button-background, #f3f5f7);
		color: var(--pie-tts-button-color, #146eb3);
		font-weight: 700;
	}

	/* Trigger size variants set the NDS outer size (--height-32); the glyph keeps
	   the NDS-native icon size (host renders size="small"). */
	.pie-tool-tts-inline__trigger--sm {
		--height-32: 1.75rem;
	}

	.pie-tool-tts-inline__trigger--md {
		--height-32: 2rem;
	}

	.pie-tool-tts-inline__trigger--lg {
		--height-32: 2.5rem;
	}

	.pie-tool-tts-inline__icon {
		font-size: 1rem;
		line-height: 1;
		color: currentColor;
	}

	@media (max-width: 839px) {
		.pie-tool-tts-inline {
			gap: 0.375rem;
		}

		.pie-tool-tts-inline__panel--compact {
			padding: 0;
		}

		/* NOTE: the trigger's --height-32 is intentionally NOT shrunk here. Browser
		   zoom narrows the CSS viewport enough to trip this breakpoint, which would
		   drop the play button to 1.75rem while the calculator button (furnished by
		   the toolbar) stays 2rem, mismatching them under zoom. Size is governed by
		   the zoom-compensation cap instead. */

		.pie-tool-tts-inline__control {
			width: 1.75rem;
			height: 1.75rem;
		}

		.pie-tool-tts-inline__control .pie-tool-tts-inline__icon {
			font-size: 1rem;
		}

		.pie-tool-tts-inline__control--speed {
			width: auto;
			min-width: 2.5rem;
			height: 1.75rem;
			padding: 0 0.5rem;
		}

		/* drop font-size on smaller screens */
		.pie-tool-tts-inline__panel--floating .pie-tool-tts-inline__control--speed,
		.pie-tool-tts-inline__panel--left-aligned-inline .pie-tool-tts-inline__control--speed {
			font-size: 0.75rem;
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
		.pie-tool-tts-inline__control {
			transition: none !important;
		}
	}
</style>
