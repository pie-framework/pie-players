import type { ItemListHighlight } from "./extension.js";

/** A run of snippet text; `mark` when the search engine marked it as a match. */
export interface HighlightSegment {
	text: string;
	mark: boolean;
}

export interface RenderedHighlight {
	label?: string;
	snippets: HighlightSegment[][];
}

// Elements whose text is not prose, so it never reaches a snippet.
const SKIPPED = new Set(["script", "style", "template", "noscript", "title"]);

/** The text of an HTML snippet, split at its `<mark>` elements. Parsed inert; every other tag is dropped. */
export function highlightSegments(snippet: string): HighlightSegment[] {
	const body = new DOMParser().parseFromString(snippet, "text/html").body;
	const segments: HighlightSegment[] = [];
	const walk = (node: Node, mark: boolean): void => {
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = child.textContent ?? "";
				if (!text) continue;
				const last = segments.at(-1);
				if (last && last.mark === mark) last.text += text;
				else segments.push({ text, mark });
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const tag = (child as Element).localName;
			if (SKIPPED.has(tag)) continue;
			walk(child, mark || tag === "mark");
		}
	};
	walk(body, false);
	return segments;
}

const plain = (segments: HighlightSegment[]) =>
	segments
		.map((segment) => segment.text)
		.join("")
		.replace(/\s+/g, " ")
		.trim();

/**
 * The highlights to show: each snippet once, under the first field that carries its text, so an
 * engine that matches one sentence in several indexed fields shows it once. Empty snippets and
 * fields left with none are dropped.
 */
export function renderHighlights(highlights: readonly ItemListHighlight[] | undefined): RenderedHighlight[] {
	if (!Array.isArray(highlights)) return [];
	const seen = new Set<string>();
	const rendered: RenderedHighlight[] = [];
	for (const match of highlights) {
		if (!match || !Array.isArray(match.snippets)) continue;
		const snippets: HighlightSegment[][] = [];
		for (const snippet of match.snippets) {
			if (typeof snippet !== "string") continue;
			const segments = highlightSegments(snippet);
			const text = plain(segments);
			if (!text || seen.has(text)) continue;
			seen.add(text);
			snippets.push(segments);
		}
		if (snippets.length === 0) continue;
		const label = typeof match.label === "string" && match.label.trim() ? match.label.trim() : undefined;
		rendered.push({ label, snippets });
	}
	return rendered;
}
