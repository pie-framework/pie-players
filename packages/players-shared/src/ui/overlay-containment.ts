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

/**
 * Clamps a translate offset applied to a box centred in its containing block so
 * that at least `visible` pixels of the box stay inside the block on each axis.
 *
 * For an overlay that has to overhang its block to be useful — a ruler lined up
 * against content near a card's edge — without ever being dragged out of reach
 * behind that edge. A box or block narrower than `visible` keeps all of the
 * smaller extent.
 */
export function clampOffsetOverlappingBlock(
	offset: Point,
	box: Size,
	block: Size,
	visible: number,
): Point {
	const clampAxis = (value: number, boxExtent: number, blockExtent: number) => {
		const keep = Math.min(visible, boxExtent, blockExtent);
		const travel = blockExtent / 2 + boxExtent / 2 - keep;
		return Math.max(-travel, Math.min(travel, value));
	};
	return {
		x: clampAxis(offset.x, box.width, block.width),
		y: clampAxis(offset.y, box.height, block.height),
	};
}

/** The axis-aligned extent of a `size` box turned by `degrees` about its centre. */
export function rotatedExtent(size: Size, degrees: number): Size {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		width: size.width * cos + size.height * sin,
		height: size.width * sin + size.height * cos,
	};
}

/**
 * How far a `size` box's centre moves when the box turns by `degrees` about
 * `origin`, given in the box's own coordinates from its top-left corner.
 *
 * Zero for a box turned about its centre. An overlay turned about another
 * point adds this to its translate offset to get the offset of its rotated
 * extent's centre, which is what the centred clamps above bound.
 */
export function rotationCentreShift(size: Size, origin: Point, degrees: number): Point {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const dx = size.width / 2 - origin.x;
	const dy = size.height / 2 - origin.y;
	return {
		x: dx * cos - dy * sin - dx,
		y: dx * sin + dy * cos - dy,
	};
}

/**
 * Where to centre a control strip docked past the bottom edge of a `box`
 * turned by `degrees`, in the box's own coordinates from its top-left corner.
 *
 * The strip is drawn counter-rotated so it stays level on screen. Its reach
 * along the box's downward normal is its projection onto that normal, which
 * grows from its height at no turn to its width at a quarter turn, so a strip
 * placed that far out clears the box at any rotation.
 */
export function uprightDockCentre(box: Size, strip: Size, degrees: number, gap: number): Point {
	const radians = (degrees * Math.PI) / 180;
	const reach =
		strip.width * Math.abs(Math.sin(radians)) + strip.height * Math.abs(Math.cos(radians));
	return { x: box.width / 2, y: box.height + gap + reach / 2 };
}

/**
 * Clamps an absolute centre point, in containing-block coordinates, so the box
 * it positions stays inside that block.
 *
 * The same invariant as `clampOffsetWithinBlock` in the coordinate system an
 * overlay uses when it writes `left`/`top` instead of translating: the two are
 * conjugate by a translation of half the block, including the degenerate case
 * where a box exceeds its block and centres on the offending axis.
 */
export function clampPointWithinBlock(
	point: Point,
	box: Size,
	block: Size,
	gutter: number = DEFAULT_CONTAINMENT_GUTTER,
): Point {
	const centre = { x: block.width / 2, y: block.height / 2 };
	const offset = clampOffsetWithinBlock(
		{ x: point.x - centre.x, y: point.y - centre.y },
		box,
		block,
		gutter,
	);
	return { x: centre.x + offset.x, y: centre.y + offset.y };
}
