<svelte:options
	customElement={{
		tag: 'pie-tool-annotation-toolbar',
		shadow: 'open',
		props: {
			enabled: { type: 'Boolean', attribute: 'enabled' },
			highlightCoordinator: { type: 'Object' },
			ttsService: { type: 'Object' },
			selectionActions: { type: 'Object' }
		}
	}}
/>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type {
		AssessmentToolkitRegionScopeContext,
		AssessmentToolkitRuntimeContext,
		AssessmentToolkitShellContext,
		HighlightCoordinator,
		ToolSelectionAction,
		TtsServiceApi
	} from '@pie-players/pie-assessment-toolkit';
	import {
		connectAssessmentToolkitRegionScopeContext,
		connectAssessmentToolkitShellContext,
		connectToolRuntimeContext,
		HighlightColor
	} from '@pie-players/pie-assessment-toolkit';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import { sanitizeSvgIcon } from '@pie-players/pie-players-shared/security';
	import {
		clampIndex,
		isPointerGestureActive,
		isRectOffScreen,
		nextControlIndex,
		requestsSelectionToolbar,
		toolbarAnchor
	} from './selection-keyboard.js';
	import { usableSelectionActions } from './selection-actions.js';

	interface Props {
		enabled?: boolean;
		highlightCoordinator?: HighlightCoordinator | null;
		ttsService?: TtsServiceApi | null;
		/**
		 * Actions on the current selection, supplied by whoever mounts this gateway.
		 *
		 * This strip does not know what they do — it renders the buttons and hands each
		 * one the selection. Pairing an action to a capability is the composer's job,
		 * which is what keeps a highlighter from naming a dictionary and lets a host
		 * contribute an action for a capability PIE does not ship.
		 */
		selectionActions?: ToolSelectionAction[] | null;
	}

	let {
		enabled = true,
		highlightCoordinator = null,
		ttsService = null,
		selectionActions = null
	}: Props = $props();

	const isBrowser = typeof window !== 'undefined';

	// Storage key for sessionStorage
	const STORAGE_KEY = 'pie-annotations';

	// Disallowed elements - don't show toolbar when selecting these
	const DISALLOWED_SELECTORS = [
		'button',
		'input',
		'select',
		'textarea',
		'[contenteditable="true"]',
		'.pie-tool-annotation-toolbar',
		'.pie-tool-toolbar',
		'[role="button"]',
		'[role="textbox"]'
	];

	// State - using Svelte 5 $state rune for reactive state
	let contextHostElement = $state<HTMLElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Interface locale, re-derived on every context republish.
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));

	// Available highlight colors (modern, accessible palette). `$derived` because
	// the labels come from the catalog, so the list rebuilds when the locale moves —
	// which is also why it has to be declared after `interfaceI18n` rather than with
	// the other constants above.
	const HIGHLIGHT_COLORS = $derived([
		{
			name: HighlightColor.YELLOW,
			hex: '#fde995',
			label: interfaceI18n.t('tools.annotationToolbar.highlightYellowA11y')
		},
		{
			name: HighlightColor.PINK,
			hex: '#ff9fae',
			label: interfaceI18n.t('tools.annotationToolbar.highlightPinkA11y')
		},
		{
			name: HighlightColor.BLUE,
			hex: '#a7e0f6',
			label: interfaceI18n.t('tools.annotationToolbar.highlightBlueA11y')
		},
		{
			name: HighlightColor.GREEN,
			hex: '#a6e1c5',
			label: interfaceI18n.t('tools.annotationToolbar.highlightGreenA11y')
		}
	]);
	let toolbarElement = $state<HTMLElement | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let regionScopeContext = $state<AssessmentToolkitRegionScopeContext | null>(null);
	let toolbarState = $state({
		isVisible: false,
		selectedText: '',
		selectedRange: null as Range | null,
		toolbarPosition: { x: 0, y: 0, below: false }
	});

	// TTS state
	let ttsSpeaking = $state(false);

	// UX state
	let justShown = $state(false); // Flag to prevent immediate hiding after showing
	let positionAnnouncement = $state(''); // For screen readers when toolbar is repositioned

	// Track annotation count for reactivity (increments on add/remove to trigger UI updates)
	let annotationCount = $state(0);

	// Track if current selection overlaps with an existing annotation
	let overlappingAnnotationId = $state<string | null>(null);

	/**
	 * When the in-progress pointer gesture started, or `null` between gestures.
	 *
	 * A timestamp rather than a boolean so the suppression cannot wedge: a release
	 * outside the window fires no `pointerup`, and a latch stuck on would mean the
	 * toolbar never appears again. See `isPointerGestureActive`.
	 */
	let pointerDownAt: number | null = null;
	let selectionFrame: number | null = null;
	let announcementTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Text the live region last spoke for, so extending a selection does not
	 * re-announce on every keystroke. Shift+Arrow fires `selectionchange` per
	 * character; announcing each one makes the strip unusable with a screen reader.
	 */
	let announcedForText: string | null = null;

	/**
	 * Selection text a completed action has finished with.
	 *
	 * An action that hands the selection elsewhere is done with the strip, but the
	 * selection itself survives on purpose — the learner's place in the text is not
	 * ours to clear. Without this latch the next `selectionchange` re-shows the strip
	 * over the panel the action just opened, and opening a panel moves focus, which
	 * fires one: measured, the strip came straight back over the definition.
	 *
	 * Only completed actions latch. Escape, focus leaving and an outside click do not,
	 * because a learner who dismissed the strip may want it again — Shift+F10 is how
	 * they ask, and that path clears the latch.
	 */
	let actedOnText: string | null = null;

	/** Roving-tabindex cursor. The control set is conditional, so this is clamped on use. */
	let activeControlIndex = $state(0);

	/** Where focus was before it entered the strip, for Escape and dismissal. */
	let focusReturnTarget: HTMLElement | null = null;

	/**
	 * One timer for the live region.
	 *
	 * Each announcement used to schedule its own clear, so two in quick succession
	 * left the first one's timer to blank the second mid-sentence.
	 */
	function announce(message: string, clearAfterMs: number): void {
		if (announcementTimer !== null) clearTimeout(announcementTimer);
		positionAnnouncement = message;
		announcementTimer = setTimeout(() => {
			positionAnnouncement = '';
			announcementTimer = null;
		}, clearAfterMs);
	}

	/**
	 * Actions to render for the selection currently showing.
	 *
	 * Availability is re-asked per selection rather than tracked: it follows policy,
	 * which does not move while a strip is open, and `isAvailable` is a plain function
	 * a composer supplies — nothing here can observe it changing.
	 */
	let availableActions = $derived.by((): ToolSelectionAction[] => {
		void toolbarState.isVisible;
		return usableSelectionActions(selectionActions);
	});

	// Derived state
	let hasAnnotations = $derived(annotationCount > 0);
	let hasOverlappingAnnotation = $derived(overlappingAnnotationId !== null);
	let effectiveScopeElement = $derived(
		regionScopeContext?.scopeElement || shellContext?.scopeElement || null
	);

	function getEffectiveRoot(): HTMLElement {
		const ownerDoc = contextHostElement?.ownerDocument;
		return effectiveScopeElement || ownerDoc?.documentElement || document.documentElement;
	}

	function getStorageKey(): string {
		const scopeKey = shellContext?.canonicalItemId || shellContext?.itemId || 'global';
		return `${STORAGE_KEY}:${scopeKey}`;
	}

	/**
	 * Find annotation that overlaps with the given range
	 */
	function findOverlappingAnnotation(range: Range): string | null {
		if (!highlightCoordinator) return null;

		const annotations = highlightCoordinator.getAnnotations();
		for (const annotation of annotations) {
			// Check if ranges overlap
			// Two ranges overlap if: startA < endB && startB < endA
			const cmp1 = range.compareBoundaryPoints(Range.START_TO_START, annotation.range);
			const cmp2 = range.compareBoundaryPoints(Range.END_TO_END, annotation.range);
			const cmp3 = range.compareBoundaryPoints(Range.START_TO_END, annotation.range);
			const cmp4 = range.compareBoundaryPoints(Range.END_TO_START, annotation.range);

			// Check various overlap conditions:
			// 1. Selection is inside annotation
			// 2. Annotation is inside selection
			// 3. Selection partially overlaps annotation
			if (
				(cmp1 >= 0 && cmp2 <= 0) || // selection inside annotation
				(cmp1 <= 0 && cmp2 >= 0) || // annotation inside selection
				(cmp3 > 0 && cmp4 < 0)      // partial overlap
			) {
				return annotation.id;
			}
		}
		return null;
	}

	/**
	 * Check if selection is in an allowed area
	 */
	function isInAllowedArea(node: Node): boolean {
		if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) {
			return false;
		}

		// For text nodes, check parent element
		const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
		if (!element) return false;

		// Check if element or any ancestor matches disallowed selectors
		return !DISALLOWED_SELECTORS.some((sel) => {
			try {
				return element.closest(sel) !== null;
			} catch {
				return false;
			}
		});
	}

	function isWithinScope(range: Range): boolean {
		if (!effectiveScopeElement) return true;
		const ancestor = range.commonAncestorContainer;
		const element =
			ancestor.nodeType === Node.TEXT_NODE
				? ancestor.parentElement
				: (ancestor as Element);
		return !!element && effectiveScopeElement.contains(element);
	}

	/**
	 * Save annotations to sessionStorage.
	 * Uses HighlightCoordinator's exportAnnotations for proper serialization.
	 */
	function saveAnnotations() {
		if (!isBrowser || !highlightCoordinator) return;

		try {
			const root = getEffectiveRoot();
			const serialized = highlightCoordinator.exportAnnotations(root);
			sessionStorage.setItem(getStorageKey(), JSON.stringify(serialized));
		} catch (error) {
			console.error('[AnnotationToolbar] Failed to save annotations:', error);
		}
	}

	/**
	 * Load annotations from sessionStorage.
	 * Uses HighlightCoordinator's importAnnotations for proper deserialization.
	 */
	function loadAnnotations() {
		if (!isBrowser || !highlightCoordinator) return;

		try {
			const json = sessionStorage.getItem(getStorageKey());
			if (!json) return;

			const data = JSON.parse(json);
			const root = getEffectiveRoot();
			const restored = highlightCoordinator.importAnnotations(data, root);

			console.log(`[AnnotationToolbar] Restored ${restored} annotations`);
			annotationCount = highlightCoordinator.getAnnotations().length;
		} catch (error) {
			console.error('[AnnotationToolbar] Failed to load annotations:', error);
		}
	}

	/**
	 * Coalesce a burst of `selectionchange` events into one evaluation.
	 *
	 * Extending a selection with Shift+Arrow fires one event per character, and a
	 * caret moving through a paragraph fires one per keypress; evaluating each would
	 * run `findOverlappingAnnotation` over every annotation that often.
	 */
	function scheduleSelectionEvaluation() {
		if (!isBrowser || selectionFrame !== null) return;
		const raf =
			typeof requestAnimationFrame === 'function'
				? requestAnimationFrame
				: (callback: () => void) => setTimeout(callback, 16) as unknown as number;
		selectionFrame = raf(() => {
			selectionFrame = null;
			evaluateSelection();
		}) as unknown as number;
	}

	/**
	 * Show the toolbar for the current selection, or hide it when there is none.
	 *
	 * Driven by `selectionchange` rather than `mouseup`/`touchend`. The pointer
	 * events could not see a selection made with Shift+Arrow, so highlight,
	 * underline and read-aloud were unreachable without a mouse — WCAG 2.2 SC 2.1.1.
	 * Selection is a keyboard operation in every browser, so the trigger has to be
	 * the selection itself.
	 */
	function evaluateSelection(options: { force?: boolean } = {}) {
		if (!enabled || !isBrowser) return;
		// Mid-gesture: `pointerup` will call back once the selection has settled.
		if (isPointerGestureActive(pointerDownAt, Date.now())) return;

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return hideToolbar();

		const range = sel.getRangeAt(0);
		const text = sel.toString().trim();

		// Hide if empty or in disallowed area
		if (!text || !isWithinScope(range) || !isInAllowedArea(range.commonAncestorContainer)) {
			return hideToolbar();
		}

		// A new selection is a new question, so the latch only spans the one it was set
		// for. `force` is the learner asking with Shift+F10, which overrides it outright.
		if (actedOnText !== null && (options.force || actedOnText !== text)) {
			actedOnText = null;
		}
		if (actedOnText === text) return;

		// Check if selection overlaps with an existing annotation
		overlappingAnnotationId = findOverlappingAnnotation(range);

		const alreadyVisible = toolbarState.isVisible;
		toolbarState.isVisible = true;
		toolbarState.selectedText = text;
		toolbarState.selectedRange = range.cloneRange();
		repositionToSelection(range);

		// Announce once per selection, not once per keystroke.
		if (announcedForText !== text) {
			announcedForText = text;
			const textPreview = text.length > 30 ? text.substring(0, 30) + '...' : text;
			announce(
				`Annotation toolbar available for "${textPreview}". Press Shift+F10 for annotation tools.`,
				4000
			);
		}

		if (!alreadyVisible) {
			// Set justShown flag to prevent immediate hiding
			justShown = true;
			setTimeout(() => {
				justShown = false;
			}, 100);
		}
	}

	/**
	 * Track the selection's viewport rect.
	 *
	 * Scrolling used to hide the toolbar outright, which a keyboard user hits
	 * constantly: extending a selection past the fold scrolls the page, so the strip
	 * disappeared on the keystroke that created the selection it was showing. It now
	 * follows the selection and only withdraws once that selection is off screen.
	 */
	function repositionToSelection(range: Range | null = toolbarState.selectedRange) {
		if (!range) return;
		const rect = range.getBoundingClientRect();
		const viewport = { width: window.innerWidth || 0, height: window.innerHeight || 0 };
		if (isRectOffScreen(rect, viewport)) {
			// Keep the selection; only the affordance goes away.
			toolbarState.isVisible = false;
			return;
		}
		toolbarState.isVisible = true;
		// The strip's own size is what keeps it inside the viewport, and it is only
		// knowable once rendered. Zeroes on the first pass place it centred above, and
		// the effect below re-runs this with a measurement.
		toolbarState.toolbarPosition = toolbarAnchor(
			rect,
			viewport,
			measureToolbar()
		);
	}

	/**
	 * The rendered strip's size, or zeroes before it exists.
	 *
	 * `offsetWidth`/`offsetHeight` rather than `getBoundingClientRect`: the strip is
	 * unscaled, these are cheaper, and a fractional rect would feed sub-pixel values
	 * into a clamp whose whole job is keeping an edge on screen.
	 */
	function measureToolbar(): { width: number; height: number } {
		if (!toolbarElement) return { width: 0, height: 0 };
		return {
			width: toolbarElement.offsetWidth,
			height: toolbarElement.offsetHeight
		};
	}

	function handleScroll() {
		if (!toolbarState.isVisible && !toolbarState.selectedRange) return;
		repositionToSelection();
	}

	function handlePointerDown() {
		pointerDownAt = Date.now();
	}

	function handlePointerUp() {
		pointerDownAt = null;
		scheduleSelectionEvaluation();
	}

	/**
	 * Dismiss after a completed action, latching so the surviving selection does not
	 * bring the strip straight back. See {@link actedOnText}.
	 */
	function finishAction() {
		actedOnText = toolbarState.selectedText || null;
		hideToolbar();
	}

	/**
	 * Hide toolbar and clean up TTS
	 */
	function hideToolbar() {
		if (ttsSpeaking && ttsService) {
			ttsService.stop();
			ttsSpeaking = false;
		}
		restoreFocus();
		toolbarState.isVisible = false;
		toolbarState.selectedText = '';
		toolbarState.selectedRange = null;
		announcedForText = null;
		activeControlIndex = 0;
	}

	/**
	 * Return focus to whatever had it before the strip took it.
	 *
	 * Only when the strip currently holds focus: dismissing on an outside click or a
	 * new selection must not yank focus back from wherever the learner just went,
	 * which would be a WCAG 2.2 SC 3.2.1 change of context they did not ask for.
	 */
	function restoreFocus() {
		const target = focusReturnTarget;
		focusReturnTarget = null;
		if (!target || !stripHasFocus()) return;
		if (typeof target.focus === 'function' && target.isConnected) {
			target.focus({ preventScroll: true });
		}
	}

	function stripHasFocus(): boolean {
		if (!toolbarElement || !isBrowser) return false;
		const root = toolbarElement.getRootNode() as Document | ShadowRoot;
		const active = (root as DocumentOrShadowRoot).activeElement;
		return !!active && toolbarElement.contains(active);
	}

	/** Enabled controls in DOM order. Read from the DOM because the set is conditional. */
	function toolbarControls(): HTMLElement[] {
		if (!toolbarElement) return [];
		return Array.from(
			toolbarElement.querySelectorAll<HTMLElement>('button:not([disabled])')
		);
	}

	/**
	 * Move focus into the strip, per the ARIA toolbar pattern's single tab stop.
	 *
	 * Reached with Shift+F10 or the Menu key — the platform convention for "act on
	 * the current selection" — because the strip is a floating layer mounted at
	 * section scope. Tabbing to it would mean traversing the remaining content
	 * first, and its DOM position bears no relation to where the selection is.
	 */
	function focusStrip() {
		const controls = toolbarControls();
		if (!controls.length) return;
		if (!stripHasFocus() && isBrowser) {
			const root = toolbarElement?.getRootNode() as DocumentOrShadowRoot | undefined;
			const active = root?.activeElement;
			focusReturnTarget = active instanceof HTMLElement ? active : null;
		}
		activeControlIndex = clampIndex(activeControlIndex, controls.length);
		controls[activeControlIndex]?.focus();
	}

	/**
	 * Add highlight annotation
	 */
	function handleHighlight(color: HighlightColor) {
		if (!toolbarState.selectedRange || !highlightCoordinator) return;
		const text = toolbarState.selectedText;
		highlightCoordinator.addAnnotation(toolbarState.selectedRange, color);
		annotationCount = highlightCoordinator.getAnnotations().length;
		saveAnnotations();

		// Announce to screen readers
		const colorName = color === HighlightColor.UNDERLINE ? 'underlined' : `highlighted in ${color}`;
		const textPreview = text.length > 30 ? text.substring(0, 30) + '...' : text;
		announce(`"${textPreview}" ${colorName}`, 3000);

		finishAction();
	}

	/**
	 * Remove the annotation that overlaps with current selection
	 */
	function handleRemoveAnnotation() {
		if (!overlappingAnnotationId || !highlightCoordinator) {
			console.warn('[AnnotationToolbar] No overlapping annotation to remove');
			return;
		}

		console.log('[AnnotationToolbar] Removing annotation:', overlappingAnnotationId);

		const annotation = highlightCoordinator.getAnnotation(overlappingAnnotationId);
		if (!annotation) {
			console.warn('[AnnotationToolbar] Annotation not found:', overlappingAnnotationId);
			return;
		}

		const text = annotation.range.toString();
		highlightCoordinator.removeAnnotation(overlappingAnnotationId);
		const newCount = highlightCoordinator.getAnnotations().length;
		annotationCount = newCount;
		console.log('[AnnotationToolbar] Annotations remaining:', newCount);
		saveAnnotations();

		// Announce to screen readers
		const textPreview = text.length > 30 ? text.substring(0, 30) + '...' : text;
		announce(`Removed annotation from "${textPreview}"`, 3000);

		finishAction();
	}

	/**
	 * Clear all annotations
	 */
	function handleClearAnnotations() {
		const count = annotationCount;
		highlightCoordinator?.clearAnnotations();
		annotationCount = 0;
		sessionStorage.removeItem(getStorageKey());

		// Announce to screen readers
		announce(`${count} annotation${count === 1 ? '' : 's'} cleared`, 3000);

		finishAction();
	}

	/**
	 * Hand the selection to a host-supplied action.
	 *
	 * The action runs before the strip goes away, so it still has a live range. The
	 * strip then dismisses like any other completed action — leaving it up over the
	 * panel the action just opened would obscure the answer and hold a tab stop the
	 * learner has finished with.
	 *
	 * `focusReturnTarget` is deliberately left in place: an action that opens a
	 * floating panel has its own focus management, and the restore lands first, so a
	 * panel that never opens still leaves focus back in the content rather than on
	 * `<body>`.
	 */
	/**
	 * Sanitized icon markup, or `''` when there is none to render.
	 *
	 * Sanitized even though a composer authored it: this is the one place the strip
	 * renders markup it did not write, and the sanitizer is also what turns an icon it
	 * cannot render into an empty string — which is the signal to fall back to the
	 * label, so a button is never blank to a sighted learner.
	 */
	function actionIconMarkup(action: ToolSelectionAction): string {
		return action.iconSvg ? sanitizeSvgIcon(action.iconSvg) : '';
	}

	function handleSelectionAction(action: ToolSelectionAction) {
		const text = toolbarState.selectedText;
		const range = toolbarState.selectedRange;
		try {
			action.run({ text, range });
		} catch (error) {
			console.error(
				`[AnnotationToolbar] Selection action "${action.id}" threw:`,
				error
			);
		}
		finishAction();
	}

	/**
	 * Read aloud with TTS
	 */
	async function handleTTSClick() {
		if (!toolbarState.selectedRange || !ttsService) return;

		ttsSpeaking = true;
		try {
			console.log('[AnnotationToolbar] Speaking range:', toolbarState.selectedRange.toString().substring(0, 50));

			// Use speakRange for accurate word highlighting
			// Note: TTS service should already be initialized by ToolkitCoordinator
			await ttsService.speakRange(toolbarState.selectedRange, {
				contentRoot: getEffectiveRoot()
			});

			console.log('[AnnotationToolbar] TTS completed successfully');
		} catch (error) {
			console.error('[AnnotationToolbar] TTS error:', error);
			alert(`TTS failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			ttsSpeaking = false;
		}
	}

	/**
	 * Handle keyboard shortcuts
	 */
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && toolbarState.isVisible) {
			e.preventDefault();
			hideToolbar();
			return;
		}
		if (!requestsSelectionToolbar(e)) return;
		// Evaluate first: the selection may exist without the strip having been shown
		// yet, and a keyboard user pressing the shortcut is asking for it either way.
		// `selectionchange` evaluation is coalesced into a frame, so the shortcut can
		// easily arrive before it has run — assistive technology that sets a selection
		// and immediately sends the shortcut hits this every time.
		// `force`: the learner is asking outright, which overrides a latch a completed
		// action left behind — otherwise acting on a selection would cost them the strip
		// for that selection entirely.
		if (!toolbarState.isVisible) evaluateSelection({ force: true });
		if (!toolbarState.isVisible) return;
		e.preventDefault();
		// After the render that the show above just scheduled: focusing in the same
		// tick finds no controls, because the strip has not been created yet.
		void tick().then(() => focusStrip());
	}

	/**
	 * ARIA toolbar navigation: arrows move between controls, Home/End jump, and the
	 * strip keeps one tab stop.
	 *
	 * Before this, every button was its own tab stop inside a `role="toolbar"`, so a
	 * screen-reader user was told "toolbar" and then found that the arrow keys the
	 * role advertises did nothing.
	 */
	function handleToolbarKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			hideToolbar();
			return;
		}
		const controls = toolbarControls();
		const next = nextControlIndex({
			key: e.key,
			activeIndex: activeControlIndex,
			count: controls.length,
			direction:
				isBrowser && toolbarElement && getComputedStyle(toolbarElement).direction === 'rtl'
					? 'rtl'
					: 'ltr'
		});
		if (next === null) return;

		e.preventDefault();
		activeControlIndex = next;
		controls[next]?.focus();
	}

	/** Dismiss once focus leaves the strip entirely, but not while it moves within it. */
	function handleToolbarFocusOut(e: FocusEvent) {
		const next = e.relatedTarget;
		if (next instanceof Node && toolbarElement?.contains(next)) return;
		// Focus has already left, so there is nothing to restore.
		focusReturnTarget = null;
		hideToolbar();
	}

	/**
	 * Handle click outside toolbar
	 */
	function handleDocumentClick(e: Event) {
		if (!toolbarState.isVisible || justShown) return;
		if (!toolbarElement) return;

		// `composedPath()` rather than `contains(e.target)`: the strip lives in this
		// component's shadow root, so a document-level listener sees the retargeted
		// host element and `contains` reports false for the strip's own buttons —
		// dismissing it on the very click that was activating one.
		const path = (typeof e.composedPath === 'function' ? e.composedPath() : []).filter(
			(node): node is EventTarget => !!node
		);
		if (path.includes(toolbarElement)) return;
		if (path.length === 0 && toolbarElement.contains(e.target as Node)) return;

		focusReturnTarget = null;
		hideToolbar();
	}

	// Effect for event listeners and initialization
	$effect(() => {
		if (!isBrowser) return;

		// Load persisted annotations after a delay to ensure content is rendered
		// PIE section player needs time to render items before we can restore ranges
		// Increased from 500ms to 2000ms to ensure all content is fully loaded
		const loadTimer = setTimeout(() => {
			loadAnnotations();
		}, 2000);

		const pointerEventTarget: HTMLElement | Document = effectiveScopeElement || document;
		pointerEventTarget.addEventListener('click', handleDocumentClick);
		pointerEventTarget.addEventListener('touchstart', handleDocumentClick);

		// The selection itself is the trigger, so the toolbar reaches a selection made
		// with the keyboard, a pointer, touch, or assistive technology alike. The
		// pointer pair only gates the show until a drag settles.
		document.addEventListener('selectionchange', scheduleSelectionEvaluation);
		pointerEventTarget.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('pointerup', handlePointerUp);
		document.addEventListener('pointercancel', handlePointerUp);

		// Keyboard and scroll events
		document.addEventListener('keydown', handleKeyDown);
		window.addEventListener('scroll', handleScroll, true);
		window.addEventListener('resize', handleScroll);

		return () => {
			clearTimeout(loadTimer);
			if (announcementTimer !== null) clearTimeout(announcementTimer);
			if (selectionFrame !== null && typeof cancelAnimationFrame === 'function') {
				cancelAnimationFrame(selectionFrame);
				selectionFrame = null;
			}

			pointerEventTarget.removeEventListener('click', handleDocumentClick);
			pointerEventTarget.removeEventListener('touchstart', handleDocumentClick);

			document.removeEventListener('selectionchange', scheduleSelectionEvaluation);
			pointerEventTarget.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('pointerup', handlePointerUp);
			document.removeEventListener('pointercancel', handlePointerUp);

			// Remove keyboard and scroll events
			document.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('scroll', handleScroll, true);
			window.removeEventListener('resize', handleScroll);
		};
	});

	/**
	 * Re-place the strip once its size is knowable, and again whenever that size
	 * changes.
	 *
	 * Placement needs a measurement and a measurement needs a render, so the first
	 * pass positions an unmeasured strip and this corrects it. The correction lands in
	 * the same frame, so there is no visible jump — and skipping it would leave the
	 * clamp inert exactly when it matters, since the first pass is the one that can put
	 * a control off screen.
	 *
	 * Tracks what changes the strip's width: the conditional controls, and the
	 * host-supplied actions. `toolbarPosition` is deliberately not read — writing what
	 * this effect reads would re-trigger it forever.
	 */
	$effect(() => {
		void toolbarState.isVisible;
		void toolbarElement;
		void availableActions;
		void hasOverlappingAnnotation;
		void hasAnnotations;
		void ttsService;
		untrack(() => {
			if (!toolbarState.isVisible || !toolbarElement) return;
			repositionToSelection();
		});
	});

	/**
	 * Apply the roving tabindex to whatever controls are currently rendered.
	 *
	 * Done here rather than as a `tabindex` binding per button because the control
	 * set is conditional — read-aloud only with a TTS service, remove only over an
	 * existing annotation — so a static index per button drifts out of step with the
	 * rendered order as soon as one of them is absent.
	 */
	$effect(() => {
		void toolbarState.isVisible;
		void activeControlIndex;
		void hasOverlappingAnnotation;
		void hasAnnotations;
		void ttsSpeaking;
		void availableActions;
		untrack(() => {
			const controls = toolbarControls();
			if (controls.length === 0) return;
			const active = clampIndex(activeControlIndex, controls.length);
			if (active !== activeControlIndex) activeControlIndex = active;
			controls.forEach((control, index) => {
				control.tabIndex = index === active ? 0 : -1;
			});
		});
	});

	$effect(() => {
		if (!contextHostElement) return;
		const cleanupShell = connectAssessmentToolkitShellContext(
			contextHostElement,
			(value: AssessmentToolkitShellContext) => {
				shellContext = value;
			}
		);
		const cleanupRegion = connectAssessmentToolkitRegionScopeContext(
			contextHostElement,
			(value: AssessmentToolkitRegionScopeContext) => {
				regionScopeContext = value;
			}
		);
		const cleanupRuntime = connectToolRuntimeContext(
			contextHostElement,
			(value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			}
		);
		return () => {
			cleanupRuntime();
			cleanupRegion();
			cleanupShell();
		};
	});
</script>

<div bind:this={contextHostElement} style="display: none;" aria-hidden="true"></div>

{#if toolbarState.isVisible}
	<div
		bind:this={toolbarElement}
		class="pie-tool-annotation-toolbar notranslate"
		data-pie-placement={toolbarState.toolbarPosition.below ? 'below' : 'above'}
		style={`left:${toolbarState.toolbarPosition.x}px; top:${toolbarState.toolbarPosition.y}px;`}
		role="toolbar"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.annotationToolbar.toolbarA11y')}
		translate="no"
		tabindex="-1"
		onkeydown={handleToolbarKeyDown}
		onfocusout={handleToolbarFocusOut}
	>
		<!-- Highlight Color Swatches -->
		{#each HIGHLIGHT_COLORS as color}
			<button
				class="pie-tool-annotation-toolbar__highlight-swatch"
				style="background-color: {color.hex};"
				onclick={() => handleHighlight(color.name)}
				aria-label={color.label}
				title={color.label}
			>
				<span class="pie-sr-only">{color.label}</span>
			</button>
		{/each}

		<!-- Underline Button -->
		<button
			class="pie-tool-annotation-toolbar__button pie-tool-annotation-toolbar__button--icon"
			onclick={() => handleHighlight(HighlightColor.UNDERLINE)}
			aria-label={interfaceI18n.t('tools.annotationToolbar.underlineA11y')}
			title={interfaceI18n.t('tools.annotationToolbar.underline')}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M5,21H19V19H5V21M12,17A6,6 0 0,0 18,11V3H15.5V11A3.5,3.5 0 0,1 12,14.5A3.5,3.5 0 0,1 8.5,11V3H6V11A6,6 0 0,0 12,17Z"
				/>
			</svg>
		</button>

		<!-- Text-to-Speech (only if ttsService available) -->
		{#if ttsService}
			<div class="divider divider-horizontal mx-0 w-px"></div>
			<button
				class="pie-tool-annotation-toolbar__button pie-tool-annotation-toolbar__button--icon"
				onclick={handleTTSClick}
				disabled={ttsSpeaking}
				aria-label={interfaceI18n.t('tools.annotationToolbar.readAloudA11y')}
				title={interfaceI18n.t('tools.annotationToolbar.readAloud')}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
					/>
				</svg>
			</button>
		{/if}

		<!-- Host-supplied actions on this selection. Ordinary buttons, so the roving
		     tabindex and the arrow-key navigation above pick them up with no special
		     case: the control set is read from the DOM. -->
		{#if availableActions.length > 0}
			<div class="divider divider-horizontal mx-0 w-px"></div>
			{#each availableActions as action (action.id)}
				{@const iconMarkup = actionIconMarkup(action)}
				<button
					class="pie-tool-annotation-toolbar__button"
					class:pie-tool-annotation-toolbar__button--icon={!!iconMarkup}
					data-pie-selection-action={action.id}
					onclick={() => handleSelectionAction(action)}
					aria-label={action.label}
					title={action.tooltip || action.label}
				>
					{#if iconMarkup}
						<span class="pie-tool-annotation-toolbar__action-icon" aria-hidden="true">
							{@html iconMarkup}
						</span>
					{:else}
						{action.label}
					{/if}
				</button>
			{/each}
		{/if}

		<!-- Divider before Remove/Clear -->
		{#if hasOverlappingAnnotation || hasAnnotations}
			<div class="divider divider-horizontal mx-0 w-px"></div>

			<!-- Remove This Annotation -->
			{#if hasOverlappingAnnotation}
				<button
					class="pie-tool-annotation-toolbar__button pie-tool-annotation-toolbar__button--warning"
					onclick={handleRemoveAnnotation}
					aria-label={interfaceI18n.t('tools.annotationToolbar.removeA11y')}
					title={interfaceI18n.t('tools.annotationToolbar.remove')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						width="18"
						height="18"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
						/>
					</svg>
				</button>
			{/if}

			<!-- Clear All Annotations -->
			{#if hasAnnotations}
				<button
					class="pie-tool-annotation-toolbar__button pie-tool-annotation-toolbar__button--danger"
					onclick={handleClearAnnotations}
					aria-label={interfaceI18n.t('tools.annotationToolbar.clearAllA11y')}
					title={interfaceI18n.t('tools.annotationToolbar.clearAll')}
				>
					{interfaceI18n.t('tools.annotationToolbar.clearAll')}
				</button>
			{/if}
		{/if}
	</div>
{/if}

<!-- Screen reader announcements -->
<div role="status" aria-live="polite" aria-atomic="true" class="pie-sr-only">
	{positionAnnouncement}
</div>

<style>
	.pie-tool-annotation-toolbar {
		position: fixed;
		z-index: 4200;
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
		/* WCAG 2.2 SC 1.4.11: this stroke is the only boundary between a floating
		   toolbar and the content behind it, so it has to clear 3:1 against both.
		   It cannot come from --pie-border, because the DaisyUI bridge maps that
		   token to --color-base-300 -- a surface tint rather than a boundary
		   colour: #eeeeee at 1.16:1 on the light base, #15191e at 1.12:1 on the
		   dark one.

		   A boundary on a light surface has to be dark and one on a dark surface
		   has to be light, so the light-dark() arms below are the dark grey first
		   and the light grey second. Both are measured against the surfaces the
		   toolbar is actually drawn on rather than against pure white and pure
		   black: real theme bases are off-white and off-black, and a grey chosen
		   at the edge of passing against an extreme drops under threshold on
		   everything else. Across DaisyUI's 21 light and 14 dark themes plus the
		   PIE light and dark palettes, every light surface needs a grey no
		   lighter than #828282 and every dark surface one no darker than
		   #878787 -- disjoint ranges, which is why one value cannot serve both
		   and light-dark() is the mechanism. #5c5c5c holds 5.22:1 as the worst
		   case on the light surfaces, #949494 holds 3.56:1 on the dark ones.

		   light-dark() keys off the declared color-scheme, so every dark DaisyUI
		   theme takes the dark value, not only the one named "dark". Palettes
		   that pick their own boundary colour -- the data-color-scheme
		   accessibility schemes -- set the token themselves in
		   @pie-players/pie-theme, which is why this is a token and not a literal;
		   several of their backgrounds are mid-tone and defeat both greys. */
		border: 1px solid
			var(--pie-tool-annotation-toolbar-border, light-dark(#5c5c5c, #949494));
		box-shadow: 0 10px 25px -8px rgb(0 0 0 / 0.3);
		user-select: none;
	}

	.pie-tool-annotation-toolbar__highlight-swatch {
		width: 2.5rem;
		height: 2rem;
		border: 2px solid color-mix(in srgb, var(--pie-border-dark, #111827) 20%, transparent);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.pie-tool-annotation-toolbar__highlight-swatch:hover {
		transform: scale(1.1);
		border-color: color-mix(in srgb, var(--pie-border-dark, #111827) 45%, transparent);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
	}

	.pie-tool-annotation-toolbar__highlight-swatch:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, var(--pie-primary, #3f51b5));
		outline-offset: 2px;
	}

	.pie-tool-annotation-toolbar .divider-horizontal {
		height: auto;
		width: 1px;
		background-color: color-mix(in srgb, var(--pie-border, #d1d5db) 70%, transparent);
	}

	/* Screen reader only content */
	.pie-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Button styling */
	.pie-tool-annotation-toolbar__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--pie-button-border, #d1d5db);
		border-radius: 0.4rem;
		background: var(--pie-button-bg, #fff);
		color: var(--pie-button-color, var(--pie-text, #111827));
		cursor: pointer;
	}

	.pie-tool-annotation-toolbar__button--icon {
		min-width: 2rem;
		min-height: 2rem;
		padding: 0.45rem;
	}

	.pie-tool-annotation-toolbar__button:hover {
		background: var(--pie-button-hover-bg, #f9fafb);
		color: var(--pie-button-hover-color, var(--pie-text, #111827));
		border-color: var(--pie-button-hover-border, #9ca3af);
	}

	.pie-tool-annotation-toolbar__button:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, var(--pie-primary, #3f51b5));
		outline-offset: 2px;
	}

	.pie-tool-annotation-toolbar__button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.pie-tool-annotation-toolbar__button--warning {
		color: var(--pie-missing-icon, #92400e);
	}

	.pie-tool-annotation-toolbar__button--danger {
		color: var(--pie-incorrect-icon, #b91c1c);
	}

	.pie-tool-annotation-toolbar__button svg {
		width: 18px;
		height: 18px;
	}

	/* Composer-supplied icons carry their own viewBox but rarely their own size, so
	   the box is set here to keep an action button the same height as the built-in
	   ones — a strip of mismatched buttons reads as broken. */
	.pie-tool-annotation-toolbar__action-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
	}

	.pie-tool-annotation-toolbar__action-icon :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
