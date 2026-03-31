/**
 * Derive visual line box ranges inside a root element for TTS read-along.
 *
 * Cloud TTS (Polly, Google, etc.) only provides word/sentence character offsets.
 * “Lines” are layout-dependent (wrap, zoom, font size), so we compute them in
 * the browser from the same DOM Range already used for word highlighting.
 */

const LINE_TOP_EPSILON = 2;
const CARET_INSET = 1;
const HORIZONTAL_PROBE_STEP = 3;
const MAX_HORIZONTAL_PROBES = 400;
const MAX_LINE_RANGES = 48;

type DocumentWithCaret = Document & {
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
	caretPositionFromPoint?: (
		x: number,
		y: number,
	) => { offsetNode: Node; offset: number } | null;
};

function caretRangeAtPoint(doc: Document, x: number, y: number): Range | null {
	const d = doc as DocumentWithCaret;
	if (typeof d.caretRangeFromPoint === "function") {
		try {
			return d.caretRangeFromPoint(x, y);
		} catch {
			return null;
		}
	}
	const pos = d.caretPositionFromPoint?.(x, y);
	if (
		pos?.offsetNode?.nodeType === Node.TEXT_NODE ||
		pos?.offsetNode?.nodeType === Node.ELEMENT_NODE
	) {
		const r = doc.createRange();
		try {
			r.setStart(pos.offsetNode, pos.offset);
			r.collapse(true);
			return r;
		} catch {
			return null;
		}
	}
	return null;
}

function collapsedRangeTop(r: Range): number | null {
	const rects = r.getClientRects();
	if (rects.length === 0) return null;
	return rects[0].top;
}

/**
 * Intersect `range` with the contents of `root` (document order).
 * Returns null if there is no non-empty intersection.
 */
export function intersectRangeWithElement(
	range: Range,
	root: Element,
): Range | null {
	if (typeof document === "undefined") return null;
	if (typeof range.compareBoundaryPoints !== "function") return null;
	try {
		const doc = range.startContainer.ownerDocument || document;
		const rootRange = doc.createRange();
		rootRange.selectNodeContents(root);

		if (range.compareBoundaryPoints(Range.END_TO_START, rootRange) <= 0) {
			return null;
		}
		if (range.compareBoundaryPoints(Range.START_TO_END, rootRange) >= 0) {
			return null;
		}

		const out = doc.createRange();
		if (range.compareBoundaryPoints(Range.START_TO_START, rootRange) < 0) {
			out.setStart(rootRange.startContainer, rootRange.startOffset);
		} else {
			out.setStart(range.startContainer, range.startOffset);
		}
		if (range.compareBoundaryPoints(Range.END_TO_END, rootRange) > 0) {
			out.setEnd(rootRange.endContainer, rootRange.endOffset);
		} else {
			out.setEnd(range.endContainer, range.endOffset);
		}
		if (out.collapsed) return null;
		return out;
	} catch {
		return null;
	}
}

function lineKeyForRect(top: number): number {
	return Math.round(top / LINE_TOP_EPSILON);
}

function extendLineEdge(
	doc: Document,
	root: Element,
	refTop: number,
	midY: number,
	startX: number,
	rootLeft: number,
	rootRight: number,
	direction: "left" | "right",
): Range | null {
	let lastGood: Range | null = null;
	let x = startX;
	if (direction === "left") {
		for (let i = 0; i < MAX_HORIZONTAL_PROBES && x >= rootLeft + CARET_INSET; i++) {
			const cr = caretRangeAtPoint(doc, x, midY);
			if (!cr || !rootContainsNode(root, cr.startContainer)) break;
			const t = collapsedRangeTop(cr);
			if (t === null || Math.abs(t - refTop) > LINE_TOP_EPSILON) break;
			lastGood = cr.cloneRange();
			x -= HORIZONTAL_PROBE_STEP;
		}
	} else {
		for (let i = 0; i < MAX_HORIZONTAL_PROBES && x <= rootRight - CARET_INSET; i++) {
			const cr = caretRangeAtPoint(doc, x, midY);
			if (!cr || !rootContainsNode(root, cr.startContainer)) break;
			const t = collapsedRangeTop(cr);
			if (t === null || Math.abs(t - refTop) > LINE_TOP_EPSILON) break;
			lastGood = cr.cloneRange();
			x += HORIZONTAL_PROBE_STEP;
		}
	}
	return lastGood;
}

