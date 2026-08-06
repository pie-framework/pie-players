<svelte:options
	customElement={{
		tag: 'pie-tool-line-reader',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">
	
	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
import { onMount } from 'svelte';

	// Props
	let { visible = false, toolId = 'lineReader' }: { visible?: boolean; toolId?: string } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	/** Which dimension an in-flight pointer resize is changing. */
	type ResizeTarget = 'pane' | 'frame';

	let isDragging = $state(false);
	let resizeTarget = $state<ResizeTarget | null>(null);
	let position = $state({
		x: isBrowser ? window.innerWidth / 2 : 400,
		y: isBrowser ? window.innerHeight / 2 : 300
	});
	let width = $state(600);
	/** Height of the fully transparent reading window. */
	let paneHeight = $state(24);
	/** Height of the obscuring frame band above and below the reading window. */
	let frameBandHeight = $state(48);
	let dragStart = $state({ x: 0, y: 0 });
	let resizeStart = $state({
		paneHeight: 0,
		frameBandHeight: 0,
		width: 0,
		mouseX: 0,
		mouseY: 0
	});
	let announceText = $state('');

	// Track registration state
	let registered = $state(false);

	// Geometry constants
	const FRAME_SIDE_WIDTH = 12; // pixels of obscuring frame left and right of the pane
	const MIN_PANE_HEIGHT = 12; // pixels
	const MAX_PANE_HEIGHT = 200; // pixels
	// The frame bands host the close and resize controls, so they cannot shrink
	// below a comfortable target size for those buttons.
	const MIN_FRAME_BAND_HEIGHT = 32; // pixels
	const MAX_FRAME_BAND_HEIGHT = 240; // pixels
	const MIN_WIDTH = 200; // pixels
	const MAX_WIDTH = 2000; // pixels

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const RESIZE_STEP = 10; // pixels
	const WIDTH_STEP = 20; // pixels

	const totalHeight = $derived(paneHeight + frameBandHeight * 2);

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	function clampPaneHeight(value: number) {
		return Math.max(MIN_PANE_HEIGHT, Math.min(MAX_PANE_HEIGHT, value));
	}

	function clampFrameBandHeight(value: number) {
		return Math.max(MIN_FRAME_BAND_HEIGHT, Math.min(MAX_FRAME_BAND_HEIGHT, value));
	}

	function clampWidth(value: number) {
		return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
	}

	function resizePane(delta: number) {
		paneHeight = clampPaneHeight(paneHeight + delta);
		announce(`Reading window height ${paneHeight} pixels`);
	}

	function resizeFrameBand(delta: number) {
		frameBandHeight = clampFrameBandHeight(frameBandHeight + delta);
		announce(`Frame height ${frameBandHeight} pixels`);
	}

	function resizeWidth(delta: number) {
		width = clampWidth(width + delta);
		announce(`Width ${width} pixels`);
	}

	function closeTool() {
		if (coordinator && toolId) {
			coordinator.hideTool(toolId);
		}
	}

	// Pointer event handlers (better for web components)
	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		const resizeHandle = target.closest<HTMLElement>(
			'.pie-tool-line-reader__resize-handle',
		);
		if (resizeHandle) {
			startResizing(
				e,
				resizeHandle.classList.contains('pie-tool-line-reader__resize-handle--frame')
					? 'frame'
					: 'pane',
				resizeHandle,
			);
			return;
		}

		// Let other controls (close) handle their own activation instead of
		// swallowing the press into a drag.
		if (target.closest('button')) return;

		startDragging(e);
	}

	function startDragging(e: PointerEvent) {
		if (!containerEl) return;

		// Capture pointer for isolated event handling
		containerEl.setPointerCapture(e.pointerId);

		// `preventDefault` below suppresses the press's default focus, so claim it
		// explicitly: without this, clicking the frame leaves focus wherever it was
		// and the arrow-key move shortcuts never reach the tool.
		containerEl.focus({ preventScroll: true });

		isDragging = true;
		dragStart = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};

		coordinator?.bringToFront(containerEl);

		// Add pointer move/up handlers to element (not window!)
		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
	}

	function startResizing(e: PointerEvent, target: ResizeTarget, handle: HTMLElement) {
		if (!containerEl) return;

		// Capture pointer for isolated event handling
		containerEl.setPointerCapture(e.pointerId);

		// `preventDefault` below suppresses the press's default focus, so move focus
		// explicitly: the arrow-key resize alternative acts on the focused handle,
		// and it should be the one just dragged.
		handle.focus({ preventScroll: true });

		resizeTarget = target;
		resizeStart = {
			paneHeight,
			frameBandHeight,
			width,
			mouseX: e.clientX,
			mouseY: e.clientY
		};

		coordinator?.bringToFront(containerEl);

		// Add pointer move/up handlers to element (not window!)
		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
		e.stopPropagation();
	}

	function handlePointerMove(e: PointerEvent) {
		if (isDragging) {
			position = {
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			};
			return;
		}

		if (!resizeTarget) return;

		// The window grows symmetrically around its centre, so the edge under the
		// pointer only moves half as far as the dimension it drives: the pane and
		// the width both take double the pointer delta to track it, while the frame
		// band already moves the bottom edge 1:1 because it grows at both ends.
		const deltaY = e.clientY - resizeStart.mouseY;
		if (resizeTarget === 'pane') {
			// Vertical resize of the reading window only
			paneHeight = clampPaneHeight(resizeStart.paneHeight + deltaY * 2);
			return;
		}

		// The frame handle sits in the bottom-right corner: down grows the frame
		// bands, right widens the whole window.
		frameBandHeight = clampFrameBandHeight(resizeStart.frameBandHeight + deltaY);
		width = clampWidth(resizeStart.width + (e.clientX - resizeStart.mouseX) * 2);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!containerEl) return;

		// Release pointer capture
		containerEl.releasePointerCapture(e.pointerId);

		// Clean up event listeners
		containerEl.removeEventListener('pointermove', handlePointerMove);
		containerEl.removeEventListener('pointerup', handlePointerUp);

		isDragging = false;
		resizeTarget = null;
	}

	function handleKeyDown(e: KeyboardEvent) {
		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				position.y -= MOVE_STEP;
				announce(`Moved up to ${Math.round(position.y)}`);
				handled = true;
				break;
			case 'ArrowDown':
				position.y += MOVE_STEP;
				announce(`Moved down to ${Math.round(position.y)}`);
				handled = true;
				break;
			case 'ArrowLeft':
				position.x -= MOVE_STEP;
				announce(`Moved left to ${Math.round(position.x)}`);
				handled = true;
				break;
			case 'ArrowRight':
				position.x += MOVE_STEP;
				announce(`Moved right to ${Math.round(position.x)}`);
				handled = true;
				break;
			case '+':
			case '=':
				resizePane(RESIZE_STEP);
				handled = true;
				break;
			case '-':
			case '_':
				resizePane(-RESIZE_STEP);
				handled = true;
				break;
			case 'Escape':
				closeTool();
				handled = true;
				break;
		}

		if (handled) {
			e.preventDefault();
		}
	}

	/**
	 * Keyboard alternative to dragging the reading-window handle (WCAG 2.5.7):
	 * arrow keys resize while the handle itself has focus. Handled keys are
	 * stopped so they do not also reach the container's move shortcuts.
	 */
	function handlePaneResizeKeyDown(e: KeyboardEvent) {
		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				resizePane(-RESIZE_STEP);
				handled = true;
				break;
			case 'ArrowDown':
				resizePane(RESIZE_STEP);
				handled = true;
				break;
		}

		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	/**
	 * Keyboard alternative to dragging the frame handle: vertical arrows resize
	 * the obscuring bands, horizontal arrows resize the window width.
	 */
	function handleFrameResizeKeyDown(e: KeyboardEvent) {
		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				resizeFrameBand(-RESIZE_STEP);
				handled = true;
				break;
			case 'ArrowDown':
				resizeFrameBand(RESIZE_STEP);
				handled = true;
				break;
			case 'ArrowLeft':
				resizeWidth(-WIDTH_STEP);
				handled = true;
				break;
			case 'ArrowRight':
				resizeWidth(WIDTH_STEP);
				handled = true;
				break;
		}

		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Line Reader', undefined, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	onMount(() => {
		return () => {
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

	// Auto-focus when tool becomes visible
	$effect(() => {
		if (visible && containerEl) {
			setTimeout(() => containerEl?.focus(), 100);
		}
	});
</script>

{#if visible}
	<!-- Screen reader announcements -->
	<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="pie-tool-line-reader"
		style="left: {position.x}px; top: {position.y}px; width: {width}px; height: {totalHeight}px; --pie-tool-line-reader-band-height: {frameBandHeight}px; --pie-tool-line-reader-side-width: {FRAME_SIDE_WIDTH}px;"
		onpointerdown={handlePointerDown}
		onkeydown={handleKeyDown}
		role="group"
		tabindex="0"
		aria-label="Line Reader tool. A clear reading window inside an obscuring frame. Use arrow keys to move, +/- to resize the reading window, Escape to close. Reading window height: {paneHeight} pixels, Frame height: {frameBandHeight} pixels"
		aria-roledescription="Draggable and resizable reading guide overlay"
	>
		<!--
			The obscuring frame, drawn as one element's border box so the bands and
			edges cannot seam against each other. Its content box is the fully
			transparent reading window, through which page content stays visible.
		-->
		<div class="pie-tool-line-reader__frame" aria-hidden="true"></div>

		<!-- Boundary hairline over the whole frame -->
		<div class="pie-tool-line-reader__outline" aria-hidden="true"></div>

		<!-- Close -->
		<button
			type="button"
			class="pie-tool-line-reader__button pie-tool-line-reader__close"
			onclick={closeTool}
			title="Close line reader"
			aria-label="Close line reader"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
				<path
					d="M1 1 L11 11 M11 1 L1 11"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>

		<!-- Reading-window resize handle -->
		<button
			type="button"
			class="pie-tool-line-reader__resize-handle pie-tool-line-reader__resize-handle--pane"
			onkeydown={handlePaneResizeKeyDown}
			title="Drag to resize the reading window"
			aria-label="Resize the reading window. Drag, or use the up and down arrow keys to change its height. Current height {paneHeight} pixels"
		>
			<svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true" focusable="false">
				<path
					d="M1 2.5 H13 M1 5.5 H13"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>

		<!-- Frame resize handle -->
		<button
			type="button"
			class="pie-tool-line-reader__resize-handle pie-tool-line-reader__resize-handle--frame"
			onkeydown={handleFrameResizeKeyDown}
			title="Drag to resize the frame and window width"
			aria-label="Resize the frame. Drag, or use the up and down arrow keys to change the frame height and the left and right arrow keys to change the width. Current frame height {frameBandHeight} pixels, width {width} pixels"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
				<path
					d="M11 4 L4 11 M11 8 L8 11"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>

{/if}

<style>
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

	.pie-tool-line-reader {
		border: none;
		border-radius: 4px;
		/*
		 * Ink-derived rather than fixed black: on a dark scheme this reads as a soft
		 * halo separating the window from the page instead of vanishing into it.
		 */
		box-shadow: 0px 2px 4px 0px color-mix(in srgb, var(--pie-text, #000) 8%, transparent);
		cursor: move;
		overflow: visible;
		position: absolute;
		transform: translate(-50%, -50%);
		user-select: none;
		pointer-events: auto;
		touch-action: none;
	}

	.pie-tool-line-reader:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2));
		outline-offset: 2px;
	}

	/*
	 * Window frame: largely obscures the page content it covers. The fill stays a
	 * dark scrim in every colour scheme rather than following the scheme's ink,
	 * because ink-coloured masking fails on its own scheme: a yellow scrim over
	 * yellow-on-blue text hides nothing, and a white one glares in a dark scheme
	 * that the reader chose to avoid glare. Dimming works in both directions -- it
	 * drops the covered text to a fraction of its contrast whatever the palette --
	 * and `--pie-tool-line-reader-outline-color` supplies the boundary that a dark
	 * scrim on a dark page cannot show on its own.
	 *
	 * Drawn as a single element's border box -- bands top and bottom, edges left
	 * and right, transparent content box for the reading window -- rather than four
	 * abutting boxes. Four translucent boxes each antialias their shared edge, so
	 * whenever layout lands off whole pixels (page zoom, fractional font scale) the
	 * junctions render at partial coverage and show as light seams between the
	 * edges and the bands. One border box has no internal boundaries to seam.
	 *
	 * How the frame masks -- its fill and how strongly it obscures -- is a
	 * deployment decision, not a per-student one: it trades reading focus against
	 * how much surrounding context a test taker can still see, which is the kind
	 * of call a programme makes for its whole population. So both come from
	 * `--pie-tool-line-reader-frame-color` and
	 * `--pie-tool-line-reader-frame-opacity`, read here and never written back by
	 * the component -- a host sets them once in its own stylesheet, and no inline
	 * declaration here forces them to outrank it with `!important`.
	 */
	.pie-tool-line-reader__frame {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		border-style: solid;
		border-width: var(--pie-tool-line-reader-band-height, 48px)
			var(--pie-tool-line-reader-side-width, 12px);
		border-color: var(--pie-tool-line-reader-frame-color, #000);
		border-radius: 4px;
		background-color: transparent;
		opacity: var(--pie-tool-line-reader-frame-opacity, 0.8);
	}

	/*
	 * Ink-coloured hairline over the frame: on a light page the dark scrim already
	 * shows its own edges, but on a dark page it blends into the background, and
	 * this is what keeps the window's extent legible. Separate element rather than
	 * a border on the container so it never competes with the focus outline.
	 */
	.pie-tool-line-reader__outline {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		border: 1px solid
			var(--pie-tool-line-reader-outline-color, color-mix(in srgb, var(--pie-text, #000) 70%, transparent));
		border-radius: 4px;
		pointer-events: none;
	}

	/*
	 * Controls sit on the frame bands rather than inside them, so they keep full
	 * opacity while the frame behind them stays translucent. 24x24 is the WCAG
	 * 2.5.8 minimum target size, and the 4px inset is what MIN_FRAME_BAND_HEIGHT
	 * is sized to accommodate.
	 */
	.pie-tool-line-reader__button,
	.pie-tool-line-reader__resize-handle {
		position: absolute;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background-color: transparent;
		/*
		 * Paired with the frame fill rather than the page: the glyphs sit on the
		 * scrim, so they stay white in every scheme and only need revisiting if a
		 * host overrides the frame colour to something light.
		 */
		color: var(--pie-tool-line-reader-control-color, #fff);
		cursor: pointer;
	}

	.pie-tool-line-reader__button:hover,
	.pie-tool-line-reader__resize-handle:hover {
		background-color: color-mix(in srgb, currentColor 20%, transparent);
	}

	.pie-tool-line-reader__button:focus-visible,
	.pie-tool-line-reader__resize-handle:focus-visible {
		/* currentColor keeps the indicator readable on the frame in every scheme. */
		outline: 2px solid var(--pie-button-focus-outline, currentColor);
		outline-offset: 1px;
	}

	.pie-tool-line-reader__close {
		top: 4px;
		right: 4px;
	}

	/* Resizes the reading window: vertical only, centred on the bottom band. */
	.pie-tool-line-reader__resize-handle--pane {
		bottom: 4px;
		left: 50%;
		margin-left: -12px;
		cursor: ns-resize;
	}

	/* Resizes the frame bands and the overall width, so it reads as a corner grip. */
	.pie-tool-line-reader__resize-handle--frame {
		bottom: 4px;
		right: 4px;
		cursor: nwse-resize;
	}

	.pie-tool-line-reader:active {
		cursor: grabbing;
	}
</style>
