/**
 * Wraps authored `<img>` elements with a horizontally scrollable container so
 * images that are wider than their column surface a scrollbar instead of being
 * clipped by ancestor `overflow-x: hidden` regions (PIE-94).
 *
 * The wrapper is rendered as
 * `<span class="pie-image-scroll" tabindex="0" role="region" aria-label="...">`
 * and receives the accompanying CSS from `@pie-players/pie-theme`. The CSS uses
 * `overflow-x: auto` so small images stay visually unchanged: a scrollbar only
 * appears when the image's intrinsic width exceeds the wrapper's available
 * space (including at higher browser-zoom levels, which is the original driver
 * for this change — WCAG 1.4.10 Reflow at 400% zoom).
 *
 * Two callable surfaces share the same wrapping logic:
 *
 * - `wrapOverwideImages(markup)` — string-in / string-out, used as a
 *   post-sanitization step inside `sanitizeItemMarkup`. By design it skips
 *   images inside `pie-*` elements; those are the element's own template and
 *   should not be restructured by the authored-markup pipeline.
 * - `wrapOverwideImagesInElement(root)` — operates on a live DOM subtree.
 *   Used by the post-render pass in `PieItemPlayer.svelte` so that images a
 *   PIE element paints into its own light DOM (e.g. a `pie-passage`'s
 *   model-driven content) get the same scrollable affordance even though
 *   they never appeared in the authored markup string.
 *
 * The wrapping itself lives in `./wrap-overwide.js`, shared with the table
 * wrapper: only the four values below and the accessible name differ.
 */

import {
	isOverwideWrapMutation,
	type OverwideWrapSpec,
	type WrapOverwideOptions,
	wrapOverwideInElement,
	wrapOverwideMarkup,
} from "./wrap-overwide.js";

function buildAriaLabel(image: Element): string {
	const alt = image.getAttribute("alt");
	const trimmed = alt ? alt.trim() : "";
	return trimmed ? `Scrollable image: ${trimmed}` : "Scrollable image";
}

const IMAGE_SPEC: OverwideWrapSpec = {
	selector: "img",
	wrapperTag: "span",
	wrapperClass: "pie-image-scroll",
	markupProbe: /<img\b/i,
	buildAriaLabel,
};

export type WrapOverwideImagesInElementOptions = WrapOverwideOptions;

/**
 * Wrap every unwrapped `<img>` descendant of `root` with the shared
 * horizontal-scroll span. Returns the number of newly-wrapped images so
 * callers can short-circuit when nothing changed. Idempotent.
 */
export function wrapOverwideImagesInElement(
	root: Element,
	options: WrapOverwideImagesInElementOptions = {},
): number {
	return wrapOverwideInElement(root, IMAGE_SPEC, options);
}

/**
 * Wrap `<img>` elements in `markup` with a horizontal-scroll container.
 *
 * - No-ops on empty input.
 * - No-ops during SSR (no `window` / `DOMParser`) — the markup is returned
 *   unchanged; the browser re-run on hydrate will perform the wrap.
 * - Idempotent: images whose direct parent already carries the
 *   `pie-image-scroll` class are left alone.
 * - Leaves images inside PIE custom elements (`<pie-*>`) alone. Those are
 *   rendered by the element's own template / shadow DOM and should not be
 *   restructured by the authored-markup pipeline. Use
 *   `wrapOverwideImagesInElement` for the post-render pass that *does* want
 *   to wrap element-rendered images.
 */
export function wrapOverwideImages(markup: string): string {
	return wrapOverwideMarkup(markup, IMAGE_SPEC);
}

/**
 * True when `record` mentions nothing but the output of
 * {@link wrapOverwideImagesInElement} — a `pie-image-scroll` wrapper, or an
 * `<img>` moving inside one. An observer-driven caller ignores such a record so
 * its own wrap does not schedule a second pass.
 */
export function isOverwideImageWrapMutation(record: MutationRecord): boolean {
	return isOverwideWrapMutation(record, IMAGE_SPEC);
}
