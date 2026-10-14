/**
 * The item player's passage layout: whether a passage stacks above the item or
 * sits beside it, and how a side-by-side split is sized.
 *
 * The values name the section player's layouts, `vertical` and `splitpane`, so
 * one vocabulary covers both players. The split stacks below a container width
 * rather than a viewport width, because an item player is embedded in whatever
 * column a host gives it.
 */

export type PassageLayout = "vertical" | "splitpane";

/** Default and bounds for the passage's share of the player width. */
export const PASSAGE_SPLIT_DEFAULT_PERCENT = 50;
export const PASSAGE_SPLIT_MIN_PERCENT = 20;
export const PASSAGE_SPLIT_MAX_PERCENT = 80;
export const PASSAGE_SPLIT_KEYBOARD_STEP = 5;
/**
 * Below this player width the split stacks: two columns of about 360px each is
 * the narrowest that keeps a passage and a question both readable.
 */
export const PASSAGE_SPLIT_STACK_BREAKPOINT_PX = 768;

/** `vertical` for anything other than `splitpane`, so an unknown value keeps today's layout. */
export function resolvePassageLayout(value: unknown): PassageLayout {
	return value === "splitpane" ? "splitpane" : "vertical";
}

/**
 * Whether a split layout stacks at this measured width. An unmeasured width (0)
 * does not stack, so a wide player renders split from its first frame.
 */
export function isPassageSplitStacked(widthPx: number): boolean {
	return widthPx > 0 && widthPx < PASSAGE_SPLIT_STACK_BREAKPOINT_PX;
}

export function clampPassageSplitPercent(value: number): number {
	if (!Number.isFinite(value)) return PASSAGE_SPLIT_DEFAULT_PERCENT;
	return Math.max(
		PASSAGE_SPLIT_MIN_PERCENT,
		Math.min(PASSAGE_SPLIT_MAX_PERCENT, value),
	);
}

/**
 * Convert a pointer drag into the passage's share of the width.
 *
 * Container-relative, as the section player's card media divider is, so the
 * handle tracks the pointer at any player width. The passage is the first
 * column, which is on the right in a right-to-left document, where dragging
 * left grows it.
 */
export function passageSplitPercentFromDrag(args: {
	startPercent: number;
	deltaX: number;
	containerWidthPx: number;
	rtl?: boolean;
}): number {
	const width = args.containerWidthPx;
	if (!Number.isFinite(width) || width <= 0) {
		return clampPassageSplitPercent(args.startPercent);
	}
	const deltaPercent = (args.deltaX / width) * 100;
	return clampPassageSplitPercent(
		args.startPercent + (args.rtl ? -deltaPercent : deltaPercent),
	);
}

/**
 * The passage share after a key press on the divider, or `undefined` for a key
 * the divider does not handle. Arrows move the divider the way they point, so in
 * a right-to-left document the left arrow grows the passage. Home and End go to
 * the narrowest and widest passage.
 */
export function passageSplitPercentFromKey(args: {
	key: string;
	percent: number;
	rtl?: boolean;
}): number | undefined {
	const { key, percent, rtl } = args;
	if (key === "Home") return PASSAGE_SPLIT_MIN_PERCENT;
	if (key === "End") return PASSAGE_SPLIT_MAX_PERCENT;
	if (key !== "ArrowLeft" && key !== "ArrowRight") return undefined;
	const grows = (key === "ArrowRight") !== Boolean(rtl);
	return clampPassageSplitPercent(
		percent + (grows ? PASSAGE_SPLIT_KEYBOARD_STEP : -PASSAGE_SPLIT_KEYBOARD_STEP),
	);
}
