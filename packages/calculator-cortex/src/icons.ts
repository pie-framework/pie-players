/**
 * Icon geometry for the tool's glyph-faced buttons.
 *
 * Paths rather than font characters: `⌫` (U+232B) is the face a backspace button
 * wants and the one least likely to be in a host's font stack, and a missing glyph
 * renders as a notdef box — a control with no legible face at all. The arrows and
 * math signs elsewhere in this package stay as text, since those code points are
 * in every font a browser will fall back to.
 *
 * Drawn on a 24x24 grid and stroked in `currentColor`, so a button's own colour
 * carries the icon — including under forced colours, where these buttons take
 * `ButtonText`.
 */
export const ICON_VIEW_BOX = "0 0 24 24";

/** Stroke geometry shared by every icon here. */
export const ICON_STROKE = {
	fill: "none",
	stroke: "currentColor",
	"stroke-width": "1.75",
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
} as const;

/**
 * A key with a cross in it, pointing at what it deletes. The point sits at x=4 so
 * the shape reads as directional at 20px, which a symmetrical box does not.
 */
export const BACKSPACE_ICON = ["M21 6H10l-6 6 6 6h11z", "M13.5 9.5l4 5", "M17.5 9.5l-4 5"];

/**
 * A cross in a circle — the affordance a browser puts in its own search fields for
 * exactly this, and deliberately not the bare cross the tool shell's close button
 * uses, which sits a few pixels away in the same panel.
 */
export const CLEAR_ICON = [
	"M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z",
	"M9.25 9.25l5.5 5.5",
	"M14.75 9.25l-5.5 5.5",
];
