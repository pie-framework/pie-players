/**
 * Highlights painted through the CSS Custom Highlight API, drawn again over the
 * magnifier's copy. A highlight's ranges belong to the live document, so each
 * range is mapped onto the copy's nodes through the positions serialization
 * recorded, and the copy registers the result under the same name, where its
 * own `::highlight()` rules paint it.
 */

/** Where serialization wrote a node: its parent, and its index among the parent's written children. */
export interface NodePosition {
	parent: Node;
	index: number;
}

export interface CopyMap {
	/** The copy's node for a page node, or `null` when the copy does not hold it as it now is. */
	node(live: Node): Node | null;
	/** The copy's boundaries for a page range, or `null` when either end falls outside the copy. */
	range(live: AbstractRange): StaticRangeInit | null;
}

const isShadowRoot = (node: Node): node is ShadowRoot =>
	node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in node;

const sameNode = (live: Node, copy: Node) => {
	if (live.nodeType !== copy.nodeType) return false;
	if (live.nodeType === Node.TEXT_NODE) return (live as Text).data === (copy as Text).data;
	const element = live as Element;
	const copied = copy as Element;
	return element.localName === copied.localName && element.namespaceURI === copied.namespaceURI;
};

/**
 * Maps page nodes onto a copy parsed from their serialization. A node is found
 * by its index among its parent's written children, and kept only when it is
 * the same kind of node, with the same text: where the parser restructured
 * markup the DOM held (a block inside a `<p>`, say), the nodes it moved are not
 * found rather than mistaken for others.
 */
export function createCopyMap(
	positions: Map<Node, NodePosition>,
	liveBody: Node | null,
	copy: Document,
): CopyMap {
	const written = new Map<Node, Node[]>();
	const found = new Map<Node, Node | null>();

	/** A copy parent's children as serialization wrote them, without the separators between text nodes. */
	const writtenChildren = (parent: Node) => {
		let list = written.get(parent);
		if (!list) {
			list = Array.from(parent.childNodes).filter((child) => child.nodeType !== Node.COMMENT_NODE);
			written.set(parent, list);
		}
		return list;
	};

	/** The copy's counterpart of a page node that holds children. */
	const container = (live: Node): Node | null => {
		if (live === liveBody) return copy.body;
		if (isShadowRoot(live)) {
			const host = node(live.host);
			return host ? (host as Element).shadowRoot : null;
		}
		return node(live);
	};

	function node(live: Node): Node | null {
		let candidate = found.get(live);
		if (candidate === undefined) {
			const position = positions.get(live);
			const parent = position ? container(position.parent) : null;
			candidate = (position && parent && writtenChildren(parent)[position.index]) || null;
			found.set(live, candidate);
		}
		// Compared on every lookup: an edit made since the copy was taken moves
		// the offsets a range holds.
		return candidate && sameNode(live, candidate) ? candidate : null;
	}

	const beside = (copied: Node | null, after: number): [Node, number] | null => {
		const parent = copied?.parentNode;
		if (!copied || !parent) return null;
		return [parent, Array.prototype.indexOf.call(parent.childNodes, copied) + after];
	};

	const boundary = (live: Node, offset: number): [Node, number] | null => {
		if (live.nodeType === Node.TEXT_NODE) {
			const text = node(live);
			return text ? [text, offset] : null;
		}
		// A boundary between children: before the first written child from the
		// offset on, or after the last one before it.
		const kids = live.childNodes;
		for (let i = offset; i < kids.length; i++) {
			if (positions.has(kids[i])) return beside(node(kids[i]), 0);
		}
		for (let i = Math.min(offset, kids.length) - 1; i >= 0; i--) {
			if (positions.has(kids[i])) return beside(node(kids[i]), 1);
		}
		const parent = container(live);
		return parent ? [parent, 0] : null;
	};

	return {
		node,
		range(live) {
			const start = boundary(live.startContainer, live.startOffset);
			const end = start && boundary(live.endContainer, live.endOffset);
			if (!start || !end) return null;
			return {
				startContainer: start[0],
				startOffset: start[1],
				endContainer: end[0],
				endOffset: end[1],
			};
		},
	};
}

/** The page's highlights as a flat list, which any change to them changes. */
export function highlightSignature(registry: HighlightRegistry): unknown[] {
	const signature: unknown[] = [];
	registry.forEach((highlight, name) => {
		signature.push(name, highlight.priority, highlight.type);
		highlight.forEach((range) => {
			signature.push(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
		});
	});
	return signature;
}

export const sameSignature = (a: unknown[], b: unknown[]) =>
	a.length === b.length && a.every((value, i) => value === b[i]);

const rangeIn = (copy: Document, bounds: StaticRangeInit): Range | null => {
	try {
		const range = copy.createRange();
		range.setStart(bounds.startContainer, bounds.startOffset);
		range.setEnd(bounds.endContainer, bounds.endOffset);
		return range;
	} catch {
		return null;
	}
};

/** Replaces the copy's highlights with the page's, mapped onto the copy. */
export function paintHighlights(registry: HighlightRegistry, map: CopyMap, copyWindow: Window) {
	const view = copyWindow as Window & typeof globalThis;
	const copyRegistry = view.CSS?.highlights;
	if (!copyRegistry || typeof view.Highlight !== "function") return;
	copyRegistry.clear();
	registry.forEach((highlight, name) => {
		const ranges: Range[] = [];
		highlight.forEach((range) => {
			const bounds = map.range(range);
			const copied = bounds && rangeIn(view.document, bounds);
			if (copied) ranges.push(copied);
		});
		if (ranges.length === 0) return;
		const copied = new view.Highlight(...ranges);
		copied.priority = highlight.priority;
		copied.type = highlight.type;
		copyRegistry.set(name, copied);
	});
}
