<svelte:options
	customElement={{
		tag: 'pie-tool-annotation-toolbar',
		shadow: 'open',
		props: {
			enabled: { type: 'Boolean', attribute: 'enabled' },
			highlightCoordinator: { type: 'Object' },
			ttsService: { type: 'Object' }
		}
	}}
/>

<svelte:head>
	<link rel="stylesheet" href="./highlights.css">
</svelte:head>

<script lang="ts">
	import type {
		AssessmentToolkitRegionScopeContext,
		AssessmentToolkitShellContext,
		HighlightCoordinator,
		ITTSService
	} from '@pie-players/pie-assessment-toolkit';
	import {
		connectAssessmentToolkitRegionScopeContext,
		connectAssessmentToolkitShellContext,
		HighlightColor
	} from '@pie-players/pie-assessment-toolkit';

	interface Props {
		enabled?: boolean;
		highlightCoordinator?: HighlightCoordinator | null;
		ttsService?: ITTSService | null;
	}

	let {
		enabled = true,
		highlightCoordinator = null,
		ttsService = null
	}: Props = $props();

	const isBrowser = typeof window !== 'undefined';

	// Storage key for sessionStorage
	const STORAGE_KEY = 'pie-annotations';

	// Available highlight colors (modern, accessible palette)
	const HIGHLIGHT_COLORS = [
		{ name: HighlightColor.YELLOW, hex: '#fde995', label: 'Yellow highlight' },
		{ name: HighlightColor.PINK, hex: '#ff9fae', label: 'Pink highlight' },
		{ name: HighlightColor.BLUE, hex: '#a7e0f6', label: 'Blue highlight' },
		{ name: HighlightColor.GREEN, hex: '#a6e1c5', label: 'Green highlight' }
	] as const;

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
	let toolbarElement = $state<HTMLElement | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let regionScopeContext = $state<AssessmentToolkitRegionScopeContext | null>(null);
	let toolbarState = $state({
		isVisible: false,
		selectedText: '',
		selectedRange: null as Range | null,
		toolbarPosition: { x: 0, y: 0 }
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
	 * Handle selection change - show toolbar if valid selection
	 */
	function handleSelectionChange() {
		if (!enabled || !isBrowser) return;

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return hideToolbar();

		const range = sel.getRangeAt(0);
		const text = sel.toString().trim();

		// Hide if empty or in disallowed area
		if (!text || !isWithinScope(range) || !isInAllowedArea(range.commonAncestorContainer)) {
			return hideToolbar();
		}

		// Calculate position
		const rect = range.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top - 8;

		// Check if selection overlaps with an existing annotation
		overlappingAnnotationId = findOverlappingAnnotation(range);

		toolbarState.isVisible = true;
		toolbarState.selectedText = text;
		toolbarState.selectedRange = range.cloneRange();
		toolbarState.toolbarPosition = { x, y };

		// Announce to screen readers
		const textPreview = text.length > 30 ? text.substring(0, 30) + '...' : text;
		positionAnnouncement = `Annotation toolbar opened for "${textPreview}"`;
		setTimeout(() => { positionAnnouncement = ''; }, 2000);

		// Set justShown flag to prevent immediate hiding
		justShown = true;
		setTimeout(() => {
			justShown = false;
		}, 100);
	}

	/**
	 * Hide toolbar and clean up TTS
	 */
	function hideToolbar() {
		if (ttsSpeaking && ttsService) {
			ttsService.stop();
			ttsSpeaking = false;
		}
		toolbarState.isVisible = false;
		toolbarState.selectedText = '';
		toolbarState.selectedRange = null;
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
		positionAnnouncement = `"${textPreview}" ${colorName}`;
		setTimeout(() => { positionAnnouncement = ''; }, 3000);

		hideToolbar();
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
		positionAnnouncement = `Removed annotation from "${textPreview}"`;
		setTimeout(() => { positionAnnouncement = ''; }, 3000);

		hideToolbar();
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
		positionAnnouncement = `${count} annotation${count === 1 ? '' : 's'} cleared`;
		setTimeout(() => { positionAnnouncement = ''; }, 3000);

		hideToolbar();
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
		}
	}

	/**
	 * Handle click outside toolbar
	 */
	function handleDocumentClick(e: Event) {
		if (!toolbarState.isVisible || justShown) return;

		if (toolbarElement && !toolbarElement.contains(e.target as Node)) {
			hideToolbar();
		}
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
		pointerEventTarget.addEventListener('mouseup', handleSelectionChange);
		pointerEventTarget.addEventListener('click', handleDocumentClick);
		pointerEventTarget.addEventListener('touchend', handleSelectionChange);
		pointerEventTarget.addEventListener('touchstart', handleDocumentClick);

		// Keyboard and scroll events
		document.addEventListener('keydown', handleKeyDown);
		window.addEventListener('scroll', hideToolbar, true);

		return () => {
			clearTimeout(loadTimer);

			pointerEventTarget.removeEventListener('mouseup', handleSelectionChange);
			pointerEventTarget.removeEventListener('click', handleDocumentClick);
			pointerEventTarget.removeEventListener('touchend', handleSelectionChange);
			pointerEventTarget.removeEventListener('touchstart', handleDocumentClick);

			// Remove keyboard and scroll events
			document.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('scroll', hideToolbar, true);
		};
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
		return () => {
			cleanupRegion();
			cleanupShell();
		};
	});
