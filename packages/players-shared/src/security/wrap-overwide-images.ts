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
 */

const SCROLL_WRAPPER_CLASS = "pie-image-scroll";
const PIE_CUSTOM_ELEMENT_TAG_REGEX = /^pie-/i;

function isInsidePieCustomElement(image: Element, root: Element): boolean {
	let ancestor: Element | null = image.parentElement;
	while (ancestor && ancestor !== root) {
		if (PIE_CUSTOM_ELEMENT_TAG_REGEX.test(ancestor.tagName)) {
			return true;
		}
		ancestor = ancestor.parentElement;
	}
	return false;
}

function buildAriaLabel(image: Element): string {
	const alt = image.getAttribute("alt");
	const trimmed = alt ? alt.trim() : "";
	return trimmed ? `Scrollable image: ${trimmed}` : "Scrollable image";
}

export interface WrapOverwideImagesInElementOptions {
	/**
	 * When `true`, images whose nearest `pie-*` ancestor is *strictly between*
	 * the image and `root` are left alone. Used by the string pipeline so the
	 * authored-markup pass doesn't restructure a PIE element's own template.
	 * Defaults to `false` so the live-DOM pass *does* wrap element-rendered
	 * images.
	 */
	skipPieDescendants?: boolean;
}

/**
 * Wrap every unwrapped `<img>` descendant of `root` with the shared
 * horizontal-scroll span. Returns the number of newly-wrapped images so
 * callers can short-circuit when nothing changed. Idempotent.
 */
export function wrapOverwideImagesInElement(
	root: Element,
	options: WrapOverwideImagesInElementOptions = {},
): number {
	const { skipPieDescendants = false } = options;
	const images = Array.from(root.querySelectorAll("img"));
	if (images.length === 0) return 0;

	const ownerDocument = root.ownerDocument;
	if (!ownerDocument) return 0;

	let wrapped = 0;
	for (const image of images) {
		const parent = image.parentElement;
		if (!parent) continue;

		// Idempotency — already wrapped.
		if (parent.classList && parent.classList.contains(SCROLL_WRAPPER_CLASS)) {
			continue;
		}

		// Authored-markup pass: leave PIE custom-element internals alone.
		if (skipPieDescendants && isInsidePieCustomElement(image, root)) continue;

		const wrapper = ownerDocument.createElement("span");
		wrapper.className = SCROLL_WRAPPER_CLASS;
		wrapper.setAttribute("tabindex", "0");
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute("aria-label", buildAriaLabel(image));

		parent.insertBefore(wrapper, image);
		wrapper.appendChild(image);
		wrapped += 1;
	}
	return wrapped;
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
	if (!markup) return "";

	// Fast path: avoid the DOM round-trip entirely when the markup carries no
	// images. Keeps the sanitize pipeline cheap for the common case.
	if (!/<img\b/i.test(markup)) return markup;

	if (typeof window === "undefined" || !window.document) return markup;

	const ParserCtor =
		typeof DOMParser !== "undefined"
			? DOMParser
			: (window as unknown as { DOMParser?: typeof DOMParser }).DOMParser;
	if (!ParserCtor) return markup;

	const doc = new ParserCtor().parseFromString(
		`<!DOCTYPE html><html><body>${markup}</body></html>`,
		"text/html",
	);
	const body = doc.body;
	if (!body) return markup;

	const wrapped = wrapOverwideImagesInElement(body, {
		skipPieDescendants: true,
	});
	return wrapped > 0 ? body.innerHTML : markup;
}
