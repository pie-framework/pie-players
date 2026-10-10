import {
	composedContains,
	findShellScopeHost,
	isShadowRootNode,
	resolveContentRegion,
	retargetToTree,
} from "@pie-players/pie-assessment-toolkit/tools/registration";

type ComposedRangesSelection = Selection & {
	getComposedRanges?: (...args: unknown[]) => StaticRange[];
};

/** The selection the strip acts on: a live range, and the text it holds. */
export interface SelectionRead {
	range: Range;
	text: string;
}

/** The open shadow roots holding `nodes`, innermost first, each once. */
const shadowRootsHolding = (
	nodes: ReadonlyArray<Node | null | undefined>,
): ShadowRoot[] => {
	const roots: ShadowRoot[] = [];
	for (const node of nodes) {
		let root = node?.getRootNode?.();
		while (isShadowRootNode(root)) {
			if (!roots.includes(root)) roots.push(root);
			root = root.host.getRootNode?.();
		}
	}
	return roots;
};

const composedRangeOf = (
	selection: ComposedRangesSelection,
	shadowRoots: ShadowRoot[],
): StaticRange | null => {
	const getComposedRanges = selection.getComposedRanges;
	if (typeof getComposedRanges !== "function" || shadowRoots.length === 0) {
		return null;
	}
	try {
		return getComposedRanges.call(selection, { shadowRoots })[0] ?? null;
	} catch {
		// The first shipped signature took the roots as arguments.
		try {
			return getComposedRanges.call(selection, ...shadowRoots)[0] ?? null;
		} catch {
			return null;
		}
	}
};

/**
 * A live range over `composed`, whose ends may lie in different trees. A live
 * range holds one tree, so it ends where the start's tree does: before the
 * shadow host holding the end, or at the end of the shadow root holding the
 * start.
 */
const liveRangeFrom = (composed: StaticRange): Range | null => {
	const { startContainer, startOffset, endContainer, endOffset } = composed;
	const doc = startContainer.ownerDocument;
	if (!doc) return null;
	try {
		const range = doc.createRange();
		range.setStart(startContainer, startOffset);
		const startTree = startContainer.getRootNode();
		if (endContainer.getRootNode() === startTree) {
			range.setEnd(endContainer, endOffset);
			return range;
		}
		const endHost = retargetToTree(endContainer, startTree);
		if (endHost) {
			range.setEndBefore(endHost);
		} else if (isShadowRootNode(startTree)) {
			range.setEnd(startTree, startTree.childNodes.length);
		} else {
			return null;
		}
		return range;
	} catch {
		return null;
	}
};

/**
 * The current selection as a live range. Read through `getComposedRanges` when
 * the selection touches an open shadow root, because `getRangeAt` collapses a
 * selection that crosses a shadow boundary; `getRangeAt(0)` otherwise, and
 * wherever `getComposedRanges` is missing.
 */
export const readSelection = (selection: Selection): SelectionRead | null => {
	if (selection.rangeCount === 0) return null;
	const fallback = selection.getRangeAt(0);
	const composed = composedRangeOf(
		selection as ComposedRangesSelection,
		shadowRootsHolding([
			selection.anchorNode,
			selection.focusNode,
			fallback.startContainer,
			fallback.endContainer,
		]),
	);
	const live = composed ? liveRangeFrom(composed) : null;
	if (!composed || !live) {
		return { range: fallback, text: selection.toString() };
	}
	const withinOneTree =
		composed.startContainer.getRootNode() ===
		composed.endContainer.getRootNode();
	return {
		range: live,
		text: withinOneTree ? selection.toString() : live.toString(),
	};
};

/**
 * The content region holding `range`: the content region of the nearest shell
 * scope above its start, when that region holds its end as well. Null for a
 * range outside every shell, outside its shell's content region (a card's
 * header, lead surfaces or media), or running between regions.
 */
export const contentRegionHolding = (range: Range): Element | null => {
	const start = range.startContainer;
	const shell = findShellScopeHost(start);
	if (!shell) return null;
	const region = resolveContentRegion(shell, start);
	if (!composedContains(region, start)) return null;
	if (!composedContains(region, range.endContainer)) return null;
	return region;
};
