/**
 * Host surface ids a content capability can fill.
 *
 * A renderer opens slots in its own layout — a card's docked-media region, the
 * full-width slot above its body — and a registration names the slots it can
 * render into through `ToolRegistration.surfaces`. The ids live here, one
 * definition for both sides of that exchange: a capability package cannot
 * import a player to reach the renderer's constants, and a renderer without a
 * toolbar — print — cannot import the composition layer for the packaged
 * registrations', so the slot names are the toolkit's to own.
 *
 * The ids say nothing about geometry. How wide a slot is, where it sits, or
 * that it collapses under a breakpoint is the renderer's decision; a
 * registration declaring `surfaces` promises only that it can render into a
 * slot with that name, whatever the renderer makes of it.
 */

/**
 * Host slot for media docked beside a card's content.
 *
 * Named for the relationship rather than for one card kind, because item cards
 * and passage cards open the same slot: an alternate is authored against a
 * content node, and a passage owns content nodes exactly as an item does. A
 * capability declares this surface once and reaches both.
 */
export const CONTENT_MEDIA_SURFACE = "content-media";

/**
 * Host slot for a text alternate that has to be read in order with the
 * content: full width, above the card body, in document flow.
 *
 * Separate from {@link CONTENT_MEDIA_SURFACE} because the geometry is the
 * whole difference. Docked media is watched beside the content and is sized by
 * an aspect ratio; a transcript or a plain-language alternate is read *before*
 * the control it belongs to, which a sticky side column cannot express.
 */
export const CONTENT_LEAD_SURFACE = "content-lead";
