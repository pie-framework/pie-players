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

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

/** A `spec` wrapper holding nothing but the nodes `spec` wraps. */
function isWrapperFor(node: Node, spec: OverwideWrapSpec): boolean {
	if (!isElement(node)) return false;
	if (!node.classList?.contains(spec.wrapperClass)) return false;
	for (const child of Array.from(node.children)) {
		if (!child.matches(spec.selector)) return false;
	}
	return true;
}

/** A node `spec` wraps, currently held by a `spec` wrapper. */
function isWrappedBy(node: Node, spec: OverwideWrapSpec): boolean {
	if (!isElement(node)) return false;
	const parent = node.parentElement;
	if (!parent?.classList?.contains(spec.wrapperClass)) return false;
	return node.matches(spec.selector);
}

function everyNodeIsWrapOutput(
	nodes: NodeList,
	spec: OverwideWrapSpec,
): boolean {
	for (const node of Array.from(nodes)) {
		if (!isWrapperFor(node, spec) && !isWrappedBy(node, spec)) return false;
	}
	return true;
}

/**
 * True when `record` mentions nothing but this module's own live-DOM output for
 * `spec`: a wrapper landing beside the node it wraps, or that node moving inside
 * it.
 *
 * An observer-driven caller re-runs {@link wrapOverwideInElement} on every
 * mutation tick, and the wrap itself inserts elements — so without this test the
 * pass retriggers the observer that scheduled it, converging only because the
 * wrap is idempotent. Ignoring the pass's own records is what removes the
 * retrigger; a PIE element that re-renders over its own subtree and drops the
 * wrapper is the case where absorbing it instead becomes a sustained loop.
 *
 * Conservative in the safe direction: anything it cannot account for reads as
 * foreign, which costs one extra pass and never a missed wrap.
 */
export function isOverwideWrapMutation(
	record: MutationRecord,
	spec: OverwideWrapSpec,
): boolean {
	if (record.type !== "childList") return false;
	return (
		everyNodeIsWrapOutput(record.addedNodes, spec) &&
		everyNodeIsWrapOutput(record.removedNodes, spec)
	);
}
