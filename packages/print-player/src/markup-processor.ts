/**
 * Markup Processing
 *
 * Handles parsing and transforming HTML markup to replace interactive element tags
 * with print-specific tags.
 *
 * Ported from pie-print-support/src/pie-print.ts
 */

import {
	createDefaultItemMarkupSanitizer,
	type ItemMarkupSanitizer,
} from "@pie-players/pie-players-shared/security";

import type {
	Elements,
	Item,
	Model,
	NodeResult,
	PkgResolution,
} from "./types.js";

/**
 * Markup-handling options threaded down from `<pie-print>`.
 */
export interface MarkupOptions {
	/**
	 * Skip sanitization and render authored markup as-is. Opt-in only — the
	 * host is asserting the markup is trusted.
	 */
	trustMarkup?: boolean;
	/** Host-supplied sanitizer, used instead of the default. */
	sanitize?: ItemMarkupSanitizer;
}

/**
 * The print pipeline's custom-element allow-list.
 *
 * The shared sanitizer only keeps `pie-*` custom elements by default, but print
 * markup is built from `@pie-element/*` tags (`multiple-choice`, ...) and their
 * hashed print variants. Both have to be allow-listed or sanitizing would strip
 * every interactive element out of the print output.
 */
const allowedPrintElements = (resolutions: PkgResolution[]): string[] => {
	const out = new Set<string>();
	resolutions.forEach((r) => {
		if (r.tagName) out.add(r.tagName.toLowerCase());
		if (r.printTagName) out.add(r.printTagName.toLowerCase());
	});
	return [...out];
};

/**
 * Sanitize authored markup before it is parsed and injected.
 *
 * `wrapOverwideContent: false` because the shared wrappers are `overflow-x:
 * auto` screen affordances; `overflow` clips rather than scrolls in print media,
 * which would cut off wide images and tables.
 */
const sanitizeMarkup = (
	markup: string,
	resolutions: PkgResolution[],
	options: MarkupOptions,
): string => {
	if (!markup) return "";
	if (options.trustMarkup) return markup;
	if (options.sanitize) return options.sanitize(markup);
	return createDefaultItemMarkupSanitizer({
		allowedCustomElements: allowedPrintElements(resolutions),
		wrapOverwideContent: false,
	})(markup);
};

/**
 * Create an item with print-specific tags for floater elements (not in markup)
 *
 * @param models - Element models
 * @param resolutions - Package resolutions
 * @param elements - Element package map
 * @returns Item with markup containing floater elements
 */
export const mkItem = (
	models: Model[],
	resolutions: PkgResolution[],
	elements: Elements,
): Item => {
	const f = document.createDocumentFragment();

	models.forEach((o) => {
		const res = resolutions.find(
			(r) => r.tagName === o.element || r.printTagName === o.element,
		);
		if (res) {
			o.element = res.printTagName!;
			const node = document.createElement(res.printTagName!);
			node.setAttribute("id", o.id);
			f.appendChild(node);
		}
	});

	const root = document.createElement("div");
	root.appendChild(f);
	return { markup: root.innerHTML, models, elements };
};

/**
 * Parse the markup and replace default element tags with print element tags
 *
 * Markup is sanitized first unless the host opts out via `trustMarkup`.
 *
 * Authored attributes and children are preserved on the swapped element; only
 * `id`, `pie-id`, and `data-original-tag` are set by this function.
 *
 * @param markup - Original HTML markup
 * @param resolutions - Package resolutions with print tag names
 * @param options - Sanitization options
 * @returns Transformed HTML and list of found nodes
 */
export const processMarkup = (
	markup: string,
	resolutions: PkgResolution[],
	options: MarkupOptions = {},
): { html: string; nodes: NodeResult[] } => {
	const p = new DOMParser();

	try {
		const doc = p.parseFromString(
			sanitizeMarkup(markup, resolutions, options),
			"text/html",
		);
		const results: NodeResult[] = [];

		resolutions.forEach((r) => {
			const nl = doc.body.querySelectorAll(r.tagName);
			nl.forEach((n) => {
				if (!r.printTagName) {
					throw new Error("Missing a printTagName");
				}
				const id = n.getAttribute("id");
				const pieId = n.getAttribute("pie-id") || id;
				const originalTag = n.tagName.toLowerCase();

				if (id) {
					const newEl = document.createElement(r.printTagName);

					// Carry over every authored attribute. `class` in particular holds
					// print-only styling hooks (`.noprint` / `.kds-noprint`), and
					// `lang`, `dir`, `aria-*`, and `data-*` are authoring contract
					// surface that must not be dropped by the tag swap.
					Array.from(n.attributes).forEach((attr) => {
						newEl.setAttribute(attr.name, attr.value);
					});

					// Set last so the attributes this function owns win over any
					// authored value of the same name.
					newEl.setAttribute("id", id);
					newEl.setAttribute("pie-id", pieId || "");
					newEl.setAttribute("data-original-tag", originalTag);

					// Move authored children across rather than dropping them. Snapshot
					// the list first, since appending detaches from the live NodeList.
					// Moving (not cloning) keeps nested interactive elements reachable
					// for the remaining resolutions' queries.
					newEl.append(...Array.from(n.childNodes));

					n.parentNode?.replaceChild(newEl, n);
					results.push({ id, pieId, originalTag });
				}
			});
		});

		return { html: doc.body.innerHTML, nodes: results };
	} catch (e) {
		throw new Error(`Failed to parse the markup - is it valid html: ${markup}`);
	}
};

/**
 * Create a print item and separate floater elements
 *
 * Embedded elements (in markup) go into the main item.
 * Floater elements (not in markup, like rubrics) are separated.
 *
 * @param item - Original item configuration
 * @param resolutions - Package resolutions
 * @param options - Sanitization options
 * @returns Transformed print item and floater item
 */
export const printItemAndFloaters = (
	item: Item,
	resolutions: PkgResolution[],
	options: MarkupOptions = {},
): { item: Item; floaters: Model[] } => {
	const r = processMarkup(item.markup, resolutions, options);

	const { embedded, floaters } = item.models.reduce(
		(acc, m) => {
			const inMarkup = r.nodes.some((n) => n.id === m.id);
			if (inMarkup) {
				acc.embedded.push(m);
			} else {
				acc.floaters.push(m);
			}
			return acc;
		},
		{ embedded: [] as Model[], floaters: [] as Model[] },
	);

	return {
		item: {
			markup: r.html,
			elements: Object.entries(item.elements).reduce<Elements>(
				(acc, [key, value]) => {
					const res = resolutions.find((r) => r.tagName === key);
					if (!res || !res.printTagName) {
						throw new Error(`cant find resolution for element: ${key}`);
					}
					acc[res.printTagName] = value;
					return acc;
				},
				{},
			),
			models: embedded.map((m) => {
				const res = resolutions.find((r) => r.tagName === m.element);
				if (!res || !res.printTagName) {
					throw new Error(`cant find resolution for element: ${m.element}`);
				}
				return { ...m, element: res?.printTagName };
			}),
		},
		floaters,
	};
};
