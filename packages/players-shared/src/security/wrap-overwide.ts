/**
 * The wrapping engine behind `wrapOverwideImages` and `wrapOverwideTables`.
 *
 * Both exist for the same reason — content wider than its column must surface a
 * scrollbar rather than be clipped by an ancestor `overflow-x: hidden` (PIE-94,
 * WCAG 1.4.10 Reflow at 400% zoom) — and both wrap the same way: find the
 * unwrapped nodes, skip a PIE element's own template on the authored-markup pass,
 * and insert a focusable `role="region"` wrapper carrying the CSS from
 * `@pie-players/pie-theme`.
 *
 * What genuinely differs per content kind is declared in {@link OverwideWrapSpec}
 * and nothing else: the selector, the wrapper's tag and class, the fast-path probe
 * on the markup string, and how a region announces itself. Accessible naming is
 * the real divergence — an image has `alt`, a table has `<caption>`,
 * `aria-label` and `aria-labelledby` — which is why it is a function rather than
 * a template.
 */

const PIE_CUSTOM_ELEMENT_TAG_REGEX = /^pie-/i;

/** What one content kind needs in order to be wrapped. */
export interface OverwideWrapSpec {
	/** Selector for the nodes to wrap, e.g. `"img"`. */
	selector: string;
	/** Tag of the inserted wrapper — inline for images, block for tables. */
	wrapperTag: string;
	/** Class the theme package styles, e.g. `"pie-image-scroll"`. */
	wrapperClass: string;
	/** Cheap test for "this markup could contain the nodes at all". */
	markupProbe: RegExp;
	/** The wrapper's accessible name for one node. */
	buildAriaLabel: (node: Element) => string;
}

export interface WrapOverwideOptions {
	/**
	 * When `true`, nodes whose nearest `pie-*` ancestor is *strictly between* the
	 * node and `root` are left alone. Used by the string pipeline so the
	 * authored-markup pass doesn't restructure a PIE element's own template.
	 * Defaults to `false` so the live-DOM pass *does* wrap element-rendered nodes.
	 */
	skipPieDescendants?: boolean;
}

function isInsidePieCustomElement(node: Element, root: Element): boolean {
	let ancestor: Element | null = node.parentElement;
	while (ancestor && ancestor !== root) {
		if (PIE_CUSTOM_ELEMENT_TAG_REGEX.test(ancestor.tagName)) {
			return true;
		}
		ancestor = ancestor.parentElement;
	}
	return false;
}

/**
 * Wrap every unwrapped match under `root`. Returns the number newly wrapped so
 * callers can short-circuit when nothing changed. Idempotent.
 */
export function wrapOverwideInElement(
	root: Element,
	spec: OverwideWrapSpec,
	options: WrapOverwideOptions = {},
): number {
	const { skipPieDescendants = false } = options;
	const nodes = Array.from(root.querySelectorAll(spec.selector));
	if (nodes.length === 0) return 0;

	const ownerDocument = root.ownerDocument;
	if (!ownerDocument) return 0;

	let wrapped = 0;
	for (const node of nodes) {
		const parent = node.parentElement;
		if (!parent) continue;

		// Idempotency — already wrapped.
		if (parent.classList?.contains(spec.wrapperClass)) continue;

		// Authored-markup pass: leave PIE custom-element internals alone.
		if (skipPieDescendants && isInsidePieCustomElement(node, root)) continue;

		const wrapper = ownerDocument.createElement(spec.wrapperTag);
		wrapper.className = spec.wrapperClass;
		wrapper.setAttribute("tabindex", "0");
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute("aria-label", spec.buildAriaLabel(node));

		parent.insertBefore(wrapper, node);
		wrapper.appendChild(node);
		wrapped += 1;
	}
	return wrapped;
}

/**
 * String-in / string-out wrapping, for the post-sanitization step.
 *
 * No-ops on empty input, and during SSR (no `window` / `DOMParser`) — the markup
 * is returned unchanged and the browser re-run on hydrate performs the wrap.
 */
export function wrapOverwideMarkup(
	markup: string,
	spec: OverwideWrapSpec,
): string {
	if (!markup) return "";

	// Fast path: avoid the DOM round-trip entirely when the markup carries none of
	// these nodes. Keeps the sanitize pipeline cheap for the common case.
	if (!spec.markupProbe.test(markup)) return markup;

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

	const wrapped = wrapOverwideInElement(body, spec, {
		skipPieDescendants: true,
	});
	return wrapped > 0 ? body.innerHTML : markup;
}