function rootContainsNode(root: Element, node: Node): boolean {
	if (typeof root.contains !== "function") return false;
	try {
		return root.contains(node);
	} catch {
		return false;
	}
}

function fallbackSingleRangeFromFocus(focus: Range): Range[] {
	try {
		const doc = focus.startContainer.ownerDocument || document;
		const r = doc.createRange();
		r.setStart(focus.startContainer, focus.startOffset);
		r.setEnd(focus.endContainer, focus.endOffset);
		return [r];
	} catch {
		return [];
	}
}

/**
 * Returns one Range per visual line that intersects `focus`, expanded to the
 * full width of each line within `root`. Falls back to `[intersectedFocus]`
 * when layout or caret APIs are unavailable.
 */
export function visualLineRangesForFocusInRoot(
	root: Element,
	focus: Range,
): Range[] {
	if (typeof document === "undefined") return [];
	if (!focus.startContainer) {
		return [];
	}

	const doc = focus.startContainer.ownerDocument || document;
	const intersected = intersectRangeWithElement(focus, root);
	if (!intersected) {
		return fallbackSingleRangeFromFocus(focus);
	}

	let rects: DOMRect[];
	try {
		rects = Array.from(intersected.getClientRects()).filter(
			(r) => r.width > 0 && r.height > 0,
		);
	} catch {
		return [intersected.cloneRange()];
	}
	if (rects.length === 0) {
		return [intersected.cloneRange()];
	}

	let rootBounds: DOMRect;
	try {
		rootBounds = root.getBoundingClientRect();
	} catch {
		return [intersected.cloneRange()];
	}
	const groups = new Map<number, DOMRect[]>();
	for (const rect of rects) {
		const key = lineKeyForRect(rect.top);
		const list = groups.get(key);
		if (list) list.push(rect);
		else groups.set(key, [rect]);
	}

	const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
	const out: Range[] = [];

	for (const key of sortedKeys) {
		if (out.length >= MAX_LINE_RANGES) break;
		const group = groups.get(key);
		if (!group?.length) continue;

		let sumTop = 0;
		let sumMid = 0;
		let minL = Infinity;
		let maxR = -Infinity;
		for (const r of group) {
			sumTop += r.top;
			sumMid += r.top + r.height / 2;
			minL = Math.min(minL, r.left);
			maxR = Math.max(maxR, r.right);
		}
		const refTop = sumTop / group.length;
		const midY = sumMid / group.length;

		const leftEdge = extendLineEdge(
			doc,
			root,
			refTop,
			midY,
			minL,
			rootBounds.left,
			rootBounds.right,
			"left",
		);
		const rightEdge = extendLineEdge(
			doc,
			root,
			refTop,
			midY,
			maxR,
			rootBounds.left,
			rootBounds.right,
			"right",
		);

		if (!leftEdge || !rightEdge) {
			const fallback = intersected.cloneRange();
			return [fallback];
		}

		const lineRange = doc.createRange();
		try {
			lineRange.setStart(leftEdge.startContainer, leftEdge.startOffset);
			lineRange.setEnd(rightEdge.startContainer, rightEdge.startOffset);
		} catch {
			return [intersected.cloneRange()];
		}

		if (lineRange.collapsed) {
			return [intersected.cloneRange()];
		}

		const clipped = intersectRangeWithElement(lineRange, root);
		if (clipped && !clipped.collapsed) {
			out.push(clipped);
		} else {
			return [intersected.cloneRange()];
		}
	}

	return out.length > 0 ? out : [intersected.cloneRange()];
}
