/**
 * Item markup read as text, so summaries compute in Node as in the browser: where each element
 * tag sits, what lies outside them, and whether a fragment holds anything to show.
 */

export interface ElementOccurrence {
	tagName: string;
	id: string;
}

export interface ItemMarkup {
	/** Element tags, in document order. */
	elements: ElementOccurrence[];
	/** The markup with every element tag, and what it encloses, removed. */
	outside: string;
}

const ATTRIBUTE = String.raw`\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?`;
const TAG = new RegExp(String.raw`<(/?)([a-zA-Z][\w:.-]*)((?:${ATTRIBUTE})*)\s*(/?)>`, "g");
const ID = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

/**
 * Locates the tags of `elementTags` in `markup`. A tag's span runs to its matching close tag, or
 * ends at its open tag when it has none.
 */
export function readItemMarkup(markup: string, elementTags: ReadonlySet<string>): ItemMarkup {
	const elements: ElementOccurrence[] = [];
	let outside = "";
	let copiedTo = 0;
	// The element whose span is open, and how deep its own tag nests inside it.
	let open: { tagName: string; depth: number } | null = null;

	for (const match of markup.matchAll(TAG)) {
		const [text, closing, rawName, attributes, selfClosing] = match;
		const tagName = rawName.toLowerCase();
		const start = match.index;
		const end = start + text.length;
		if (open) {
			if (tagName !== open.tagName) continue;
			if (!closing) {
				if (!selfClosing) open.depth += 1;
				continue;
			}
			if (open.depth > 0) {
				open.depth -= 1;
				continue;
			}
			copiedTo = end;
			open = null;
			continue;
		}
		if (closing || !elementTags.has(tagName)) continue;
		const id = attributes.match(ID);
		elements.push({ tagName, id: id ? (id[1] ?? id[2] ?? id[3]) : "" });
		outside += markup.slice(copiedTo, start);
		copiedTo = end;
		if (!selfClosing) open = { tagName, depth: 0 };
	}
	// An element left unclosed spans its open tag only, where `copiedTo` already stands.
	outside += markup.slice(copiedTo);
	return { elements, outside };
}

const TAGS = /<[^>]*>/g;
const IMAGE = /<img\b/i;
const NBSP = /&nbsp;|&#160;|&#xa0;/gi;

/** Whether `html` holds text or an image once its tags and whitespace are stripped. */
export function hasContent(html: unknown): html is string {
	if (typeof html !== "string" || html.length === 0) return false;
	if (IMAGE.test(html)) return true;
	return /\S/.test(html.replace(TAGS, "").replace(NBSP, " "));
}
