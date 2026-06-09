/**
 * Wraps authored `<table>` elements with a horizontally scrollable container so
 * tables that are wider than their column surface a scrollbar instead of being
 * clipped by ancestor `overflow-x: hidden` regions.
 *
 * The wrapper is rendered as
 * `<div class="pie-table-scroll" tabindex="0" role="region" aria-label="...">`
 * and receives the accompanying CSS from `@pie-players/pie-theme`. The CSS uses
 * `overflow-x: auto` so narrow tables stay visually unchanged: a scrollbar only
 * appears when the table's intrinsic width exceeds the wrapper's available
 * space (including at higher browser-zoom levels — WCAG 1.4.10 Reflow at 400%
 * zoom is the same driver as for `wrapOverwideImages`).
 *
 * Two callable surfaces share the same wrapping logic:
 *
 * - `wrapOverwideTables(markup)` — string-in / string-out, used as a
 *   post-sanitization step inside `sanitizeItemMarkup`. By design it skips
 *   tables inside `pie-*` elements; those are the element's own template and
 *   should not be restructured by the authored-markup pipeline.
 * - `wrapOverwideTablesInElement(root)` — operates on a live DOM subtree.
 *   Used by the post-render pass in `PieItemPlayer.svelte` so that tables a
 *   PIE element paints into its own light DOM (e.g. a `pie-passage`'s
 *   model-driven content) get the same scrollable affordance even though
 *   they never appeared in the authored markup string.
 */

const SCROLL_WRAPPER_CLASS = "pie-table-scroll";
const PIE_CUSTOM_ELEMENT_TAG_REGEX = /^pie-/i;

function isInsidePieCustomElement(table: Element, root: Element): boolean {
	let ancestor: Element | null = table.parentElement;
	while (ancestor && ancestor !== root) {
		if (PIE_CUSTOM_ELEMENT_TAG_REGEX.test(ancestor.tagName)) {
			return true;
		}
		ancestor = ancestor.parentElement;
	}
	return false;
}

function buildAriaLabel(table: Element): string {
	// Authors commonly label tables via <caption>, aria-label, or aria-labelledby.
	// Prefer the most explicit signal and fall back to the generic label so
	// every wrapper still announces itself as a region.
	const ariaLabel = table.getAttribute("aria-label");
	if (ariaLabel?.trim()) {
		return `Scrollable table: ${ariaLabel.trim()}`;
	}
	const labelledBy = table.getAttribute("aria-labelledby");
	if (labelledBy?.trim()) {
		const ownerDocument = table.ownerDocument;
		const ids = labelledBy.trim().split(/\s+/);
		const labels: string[] = [];
		for (const id of ids) {
			const labelEl = ownerDocument?.getElementById(id);
			const text = labelEl?.textContent?.trim();
			if (text) labels.push(text);
		}
		if (labels.length > 0) {
			return `Scrollable table: ${labels.join(" ")}`;
		}
	}
	const caption = table.querySelector("caption");
	const captionText = caption?.textContent?.trim();
	if (captionText) {
		return `Scrollable table: ${captionText}`;
	}
	return "Scrollable table";
}

export interface WrapOverwideTablesInElementOptions {
	/**
	 * When `true`, tables whose nearest `pie-*` ancestor is *strictly between*
	 * the table and `root` are left alone. Used by the string pipeline so the
	 * authored-markup pass doesn't restructure a PIE element's own template.
	 * Defaults to `false` so the live-DOM pass *does* wrap element-rendered
	 * tables.
	 */
	skipPieDescendants?: boolean;
}

/**
 * Wrap every unwrapped `<table>` descendant of `root` with the shared
 * horizontal-scroll div. Returns the number of newly-wrapped tables so
 * callers can short-circuit when nothing changed. Idempotent.
 */
export function wrapOverwideTablesInElement(
	root: Element,
	options: WrapOverwideTablesInElementOptions = {},
): number {
	const { skipPieDescendants = false } = options;
	const tables = Array.from(root.querySelectorAll("table"));
	if (tables.length === 0) return 0;

	const ownerDocument = root.ownerDocument;
	if (!ownerDocument) return 0;

	let wrapped = 0;
	for (const table of tables) {
		const parent = table.parentElement;
		if (!parent) continue;

		// Idempotency — already wrapped.
		if (parent.classList && parent.classList.contains(SCROLL_WRAPPER_CLASS)) {
			continue;
		}

		// Authored-markup pass: leave PIE custom-element internals alone.
		if (skipPieDescendants && isInsidePieCustomElement(table, root)) continue;

		const wrapper = ownerDocument.createElement("div");
		wrapper.className = SCROLL_WRAPPER_CLASS;
		wrapper.setAttribute("tabindex", "0");
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute("aria-label", buildAriaLabel(table));

		parent.insertBefore(wrapper, table);
		wrapper.appendChild(table);
		wrapped += 1;
	}
	return wrapped;
}

export function wrapOverwideTables(markup: string): string {
	if (!markup) return "";

	// Fast path: avoid the DOM round-trip entirely when the markup carries no
	// tables. Keeps the sanitize pipeline cheap for the common case.
	if (!/<table\b/i.test(markup)) return markup;

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

	const wrapped = wrapOverwideTablesInElement(body, {
		skipPieDescendants: true,
	});
	return wrapped > 0 ? body.innerHTML : markup;
}
