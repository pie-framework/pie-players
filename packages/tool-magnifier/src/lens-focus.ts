/** A box's extent on one axis. */
export interface Span {
	start: number;
	extent: number;
}

/**
 * The page coordinate the lens shows at the centre of its viewport, on one axis.
 *
 * Showing the point under the lens's centre would leave a band along each edge
 * of the lens's block out of reach, half a magnified view wide: the lens stops at
 * the edge with that band still outside its view. So the shown point travels the
 * block in proportion to the lens's own travel, from where the view's near edge
 * meets the block's near edge at one end to where the far edges meet at the
 * other. A block narrower than the magnified view is shown centred.
 *
 * `view` is the viewport's extent and `level` the zoom, so the view shows
 * `view / level` of the page; `gutter` is the inset the lens is clamped to.
 */
export function lensFocus(
	lens: Span,
	block: Span,
	view: number,
	level: number,
	gutter: number,
): number {
	const shown = view / level;
	if (block.extent <= shown) return block.start + block.extent / 2;
	const travel = block.extent - gutter * 2 - lens.extent;
	const progress =
		travel > 0 ? Math.max(0, Math.min(1, (lens.start - block.start - gutter) / travel)) : 0.5;
	return block.start + shown / 2 + progress * (block.extent - shown);
}
