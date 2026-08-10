/**
 * How wide the item card's media region is.
 *
 * Sizing only. Which capability fills the region, and whether it has anything to
 * show, belongs to the capability: the card asks the registry for whatever is
 * registered on the `item-media` surface and knows nothing else about it. The
 * signed-alternate resolution that used to live here moved to
 * `@pie-players/pie-tool-sign-language` behind that capability's own
 * `requiresAuthoredContent`.
 */

/**
 * Default and bounds for the media region's share of the card width.
 *
 * Docked media generally needs height rather than width — a person on camera
 * needs room for hands and face — so the region is sized by an aspect-ratio
 * target with a minimum height rather than by width alone. A flat viewport
 * percentage either wastes space on a short clip or crushes it on a narrow
 * device. The percentage below only decides how the card's width is split;
 * legibility is defended by the mounted element's own CSS.
 */
export const MEDIA_REGION_DEFAULT_PERCENT = 34;
export const MEDIA_REGION_MIN_PERCENT = 20;
export const MEDIA_REGION_MAX_PERCENT = 55;
/** Below this card width the split is dropped and the region stacks. */
export const MEDIA_REGION_STACK_BREAKPOINT_PX = 560;

export function clampMediaRegionPercent(
	value: number,
	min: number = MEDIA_REGION_MIN_PERCENT,
	max: number = MEDIA_REGION_MAX_PERCENT,
): number {
	if (!Number.isFinite(value)) return MEDIA_REGION_DEFAULT_PERCENT;
	return Math.max(min, Math.min(max, value));
}

/**
 * Convert a pointer drag into a media-region width percentage.
 *
 * Container-relative, unlike the passage/items divider's fixed 0.1%-per-pixel
 * factor: the same drag has to mean the same thing in a wide card and a narrow
 * one. The region is on the right, so dragging left grows it.
 */
export function mediaRegionPercentFromDrag(args: {
	startPercent: number;
	deltaX: number;
	containerWidthPx: number;
	min?: number;
	max?: number;
}): number {
	const width = args.containerWidthPx;
	if (!Number.isFinite(width) || width <= 0) {
		return clampMediaRegionPercent(args.startPercent, args.min, args.max);
	}
	const deltaPercent = (args.deltaX / width) * 100;
	return clampMediaRegionPercent(
		args.startPercent - deltaPercent,
		args.min,
		args.max,
	);
}
