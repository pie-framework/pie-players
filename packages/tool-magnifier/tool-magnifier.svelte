<svelte:options
	customElement={{
		tag: 'pie-tool-magnifier',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			zoom: { type: 'Number', attribute: 'zoom' }
		},
		extend: coerceBooleanAttributes,
	}}
/>

<!--
@component
Magnifying lens: a movable, resizable window that shows the content under it
enlarged, with controls on its bar to change the zoom and close. The host shows
it with `visible` and sets the starting magnification with `zoom` (the AfA PNP
`magnification` amount; 2 when absent). Inside a toolkit runtime context it
registers `tool-id` with the tool coordinator on the tool layer, and the close
control hides it there. Arrow keys move it, `+` and `-` change the zoom, and
Escape closes it, wherever on the page it is pressed.
-->

<script lang="ts">
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';

	import {
		connectToolRuntimeContext,
		createToolCoordinatorRegistration,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import {
		clampPointWithinBlock,
		createFocusReturn,
		createPointerDragController,
		createPointerGesture,
		DEFAULT_CONTAINMENT_GUTTER,
		dockUprightControls,
		OVERLAY_PLACEMENT_NUDGES,
		type OverlayPlacementNudge,
		type OverlaySizeControl,
		type OverlayTapTarget,
		resolveContainingBlockRect
	} from '@pie-players/pie-players-shared';
	import { OverlayPlacementControls } from '@pie-players/pie-players-shared/components/overlay-placement';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import { onMount, untrack } from 'svelte';
	import { lensFocus } from './src/lens-focus.js';
	import { createMirrorFrame, type MirrorFrame } from './src/mirror.js';

	let {
		visible = false,
		toolId = 'magnification',
		zoom = undefined
	}: { visible?: boolean; toolId?: string; zoom?: number } = $props();

	const lensTag = $host().localName;
	const isBrowser = typeof window !== 'undefined';

	let containerEl = $state<HTMLDivElement | undefined>();
	let viewportEl = $state<HTMLDivElement | undefined>();
	let controlsEl = $state<HTMLDivElement | undefined>();
	/** Where focus goes back to when the learner closes the lens. */
	const focusReturn = createFocusReturn();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	/**
	 * Centre point of the lens, in the coordinate space of its containing block.
	 * Seeded from the visible part of that block once the element is in the DOM.
	 */
	let position = $state({ x: 0, y: 0 });
	let positionSeeded = false;
	const dragController = createPointerDragController({
		getPosition: () => position,
		setPosition: (next) => {
			position = clampToContainingBlock(next);
		},
		onDragStart: (container) => coordinator?.bringToFront(container as HTMLElement)
	});
	/** Size of the magnified viewport, excluding the bar and the border. */
	let width = $state(480);
	let height = $state(200);
	let level = $state(2);
	let resizing = $state(false);
	let resizeStart = { width: 0, height: 0, mouseX: 0, mouseY: 0 };
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	let announceText = $state('');
	/** The page's keyboard focus, in the viewport's coordinates, while the lens shows it. */
	let focusRing = $state<{ left: number; top: number; width: number; height: number } | null>(
		null
	);

	const registration = createToolCoordinatorRegistration('Magnifier', ZIndexLayer.TOOL);

	// Geometry constants
	const BAR_HEIGHT = 36; // pixels
	const BORDER_WIDTH = 2; // pixels
	const MIN_WIDTH = 160; // pixels
	const MIN_HEIGHT = 100; // pixels
	const MAX_WIDTH = 1200; // pixels
	const MAX_HEIGHT = 800; // pixels
	const CONTAINMENT_GUTTER = DEFAULT_CONTAINMENT_GUTTER;

	// Zoom: the steps the controls move between, and the range a host may start in.
	const ZOOM_STEPS = [1.5, 2, 2.5, 3, 4, 5, 6, 8];
	const DEFAULT_ZOOM = 2;
	const MIN_ZOOM = 1.25;
	const MAX_ZOOM = 8;

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const RESIZE_STEP = 20; // pixels

	const lensWidth = $derived(width + BORDER_WIDTH * 2);
	const lensHeight = $derived(BAR_HEIGHT + height + BORDER_WIDTH * 2);
	const canZoomIn = $derived(ZOOM_STEPS.some((step) => step > level + 0.001));
	const canZoomOut = $derived(ZOOM_STEPS.some((step) => step < level - 0.001));
	const zoomText = $derived(formatZoom(level));

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	let announceTimer: ReturnType<typeof setTimeout> | null = null;

	function announce(message: string) {
		if (announceTimer !== null) clearTimeout(announceTimer);
		announceText = message;
		announceTimer = setTimeout(() => {
			announceText = '';
			announceTimer = null;
		}, 1000);
	}

	function formatZoom(value: number): string {
		return new Intl.NumberFormat(interfaceI18n.getLocale(), {
			maximumFractionDigits: 2
		}).format(value);
	}

	/** A host's magnification, or the default when it names none a lens can use. */
	function normalizeZoom(value: unknown): number {
		const amount = typeof value === 'number' ? value : Number(value);
		if (value === undefined || value === null || !Number.isFinite(amount) || amount <= 1) {
			return DEFAULT_ZOOM;
		}
		return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, amount));
	}

	function stepZoom(direction: 1 | -1) {
		const next =
			direction > 0
				? ZOOM_STEPS.find((step) => step > level + 0.001)
				: [...ZOOM_STEPS].reverse().find((step) => step < level - 0.001);
		if (next === undefined) return;
		level = next;
		announce(
			interfaceI18n.t('tools.magnification.zoomAnnounce', { zoom: formatZoom(level) }),
		);
	}

	/** The box the lens's `left`/`top` are relative to. */
	function containingBlockRect(): DOMRect | undefined {
		return resolveContainingBlockRect(containerEl);
	}

	function containingBlockSize(): { width: number; height: number } | undefined {
		const rect = containingBlockRect();
		return rect && { width: rect.width, height: rect.height };
	}

	function clampWidth(value: number) {
		const available = containingBlockSize()?.width;
		const upper =
			available === undefined
				? MAX_WIDTH
				: Math.min(MAX_WIDTH, available - CONTAINMENT_GUTTER * 2 - BORDER_WIDTH * 2);
		return Math.round(Math.max(MIN_WIDTH, Math.min(Math.max(MIN_WIDTH, upper), value)));
	}

	function clampHeight(value: number) {
		const available = containingBlockSize()?.height;
		const upper =
			available === undefined
				? MAX_HEIGHT
				: Math.min(
						MAX_HEIGHT,
						available - CONTAINMENT_GUTTER * 2 - BORDER_WIDTH * 2 - BAR_HEIGHT
					);
		return Math.round(Math.max(MIN_HEIGHT, Math.min(Math.max(MIN_HEIGHT, upper), value)));
	}

	/**
	 * Where the lens should open, in containing-block coordinates: the centre of
	 * the part of the block on screen, so a lens placed on a long passage opens
	 * over the text the student is looking at.
	 */
	function seedCentre(): { x: number; y: number } | undefined {
		const rect = containingBlockRect();
		if (!rect) return undefined;
		const visibleLeft = Math.max(rect.left, 0);
		const visibleTop = Math.max(rect.top, 0);
		const visibleRight = Math.min(rect.right, window.innerWidth);
		const visibleBottom = Math.min(rect.bottom, window.innerHeight);
		if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
			return { x: rect.width / 2, y: rect.height / 2 };
		}
		return {
			x: (visibleLeft + visibleRight) / 2 - rect.left,
			y: (visibleTop + visibleBottom) / 2 - rect.top
		};
	}

	/**
	 * Keeps the lens inside its containing block. `position` is the centre point --
	 * the root is drawn with `translate(-50%, -50%)` -- and the lens's extent moves
	 * with its resize control, so both are read at call time.
	 */
	function clampToContainingBlock(next: { x: number; y: number }) {
		const block = containingBlockSize();
		if (!block) return next;
		return clampPointWithinBlock(
			next,
			{ width: lensWidth, height: lensHeight },
			block,
			CONTAINMENT_GUTTER
		);
	}

	function reclampPosition() {
		position = clampToContainingBlock(position);
	}

	function resize(deltaWidth: number, deltaHeight: number) {
		width = clampWidth(width + deltaWidth);
		height = clampHeight(height + deltaHeight);
		reclampPosition();
		announce(interfaceI18n.t('tools.magnification.sizeAnnounce', { width, height }));
	}

	function closeTool() {
		if (coordinator && toolId) {
			// Before the lens goes, so focus never falls to the document body.
			focusReturn.restore();
			coordinator.hideTool(toolId);
		}
	}

	/** Closes the lens from outside it, leaving focus where the learner has it. */
	function dismiss() {
		if (coordinator && toolId) coordinator.hideTool(toolId);
	}

	// The copy of the page the lens shows, and the frame its transform is
	// recomputed on. Neither is reactive: both are driven from events.
	let mirror: MirrorFrame | null = null;
	let placementFrame = 0;

	/**
	 * Scales the copy by the zoom and offsets it so the point `lensFocus` picks
	 * sits at the centre of the viewport. The copy is laid out at the page's
	 * viewport size and scrolled with it, so a page point's viewport coordinates
	 * are its coordinates in the copy.
	 */
	function placeMirror() {
		if (!mirror || !viewportEl || !containerEl) return;
		const view = viewportEl.getBoundingClientRect();
		const lens = containerEl.getBoundingClientRect();
		const block = containingBlockRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
		const focusX = lensFocus(
			{ start: lens.left, extent: lens.width },
			{ start: block.left, extent: block.width },
			view.width,
			level,
			CONTAINMENT_GUTTER
		);
		const focusY = lensFocus(
			{ start: lens.top, extent: lens.height },
			{ start: block.top, extent: block.height },
			view.height,
			level,
			CONTAINMENT_GUTTER
		);
		const offsetX = view.width / 2 - level * focusX;
		const offsetY = view.height / 2 - level * focusY;
		mirror.setTransform(`translate(${offsetX}px, ${offsetY}px) scale(${level})`);
		focusRing = pageFocusBox(offsetX, offsetY);
	}

	/**
	 * Where the page's keyboard focus sits in the copy, scaled and offset as the
	 * copy is. The copy holds no focus of its own, so without this ring a control
	 * focused beneath the lens shows no indicator at all.
	 */
	function pageFocusBox(offsetX: number, offsetY: number) {
		let active = document.activeElement;
		while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
		if (!active || active === document.body || !active.matches(':focus-visible')) return null;
		// Focus on a lens, this one or another, is not in the copy.
		const root = active.getRootNode();
		if (root instanceof ShadowRoot && root.host.localName === lensTag) return null;
		const box = active.getBoundingClientRect();
		if (box.width === 0 && box.height === 0) return null;
		return {
			left: offsetX + level * box.left,
			top: offsetY + level * box.top,
			width: level * box.width,
			height: level * box.height
		};
	}

	function dockControls() {
		if (containerEl && controlsEl) dockUprightControls(containerEl, controlsEl);
	}

	/** Places the copy and docks the tap controls on the next frame. */
	function schedulePlacement() {
		if (!isBrowser || placementFrame) return;
		placementFrame = requestAnimationFrame(() => {
			placementFrame = 0;
			placeMirror();
			dockControls();
		});
	}

	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;
		const grip = target.closest<HTMLElement>('.pie-tool-magnifier__resize');
		if (grip) {
			startResizing(e, grip);
			return;
		}
		// Let the bar's buttons handle their own activation instead of swallowing
		// the press into a drag.
		if (target.closest('button')) return;
		startDragging(e);
	}

	// Drags and resizes share one gesture, which ends on a cancelled touch as well
	// as on release.
	const gesture = createPointerGesture({
		onMove: handlePointerMove,
		onEnd: () => {
			dragController.endDragging();
			resizing = false;
		}
	});

	function startDragging(e: PointerEvent) {
		if (!containerEl || !gesture.begin(e, containerEl)) return;
		// The claim's `preventDefault` suppresses the press's default focus; without
		// this the arrow-key shortcuts never reach the lens.
		containerEl.focus({ preventScroll: true });
		dragController.startDragging(e, containerEl);
	}

	function startResizing(e: PointerEvent, grip: HTMLElement) {
		e.stopPropagation();
		if (!containerEl || !gesture.begin(e, containerEl)) return;
		containerEl.setPointerCapture(e.pointerId);
		grip.focus({ preventScroll: true });
		resizing = true;
		resizeStart = { width, height, mouseX: e.clientX, mouseY: e.clientY };
		coordinator?.bringToFront(containerEl);
	}

	function handlePointerMove(e: PointerEvent) {
		if (dragController.isDragging()) {
			dragController.handlePointerMove(e);
			return;
		}
		if (!resizing) return;
		// The lens grows symmetrically around its centre, so the corner under the
		// pointer moves half as far as the dimension it drives.
		width = clampWidth(resizeStart.width + (e.clientX - resizeStart.mouseX) * 2);
		height = clampHeight(resizeStart.height + (e.clientY - resizeStart.mouseY) * 2);
		reclampPosition();
	}

	/** Moves the lens one step, as an arrow key or a move button does. */
	function nudge(direction: OverlayPlacementNudge) {
		const { dx, dy, announceKey } = OVERLAY_PLACEMENT_NUDGES[direction];
		position = clampToContainingBlock({
			x: position.x + dx * MOVE_STEP,
			y: position.y + dy * MOVE_STEP
		});
		announce(
			interfaceI18n.t(announceKey, {
				position: Math.round(dx === 0 ? position.y : position.x),
			}),
		);
	}

	// The tap alternatives to dragging the lens and its grip (WCAG 2.5.7), one
	// pair for each dimension the grip drives.
	const tapTarget: OverlayTapTarget = { nudge };
	const sizeControls = $derived<OverlaySizeControl[]>([
		{
			shrink: { glyph: '↔−', label: interfaceI18n.t('tools.magnification.narrowerA11y') },
			grow: { glyph: '↔+', label: interfaceI18n.t('tools.magnification.widerA11y') },
			step: (direction) => resize(direction * RESIZE_STEP, 0)
		},
		{
			shrink: { glyph: '↕−', label: interfaceI18n.t('tools.magnification.shorterA11y') },
			grow: { glyph: '↕+', label: interfaceI18n.t('tools.magnification.tallerA11y') },
			step: (direction) => resize(0, direction * RESIZE_STEP)
		}
	]);

	function handleKeyDown(e: KeyboardEvent) {
		let handled = true;
		switch (e.key) {
			case 'ArrowUp':
				nudge('up');
				break;
			case 'ArrowDown':
				nudge('down');
				break;
			case 'ArrowLeft':
				nudge('left');
				break;
			case 'ArrowRight':
				nudge('right');
				break;
			case '+':
			case '=':
				stepZoom(1);
				break;
			case '-':
			case '_':
				stepZoom(-1);
				break;
			case 'Escape':
				closeTool();
				break;
			default:
				handled = false;
		}
		if (handled) e.preventDefault();
	}

	/**
	 * Keyboard alternative to dragging the resize grip: arrow keys resize while
	 * the grip has focus, and are stopped so they do not also move the lens.
	 */
	function handleResizeKeyDown(e: KeyboardEvent) {
		let handled = true;
		switch (e.key) {
			case 'ArrowUp':
				resize(0, -RESIZE_STEP);
				break;
			case 'ArrowDown':
				resize(0, RESIZE_STEP);
				break;
			case 'ArrowLeft':
				resize(-RESIZE_STEP, 0);
				break;
			case 'ArrowRight':
				resize(RESIZE_STEP, 0);
				break;
			default:
				handled = false;
		}
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	// Re-registers when a republished context brings a new coordinator.
	$effect(() => registration.sync(coordinator, toolId));

	onMount(() => {
		return () => {
			if (announceTimer !== null) clearTimeout(announceTimer);
			if (placementFrame) cancelAnimationFrame(placementFrame);
			gesture.release();
			registration.release();
		};
	});

	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// The host's magnification, applied whenever it changes; the student's own
	// zoom changes hold until it does.
	$effect(() => {
		const next = normalizeZoom(zoom);
		untrack(() => {
			level = next;
		});
	});

	/**
	 * Places the lens over the visible part of its containing block the first time
	 * it is shown, and trims a default size that does not fit. Runs once: a
	 * position the student dragged to survives closing and reopening the tool.
	 */
	function seedPosition() {
		if (positionSeeded) return;
		const centre = seedCentre();
		if (!centre) return;
		positionSeeded = true;
		width = clampWidth(width);
		height = clampHeight(height);
		position = clampToContainingBlock(centre);
	}

	$effect(() => {
		if (!visible) untrack(() => gesture.release());
	});

	// Position, then focus, when the tool becomes visible -- focused with
	// `preventScroll` so revealing it cannot scroll the pane it sits in. What had
	// focus before is where closing the lens returns it.
	$effect(() => {
		if (!visible || !containerEl) return;
		const container = containerEl;
		untrack(() => {
			seedPosition();
			focusReturn.capture(container);
		});
		const timer = setTimeout(() => containerEl?.focus({ preventScroll: true }), 100);
		return () => clearTimeout(timer);
	});

	// The copy of the page exists only while the lens is on screen.
	$effect(() => {
		if (!isBrowser || !visible || !viewportEl) return;
		const container = viewportEl;
		const created = untrack(() =>
			createMirrorFrame({
				container,
				// Every lens, so two lenses never show each other.
				exclude: (element) => element.localName === lensTag,
				onSwap: schedulePlacement
			})
		);
		mirror = created;
		schedulePlacement();
		return () => {
			created.destroy();
			if (mirror === created) mirror = null;
		};
	});

	// The copy and the tap controls follow the lens: its position, its size and
	// the zoom.
	$effect(() => {
		void position.x;
		void position.y;
		void width;
		void height;
		void level;
		void controlsEl;
		untrack(schedulePlacement);
	});

	// Scrolling moves the content under the lens, a window resize changes the
	// containing block's extent, and focus moving moves the ring the lens draws.
	$effect(() => {
		if (!isBrowser || !visible) return;
		const onScroll = () => schedulePlacement();
		const onFocusChange = () => schedulePlacement();
		const onResize = () => {
			width = clampWidth(width);
			height = clampHeight(height);
			reclampPosition();
			schedulePlacement();
		};
		document.addEventListener('scroll', onScroll, { capture: true, passive: true });
		document.addEventListener('focusin', onFocusChange);
		document.addEventListener('focusout', onFocusChange);
		window.addEventListener('resize', onResize);
		return () => {
			document.removeEventListener('scroll', onScroll, true);
			document.removeEventListener('focusin', onFocusChange);
			document.removeEventListener('focusout', onFocusChange);
			window.removeEventListener('resize', onResize);
		};
	});

	// Escape closes the lens from anywhere on the page, so a learner whose focus
	// is on content the lens covers can uncover it without moving focus (WCAG
	// 2.4.11). An Escape something else already claimed is left alone: the lens's
	// own, which also returns focus, and a dialog's.
	$effect(() => {
		if (!isBrowser || !visible) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
			e.preventDefault();
			dismiss();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	});
</script>

{#if visible}
	<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="pie-tool-magnifier"
		style:left="{position.x}px"
		style:top="{position.y}px"
		style:width="{lensWidth}px"
		style:height="{lensHeight}px"
		onpointerdown={handlePointerDown}
		onkeydown={handleKeyDown}
		role="group"
		tabindex="0"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.magnification.applicationA11y', { zoom: zoomText })}
		aria-roledescription={interfaceI18n.t('tools.magnification.roleA11y')}
	>
		<div class="pie-tool-magnifier__frame" style:border-width="{BORDER_WIDTH}px">
			<div class="pie-tool-magnifier__bar" style:height="{BAR_HEIGHT}px">
				<button
					type="button"
					class="pie-tool-magnifier__button"
					onclick={() => stepZoom(-1)}
					aria-disabled={!canZoomOut}
					title={interfaceI18n.t('tools.magnification.zoomOut')}
					aria-label={interfaceI18n.t('tools.magnification.zoomOut')}
				>
					<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
						<path d="M2 7 H12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
					</svg>
				</button>
				<span class="pie-tool-magnifier__level" aria-hidden="true">
					{interfaceI18n.t('tools.magnification.zoomLevel', { zoom: zoomText })}
				</span>
				<button
					type="button"
					class="pie-tool-magnifier__button"
					onclick={() => stepZoom(1)}
					aria-disabled={!canZoomIn}
					title={interfaceI18n.t('tools.magnification.zoomIn')}
					aria-label={interfaceI18n.t('tools.magnification.zoomIn')}
				>
					<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
						<path
							d="M2 7 H12 M7 2 V12"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
						/>
					</svg>
				</button>
				<span class="pie-tool-magnifier__spacer"></span>
				<button
					type="button"
					class="pie-tool-magnifier__button"
					onclick={closeTool}
					title={interfaceI18n.t('tools.magnification.close')}
					aria-label={interfaceI18n.t('tools.magnification.close')}
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
			</div>

			<!-- The magnified copy of the page is mounted here. -->
			<div bind:this={viewportEl} class="pie-tool-magnifier__viewport" aria-hidden="true">
				{#if focusRing}
					<div
						class="pie-tool-magnifier__focus"
						style:left="{focusRing.left}px"
						style:top="{focusRing.top}px"
						style:width="{focusRing.width}px"
						style:height="{focusRing.height}px"
					></div>
				{/if}
			</div>

			<button
				type="button"
				class="pie-tool-magnifier__resize"
				onkeydown={handleResizeKeyDown}
				title={interfaceI18n.t('tools.magnification.resizeA11y')}
				aria-label={interfaceI18n.t('tools.magnification.resizeFullA11y', { width, height })}
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

		<OverlayPlacementControls
			controller={tapTarget}
			i18n={interfaceI18n}
			classPrefix="pie-tool-magnifier"
			sizes={sizeControls}
			bind:element={controlsEl}
		/>
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

	/* The positioned root holds the lens's frame and, outside it, the tap controls. */
	.pie-tool-magnifier {
		position: absolute;
		transform: translate(-50%, -50%);
		box-sizing: border-box;
		border-radius: 8px;
		cursor: move;
		user-select: none;
		pointer-events: auto;
		touch-action: none;
		font-size: 14px;
		line-height: 1;
	}

	.pie-tool-magnifier:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4a90e2));
		/* Inside the containment gutter, so the block never clips the ring. */
		outline-offset: 1px;
	}

	.pie-tool-magnifier:active {
		cursor: grabbing;
	}

	.pie-tool-magnifier__frame {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		border-style: solid;
		border-color: var(--pie-primary, #1a73e8);
		border-radius: inherit;
		background-color: var(--pie-background, #fff);
		color: var(--pie-text, #111);
		box-shadow: 0 4px 16px 0 color-mix(in srgb, var(--pie-text, #000) 24%, transparent);
		overflow: hidden;
	}

	.pie-tool-magnifier__bar {
		flex: none;
		display: flex;
		align-items: center;
		gap: 4px;
		box-sizing: border-box;
		padding: 0 6px;
		background-color: var(--pie-secondary-background, #f2f4f7);
		border-bottom: 1px solid var(--pie-border, #c4c9d1);
	}

	.pie-tool-magnifier__level {
		min-width: 3em;
		text-align: center;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.pie-tool-magnifier__spacer {
		flex: 1;
	}

	/* 28x28 clears the WCAG 2.5.8 minimum target size with room on the bar. */
	.pie-tool-magnifier__button,
	.pie-tool-magnifier__resize {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background-color: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pie-tool-magnifier__button:hover:not([aria-disabled='true']),
	.pie-tool-magnifier__resize:hover {
		background-color: color-mix(in srgb, currentColor 14%, transparent);
	}

	/* At a zoom limit the button stays focusable, so focus is not lost when it is reached. */
	.pie-tool-magnifier__button[aria-disabled='true'] {
		opacity: 0.4;
		cursor: default;
	}

	.pie-tool-magnifier__button:focus-visible,
	.pie-tool-magnifier__resize:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, var(--pie-primary, #4a90e2));
		outline-offset: 1px;
	}

	.pie-tool-magnifier__viewport {
		position: relative;
		flex: 1;
		overflow: hidden;
		background-color: var(--pie-background, #fff);
	}

	/* Drawn above the copy, which the mirror appends to the viewport after it. */
	.pie-tool-magnifier__focus {
		position: absolute;
		z-index: 1;
		box-sizing: border-box;
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4a90e2));
		outline-offset: 2px;
		border-radius: 2px;
		pointer-events: none;
	}

	/* A corner grip over the viewport, on a backing so it reads over any content. */
	.pie-tool-magnifier__resize {
		position: absolute;
		right: 2px;
		bottom: 2px;
		width: 24px;
		height: 24px;
		background-color: color-mix(in srgb, var(--pie-background, #fff) 85%, transparent);
		cursor: nwse-resize;
	}
</style>
