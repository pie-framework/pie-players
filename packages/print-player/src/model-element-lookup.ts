import type { Model } from "./types.js";

/**
 * Resolve a rendered model by exact custom-element tag and contract ID.
 *
 * Model IDs are authored-content keys, not CSS selectors. Keeping the query
 * static avoids selector injection and supports valid IDs containing quotes,
 * brackets, or other CSS-significant characters without rewriting them.
 */
export function findRenderedModelElement(
	root: ParentNode,
	model: Pick<Model, "element" | "id">,
): HTMLElement | null {
	for (const candidate of root.querySelectorAll<HTMLElement>("[id]")) {
		if (
			candidate.localName === model.element &&
			candidate.getAttribute("id") === model.id
		) {
			return candidate;
		}
	}
	return null;
}
