/**
 * Containment for tool overlays that position themselves.
 *
 * An overlay that draws its own surface computes its own coordinates, and those
 * coordinates are only meaningful against the box the browser resolved as its
 * containing block. Reading that box from the element rather than from
 * `window` is what keeps a tool correct wherever a host mounts it: the same
 * numbers that centre a tool in the viewport put it outside a pane.
 */

/** Distance kept clear of the block's edges so an overlay's controls stay reachable. */
export const DEFAULT_CONTAINMENT_GUTTER = 4;

export interface Size {
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

/**
 * The box `element` resolves its `left`/`top` against: its containing block, or
 * the viewport when that is the initial containing block.
 *
 * `offsetParent` is the containing block as the browser resolved it, including
 * across a shadow boundary, which is what makes this correct for a tool mounted
 * by a host it knows nothing about. Returns `undefined` outside a browser.
 */
export function resolveContainingBlockRect(
	element: HTMLElement | undefined | null,
): DOMRect | undefined {
	if (typeof window === "undefined" || !element) return undefined;
	const parent = element.offsetParent;
	if (parent instanceof HTMLElement) {
		const rect = parent.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) return rect;
	}
	return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

/**
 * Clamps a translate offset applied to a box that is already centred in its
 * containing block, so the box stays inside it.
 *
 * The travel available on each axis is symmetric about the centre: half the
 * block, less half the box and the gutter. A box wider or taller than its block
 * cannot satisfy that on the offending axis, so it stays centred there rather
 * than clamping to an inverted range.
 */
export function clampOffsetWithinBlock(
	offset: Point,
	box: Size,
	block: Size,
	gutter: number = DEFAULT_CONTAINMENT_GUTTER,
): Point {
	const clampAxis = (value: number, boxExtent: number, blockExtent: number) => {
		const travel = blockExtent / 2 - boxExtent / 2 - gutter;
		if (travel <= 0) return 0;
		return Math.max(-travel, Math.min(travel, value));
	};
	return {
		x: clampAxis(offset.x, box.width, block.width),
		y: clampAxis(offset.y, box.height, block.height),
	};
}
