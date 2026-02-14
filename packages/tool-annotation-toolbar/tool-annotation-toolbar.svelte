<svelte:options
	customElement={{
		tag: 'pie-tool-annotation-toolbar',
		shadow: 'none',
		props: {
			enabled: { type: 'Boolean', attribute: 'enabled' },
			highlightCoordinator: { type: 'Object', attribute: 'highlight-coordinator' }
		}
	}}
/>

<script lang="ts">
	import type { HighlightCoordinator, ITTSService } from '@pie-players/pie-assessment-toolkit';
	import { BrowserTTSProvider, HighlightColor } from '@pie-players/pie-assessment-toolkit';

	interface Props {
		enabled?: boolean;
		highlightCoordinator?: HighlightCoordinator | null;
		ttsService: ITTSService;
		ondictionarylookup?: (detail: { text: string }) => void;
		ontranslationrequest?: (detail: { text: string }) => void;
		onpicturedictionarylookup?: (detail: { text: string }) => void;
	}

	let {
		enabled = true,
		highlightCoordinator = null,
		ttsService,
		ondictionarylookup,
		ontranslationrequest,
		onpicturedictionarylookup
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
		'.annotation-toolbar',
		'.tool-toolbar',
		'[role="button"]',
		'[role="textbox"]'
	];

	// State - using Svelte 5 $state rune for reactive state
	let toolbarState = $state({
		isVisible: false,
		selectedText: '',
		selectedRange: null as Range | null,
		toolbarPosition: { x: 0, y: 0 }
	});

	// TTS state
	let ttsInitialized = $state(false);
	let ttsSpeaking = $state(false);

	// UX state
	let justShown = $state(false); // Flag to prevent immediate hiding after showing
	let positionAnnouncement = $state(''); // For screen readers when toolbar is repositioned

	// Derived state
	let hasAnnotations = $derived(highlightCoordinator ? highlightCoordinator.getAnnotations().length > 0 : false);

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

	/**
	 * Save annotations to sessionStorage.
	 * Uses HighlightCoordinator's exportAnnotations for proper serialization.
	 */
	function saveAnnotations() {
		if (!isBrowser || !highlightCoordinator) return;

		try {
			const root = document.body;
			const serialized = highlightCoordinator.exportAnnotations(root);
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
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
			const json = sessionStorage.getItem(STORAGE_KEY);
			if (!json) return;

			const data = JSON.parse(json);
			const root = document.body;
			const restored = highlightCoordinator.importAnnotations(data, root);

			console.log(`[AnnotationToolbar] Restored ${restored} annotations`);
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
		if (!text || !isInAllowedArea(range.commonAncestorContainer)) {
			return hideToolbar();
		}

		// Calculate position
		const rect = range.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top - 8;

		toolbarState.isVisible = true;
		toolbarState.selectedText = text;
		toolbarState.selectedRange = range.cloneRange();
		toolbarState.toolbarPosition = { x, y };

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
		if (ttsSpeaking) {
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
		highlightCoordinator.addAnnotation(toolbarState.selectedRange, color);
		saveAnnotations();
		hideToolbar();
	}

	/**
	 * Clear all annotations
	 */
	function handleClearAnnotations() {
		highlightCoordinator?.clearAnnotations();
		sessionStorage.removeItem(STORAGE_KEY);
		hideToolbar();
	}

	/**
	 * Dictionary lookup
	 */
	function handleDictionaryClick() {
		if (!toolbarState.selectedText) return;
		ondictionarylookup?.({ text: toolbarState.selectedText });
		hideToolbar();
	}

	/**
	 * Translation request
	 */
	function handleTranslationClick() {
		if (!toolbarState.selectedText) return;
		ontranslationrequest?.({ text: toolbarState.selectedText });
		hideToolbar();
	}

	/**
	 * Picture dictionary lookup
	 */
	function handlePictureDictionaryClick() {
		if (!toolbarState.selectedText) return;
		onpicturedictionarylookup?.({ text: toolbarState.selectedText });
		hideToolbar();
	}

	/**
	 * Read aloud with TTS
	 */
	async function handleTTSClick() {
		if (!toolbarState.selectedRange) return;

		ttsSpeaking = true;
		try {
			if (!ttsInitialized) {
				await ensureTts();
				ttsInitialized = true;
			}

			// Use speakRange for accurate word highlighting
			await ttsService.speakRange(toolbarState.selectedRange);
		} catch (error) {
			console.error('[AnnotationToolbar] TTS error:', error);
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
	function handleDocumentClick(e: MouseEvent) {
		if (!toolbarState.isVisible || justShown) return;

		const toolbar = document.querySelector('.annotation-toolbar');
		if (toolbar && !toolbar.contains(e.target as Node)) {
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

		// Set up event listeners
		document.addEventListener('mouseup', handleSelectionChange);
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('click', handleDocumentClick);
		window.addEventListener('scroll', hideToolbar, true);

		return () => {
			clearTimeout(loadTimer);
			document.removeEventListener('mouseup', handleSelectionChange);
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('click', handleDocumentClick);
			window.removeEventListener('scroll', hideToolbar, true);
		};
	});
</script>

{#if toolbarState.isVisible}
	<div
		class="annotation-toolbar fixed z-[4200] flex gap-1 bg-base-100 shadow-lg rounded-lg p-2 border border-base-300"
		style={`left:${toolbarState.toolbarPosition.x}px; top:${toolbarState.toolbarPosition.y}px; transform: translate(-50%, -100%);`}
		role="toolbar"
		aria-label="Text annotation toolbar"
	>
		<!-- Highlight Color Swatches -->
		{#each HIGHLIGHT_COLORS as color}
			<button
				class="highlight-swatch"
				style="background-color: {color.hex};"
				onclick={() => handleHighlight(color.name)}
				aria-label={color.label}
				title={color.label}
			>
				<span class="sr-only">{color.label}</span>
			</button>
		{/each}

		<!-- Divider -->
		<div class="divider divider-horizontal mx-0 w-px"></div>

		<!-- Text-to-Speech -->
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

		<!-- Dictionary -->
		{#if ondictionarylookup}
			<button
				class="btn btn-sm btn-square"
				onclick={handleDictionaryClick}
				aria-label="Look up selected text in dictionary"
				title="Dictionary"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M18,22A2,2 0 0,0 20,20V4C20,2.89 19.1,2 18,2H12V9L9.5,7.5L7,9V2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18Z" />
				</svg>
			</button>
		{/if}

		<!-- Picture Dictionary -->
		{#if onpicturedictionarylookup}
			<button
				class="btn btn-sm btn-square"
				onclick={handlePictureDictionaryClick}
				aria-label="Look up selected text in picture dictionary"
				title="Picture Dictionary"
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
						d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"
					/>
				</svg>
			</button>
		{/if}

		<!-- Translation -->
		{#if ontranslationrequest}
			<button
				class="btn btn-sm btn-square"
				onclick={handleTranslationClick}
				aria-label="Translate selected text"
				title="Translation"
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
						d="M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z"
					/>
				</svg>
			</button>
		{/if}

		<!-- Divider before Clear -->
		{#if hasAnnotations}
			<div class="divider divider-horizontal mx-0 w-px"></div>

			<!-- Clear All Annotations -->
			<button
				class="btn btn-sm btn-ghost text-error"
				onclick={handleClearAnnotations}
				aria-label="Clear all annotations from document"
				title="Clear All"
			>
				Clear
			</button>
		{/if}
	</div>
{/if}

<!-- Screen reader announcements -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
	{positionAnnouncement}
</div>

<style>
	.annotation-toolbar {
		user-select: none;
	}

	.highlight-swatch {
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

	.highlight-swatch:hover {
		transform: scale(1.1);
		border-color: rgba(0, 0, 0, 0.4);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.highlight-swatch:focus-visible {
		outline: 2px solid hsl(var(--p));
		outline-offset: 2px;
	}

	.divider-horizontal {
		height: auto;
		background-color: hsl(var(--bc) / 0.2);
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
		border-width: 0;
	}

	/* Button styling */
	.btn-square {
		padding: 0.5rem;
	}

	.btn-square svg {
		width: 18px;
		height: 18px;
	}
</style>
