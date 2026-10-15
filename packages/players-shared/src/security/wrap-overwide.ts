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
 *
 * Content inside an editing host is never wrapped, on either pass. The editor
 * owns that DOM: ProseMirror reads the wrapper as a foreign mutation and redraws
 * the node without it, so an observer-driven wrap and the editor undo each other
 * for as long as the editor holds an image.
 */

const PIE_CUSTOM_ELEMENT_TAG_REGEX = /^pie-/i;

/**
 * An editing host: `contenteditable` in any state but `false`. A
 * `contenteditable="false"` island inside a host still belongs to the host's
 * editor — ProseMirror marks every leaf node that way, images included — so the
 * test looks past such islands to the nearest host. A read-only editor root
 * (`contenteditable="false"`) is no host; ProseMirror registers no DOM mutations
 * while its view is not editable.
 */
const EDITING_HOST_SELECTOR = '[contenteditable]:not([contenteditable="false" i])';

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
	/**
	 * An extra wrapper class carrying the node's own layout, or `null` for none.
	 * Absent when every wrapper lays out alike.
	 */
	layoutClass?: (node: Element) => string | null;
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

const VERTICAL_MARGINS = ["margin-top", "margin-bottom"] as const;

/**
 * Moves the node's inline vertical margins onto its wrapper. The wrapper clips
 * vertically — `overflow-x: auto` forces `overflow-y` off `visible` — so a
 * negative margin left on the node pulls its edge into the clipped band, and
 * the wrapper's own block formatting context stops a positive one collapsing
 * with its neighbours. On the wrapper, both lay out as they did unwrapped.
 * Horizontal margins stay: `margin: 0 auto` centres the node inside the wrapper.
 */
function liftVerticalMargins(node: Element, wrapper: HTMLElement): void {
	const style = (node as HTMLElement).style;
	if (!style) return;
	for (const property of VERTICAL_MARGINS) {
		const value = style.getPropertyValue(property);
		if (!value) continue;
		wrapper.style.setProperty(
			property,
			value,
			style.getPropertyPriority(property),
		);
		style.removeProperty(property);
	}
	if (!style.length) node.removeAttribute("style");
}

/**
 * Wrappers whose layout class was read from the live cascade. A wrapper built
 * off-document saw only its node's inline style, so the first live pass to meet
 * it reads the layout again; this set keeps that to once per wrapper.
 */
const liveLayoutRead = new WeakSet<Element>();

/**
 * Wrap every unwrapped match under `root`. Returns the number newly wrapped so
 * callers can short-circuit when nothing changed. Idempotent.
 *
 * Under a connected `root`, a wrapper whose layout was never read live gains
 * the layout class this pass would have given it.
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

	const readsLiveLayout =
		!!spec.layoutClass && !!ownerDocument.defaultView && root.isConnected;

	const targets: Element[] = [];
	const unread: Element[] = [];
	for (const node of nodes) {
		const parent = node.parentElement;
		if (!parent) continue;

		// Idempotency — already wrapped.
		const wrapped = parent.classList?.contains(spec.wrapperClass);
		if (wrapped && (!readsLiveLayout || liveLayoutRead.has(parent))) continue;

		// Authored-markup pass: leave PIE custom-element internals alone.
		if (skipPieDescendants && isInsidePieCustomElement(node, root)) continue;

		if (node.closest(EDITING_HOST_SELECTOR)) continue;

		if (!wrapped) targets.push(node);
		else if (!unread.some((other) => other.parentElement === parent))
			unread.push(node);
	}

	// Layout is read for every node before the first insertion: a read after a
	// wrap forces a fresh style resolution, one per node. A wrapper's own styles
	// override its node's layout — the theme makes every wrapped image a block —
	// so an existing wrapper is read with its classes lifted.
	const unreadWrappers = unread.map((node) => node.parentElement as Element);
	const liftedClasses = unreadWrappers.map((wrapper) => wrapper.className);
	for (const wrapper of unreadWrappers) wrapper.className = "";
	const layoutClasses = targets.map((node) => spec.layoutClass?.(node) ?? null);
	const unreadLayoutClasses = unread.map(
		(node) => spec.layoutClass?.(node) ?? null,
	);
	for (const [index, wrapper] of unreadWrappers.entries()) {
		wrapper.className = liftedClasses[index];
		const layoutClass = unreadLayoutClasses[index];
		if (layoutClass) wrapper.classList.add(layoutClass);
		liveLayoutRead.add(wrapper);
	}

	let wrapped = 0;
	for (const [index, node] of targets.entries()) {
		const parent = node.parentElement;
		if (!parent) continue;

		const wrapper = ownerDocument.createElement(spec.wrapperTag);
		const layoutClass = layoutClasses[index];
		wrapper.className = layoutClass
			? `${spec.wrapperClass} ${layoutClass}`
			: spec.wrapperClass;
		setRegion(wrapper, node, spec);
		if (readsLiveLayout) liveLayoutRead.add(wrapper);
		liftVerticalMargins(node, wrapper);

		parent.insertBefore(wrapper, node);
		wrapper.appendChild(node);
		wrapped += 1;
	}
	return wrapped;
}

function setRegion(wrapper: Element, node: Element, spec: OverwideWrapSpec) {
	wrapper.setAttribute("tabindex", "0");
	wrapper.setAttribute("role", "region");
	wrapper.setAttribute("aria-label", spec.buildAriaLabel(node));
}

function clearRegion(wrapper: Element) {
	wrapper.removeAttribute("tabindex");
	wrapper.removeAttribute("role");
	wrapper.removeAttribute("aria-label");
}

/**
 * Makes each wrapper a named, focusable region while its content overflows it
 * horizontally, and a plain container otherwise.
 *
 * A wrapper is built as a region, because a wrapper that scrolls must be
 * reachable by keyboard (WCAG 2.1.1) and markup wrapped off-document cannot be
 * measured. Most never scroll: a table that fits its column, a drag tile, a
 * layout table. Left as regions they add a tab stop and a landmark each, so the
 * live player measures every wrapper and keeps the region only where there is
 * something to scroll. Measurements are read for every wrapper before the first
 * write. A wrapper holding focus keeps its region, so a sync never drops focus.
 */
export function syncOverwideRegions(
	wrappers: Iterable<Element>,
	spec: OverwideWrapSpec,
): void {
	const measured: Array<[Element, boolean]> = [];
	for (const wrapper of wrappers) {
		if (!wrapper.isConnected) continue;
		if (!wrapper.classList.contains(spec.wrapperClass)) continue;
		measured.push([wrapper, wrapper.scrollWidth > wrapper.clientWidth]);
	}
	for (const [wrapper, scrolls] of measured) {
		const node = wrapper.firstElementChild;
		if (scrolls && node?.matches(spec.selector)) setRegion(wrapper, node, spec);
		else if (!scrolls && !isFocused(wrapper)) clearRegion(wrapper);
	}
}

function isFocused(element: Element): boolean {
	const root = element.getRootNode() as Document | ShadowRoot;
	return root.activeElement === element;
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
