/**
 * Keyboard and viewport arithmetic for the selection toolbar.
 *
 * Extracted from the component because these three answers are the ones that were
 * wrong, and none of them needs a DOM to be checked: which keys ask for the strip,
 * where an arrow key moves within it, and when the selection it points at has
 * scrolled out of view. The component keeps the DOM work — reading the rendered
 * control list, moving focus — and asks these for the decisions.
 */

/** Horizontal writing direction of the strip, which decides what "forward" means. */
export type ToolbarDirection = "ltr" | "rtl";

export interface ControlNavigationArgs {
	key: string;
	/** Index of the control that currently holds the roving tabindex. */
	activeIndex: number;
	/** Number of enabled controls rendered right now. */
	count: number;
	direction: ToolbarDirection;
}

export interface ViewportRect {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface ViewportSize {
	width: number;
	height: number;
}

/**
 * Whether a key press is asking to act on the current selection.
 *
 * Shift+F10 and the Menu key are the platform conventions for opening a context
 * surface over a selection, and they are what a screen-reader user reaches for. The
 * strip is a floating layer mounted at section scope, so tabbing to it is not an
 * option: its DOM position bears no relation to where the selection is, and
 * reaching it would mean traversing the rest of the content first.
 */
export function requestsSelectionToolbar(event: {
	key: string;
	shiftKey?: boolean;
}): boolean {
	if (event.key === "ContextMenu") return true;
	return event.key === "F10" && event.shiftKey === true;
}

/**
 * Where an arrow, Home or End key moves the roving tabindex, or `null` when the key
 * is not one this widget claims.
 *
 * The ARIA toolbar pattern is one tab stop plus arrow navigation, and the mapping is
 * logical rather than physical: in a right-to-left strip the first control is on the
 * right, so ArrowRight moves toward the start. Wrapping matches the pattern's
 * guidance for a toolbar whose controls are all of one kind.
 */
export function nextControlIndex({
	key,
	activeIndex,
	count,
	direction,
}: ControlNavigationArgs): number | null {
	if (count <= 0) return null;
	const current = clampIndex(activeIndex, count);
	const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
	const backward = direction === "rtl" ? "ArrowRight" : "ArrowLeft";

	if (key === forward) return (current + 1) % count;
	if (key === backward) return (current - 1 + count) % count;
	if (key === "Home") return 0;
	if (key === "End") return count - 1;
	return null;
}

/** Keep a stale cursor inside the control set, which shrinks when a control unmounts. */
export function clampIndex(index: number, count: number): number {
	if (count <= 0) return 0;
	if (!Number.isFinite(index) || index < 0) return 0;
	return Math.min(Math.trunc(index), count - 1);
}

/**
 * Whether the selection's rect has left the viewport entirely.
 *
 * Scrolling used to dismiss the toolbar outright, which a keyboard user hits on the
 * keystroke that creates the selection: extending past the fold scrolls the page.
 * Partial visibility keeps the strip — the learner can still see what they selected —
 * and only a rect fully outside any edge withdraws it.
 */
export function isRectOffScreen(
	rect: ViewportRect,
	viewport: ViewportSize,
): boolean {
	return (
		rect.bottom < 0 ||
		rect.top > viewport.height ||
		rect.right < 0 ||
		rect.left > viewport.width
	);
}

/**
 * Longest a pointer gesture is assumed to still be in progress.
 *
 * A latch set on `pointerdown` and cleared on `pointerup` wedges if the release
 * happens outside the window, where no `pointerup` arrives — and a wedged latch means
 * the toolbar never appears again for the rest of the attempt. Bounding it costs a
 * gesture held longer than this being treated as finished, which repositions the
 * strip once mid-drag; the alternative loses the tool outright.
 */
export const POINTER_GESTURE_MAX_MS = 2000;

/**
 * Whether to defer showing the toolbar because a pointer is still laying down the
 * selection.
 *
 * `selectionchange` fires throughout a mouse drag, so showing on it directly parks
 * the strip over the text being selected and moves it on every mousemove.
 */
export function isPointerGestureActive(
	pointerDownAt: number | null,
	now: number,
	maxMs = POINTER_GESTURE_MAX_MS,
): boolean {
	if (pointerDownAt === null) return false;
	const elapsed = now - pointerDownAt;
	// A clock that moved backwards is treated as "just started" rather than expired.
	if (elapsed < 0) return true;
	return elapsed < maxMs;
}

/**
 * Anchor point for the strip: centred over the selection, just above it.
 *
 * Returned in viewport coordinates because the strip is `position: fixed`, which is
 * also why scrolling has to recompute it rather than leaving it where it was.
 */
export function toolbarAnchor(
	rect: ViewportRect,
	gap = 8,
): { x: number; y: number } {
	return {
		x: rect.left + (rect.right - rect.left) / 2,
		y: rect.top - gap,
	};
}