</script>

<div bind:this={contextHostElement} style="display: none;" aria-hidden="true"></div>

{#if toolbarState.isVisible}
	<div
		bind:this={toolbarElement}
		class="pie-tool-annotation-toolbar notranslate fixed z-[4200] flex gap-1 bg-base-100 shadow-lg rounded-lg p-2 border border-base-300"
		style={`left:${toolbarState.toolbarPosition.x}px; top:${toolbarState.toolbarPosition.y}px; transform: translate(-50%, -100%);`}
		role="toolbar"
		aria-label="Text annotation toolbar"
		translate="no"
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
			class="btn btn-sm btn-square"
			onclick={() => handleHighlight(HighlightColor.UNDERLINE)}
			aria-label="Underline selected text"
			title="Underline"
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
				class="btn btn-sm btn-square"
				onclick={handleTTSClick}
				disabled={ttsSpeaking}
				aria-label="Read selected text aloud"
				title="Read Aloud"
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

		<!-- Divider before Remove/Clear -->
		{#if hasOverlappingAnnotation || hasAnnotations}
			<div class="divider divider-horizontal mx-0 w-px"></div>

			<!-- Remove This Annotation -->
			{#if hasOverlappingAnnotation}
				<button
					class="btn btn-sm btn-ghost text-warning"
					onclick={handleRemoveAnnotation}
					aria-label="Remove this annotation"
					title="Remove"
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
					class="btn btn-sm btn-ghost text-error"
					onclick={handleClearAnnotations}
					aria-label="Clear all annotations from document"
					title="Clear All"
				>
					Clear All
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
		user-select: none;
	}

	.pie-tool-annotation-toolbar__highlight-swatch {
		width: 2.5rem;
		height: 2rem;
		border: 2px solid rgba(0, 0, 0, 0.2);
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
		border-color: rgba(0, 0, 0, 0.4);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.pie-tool-annotation-toolbar__highlight-swatch:focus-visible {
		outline: 2px solid hsl(var(--p));
		outline-offset: 2px;
	}

	.pie-tool-annotation-toolbar .divider-horizontal {
		height: auto;
		background-color: hsl(var(--bc) / 0.2);
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
	.pie-tool-annotation-toolbar .btn-square {
		padding: 0.5rem;
	}

	.pie-tool-annotation-toolbar .btn-square svg {
		width: 18px;
		height: 18px;
	}
</style>
