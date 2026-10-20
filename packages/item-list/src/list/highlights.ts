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
// Elements that break the text, so their neighbours' words do not run together.
const BREAKING = new Set([
	"address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt", "figcaption", "figure",
	"footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "ol", "p", "pre", "section",
	"table", "td", "th", "tr", "ul",
]);
// Markup left in a snippet's text once parsed: an engine that encodes a field holding HTML returns it
// as entities.
const ENCODED_TAG = /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>/;

/**
 * The text of an HTML snippet, split at its `<mark>` elements. Parsed inert; every other tag is
 * dropped. A snippet whose text still holds tags, because the engine entity-encoded an HTML field,
 * is parsed once more, so the reader sees its text and not its markup.
 */
export function highlightSegments(snippet: string): HighlightSegment[] {
	const segments = parseSegments(snippet);
	if (!ENCODED_TAG.test(segments.map((segment) => segment.text).join(""))) return segments;
	return parseSegments(
		segments.map((segment) => (segment.mark ? `<mark>${segment.text}</mark>` : segment.text)).join(""),
	);
}

function parseSegments(snippet: string): HighlightSegment[] {
	const body = new DOMParser().parseFromString(withoutCutTag(snippet), "text/html").body;
	const segments: HighlightSegment[] = [];
	const append = (text: string, mark: boolean): void => {
		const last = segments.at(-1);
		if (last && last.mark === mark) last.text += text;
		else segments.push({ text, mark });
	};
	const separate = (): void => {
		const last = segments.at(-1);
		if (last && !/\s$/.test(last.text)) append(" ", false);
	};
	const walk = (node: Node, mark: boolean): void => {
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = child.textContent ?? "";
				if (text) append(text, mark);
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const tag = (child as Element).localName;
			if (SKIPPED.has(tag)) continue;
			const breaks = BREAKING.has(tag);
			if (breaks) separate();
			walk(child, mark || tag === "mark");
			if (breaks) separate();
		}
	};
	walk(body, false);
	return segments;
}

/**
 * `snippet` without the tail of a tag the engine's fragmenter cut through at its start, such as
 * `class="x">` or `p>`; the parser would show it as text. A cut at the end is dropped by the parser.
 */
function withoutCutTag(snippet: string): string {
	const cut = /^([^<>]*)>/.exec(snippet);
	if (!cut) return snippet;
	const tail = cut[1].trim();
	return /[="']/.test(tail) || /^\/?[A-Za-z][\w:-]*\s*\/?$/.test(tail) ? snippet.slice(cut[0].length) : snippet;
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
