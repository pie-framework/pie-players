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
 *
 * The wrapping itself lives in `./wrap-overwide.js`, shared with the image
 * wrapper: only the four values below and the accessible name differ.
 */

import {
	isOverwideWrapMutation,
	type OverwideWrapSpec,
	type WrapOverwideOptions,
	wrapOverwideInElement,
	wrapOverwideMarkup,
} from "./wrap-overwide.js";

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

const TABLE_SPEC: OverwideWrapSpec = {
	selector: "table",
	wrapperTag: "div",
	wrapperClass: "pie-table-scroll",
	markupProbe: /<table\b/i,
	buildAriaLabel,
};

export type WrapOverwideTablesInElementOptions = WrapOverwideOptions;

/**
 * Wrap every unwrapped `<table>` descendant of `root` with the shared
 * horizontal-scroll div. Returns the number of newly-wrapped tables so
 * callers can short-circuit when nothing changed. Idempotent.
 */
export function wrapOverwideTablesInElement(
	root: Element,
	options: WrapOverwideTablesInElementOptions = {},
): number {
	return wrapOverwideInElement(root, TABLE_SPEC, options);
}

export function wrapOverwideTables(markup: string): string {
	return wrapOverwideMarkup(markup, TABLE_SPEC);
}

/**
 * True when `record` mentions nothing but the output of
 * {@link wrapOverwideTablesInElement} — a `pie-table-scroll` wrapper, or a
 * `<table>` moving inside one. An observer-driven caller ignores such a record
 * so its own wrap does not schedule a second pass.
 */
export function isOverwideTableWrapMutation(record: MutationRecord): boolean {
	return isOverwideWrapMutation(record, TABLE_SPEC);
}
