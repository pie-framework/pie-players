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
 * This helper runs as a post-sanitization step inside `sanitizeItemMarkup`, so
 * every host that renders authored markup through the shared
 * `pie-item-player` (including the section player) benefits uniformly.
 */

const PIE_CUSTOM_ELEMENT_TAG_REGEX = /^pie-/i;
const SCROLL_WRAPPER_CLASS = "pie-table-scroll";

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

	const tables = Array.from(body.querySelectorAll("table"));
	if (tables.length === 0) return markup;

	let mutated = false;
	for (const table of tables) {
		const parent = table.parentElement;
		if (!parent) continue;

		// Idempotency — already wrapped.
		if (
			parent.classList &&
			parent.classList.contains(SCROLL_WRAPPER_CLASS)
		) {
			continue;
		}

		// Leave PIE custom-element internals alone.
		if (isInsidePieCustomElement(table, body)) continue;

		const wrapper = doc.createElement("div");
		wrapper.className = SCROLL_WRAPPER_CLASS;
		wrapper.setAttribute("tabindex", "0");
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute("aria-label", buildAriaLabel(table));

		parent.insertBefore(wrapper, table);
		wrapper.appendChild(table);
		mutated = true;
	}

	return mutated ? body.innerHTML : markup;
}
