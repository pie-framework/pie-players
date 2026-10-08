/**
 * The tree read-aloud walks: the flat tree, which is the tree the page renders.
 *
 * An element with an open shadow root contributes that root's children in place
 * of its own light children, and a `<slot>` inside a shadow root contributes the
 * nodes assigned to it, flattened through nested slots, so a host's light
 * children are reached once, at the slot that renders them. Closed shadow roots
 * are invisible to script, so their hosts are walked as light DOM.
 *
 * Toolkit chrome is skipped wherever it appears: toolbars and tool elements
 * render their controls into open shadow roots, and descending into them would
 * read button labels as content. So are the empty `aria-hidden` anchors the
 * shells and the toolkit keep beside their slots, and elements whose text never
 * renders (`style`, `script`, `noscript`, `template`).
 *
 * Node types are compared as the spec's numbers, so this module reads no DOM
 * global, at import or at call time.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_FRAGMENT_NODE = 11;

const CHROME_TAGS = new Set([
	"pie-item-toolbar",
	"pie-section-toolbar",
	"pie-item-player-session-debugger",
]);
const CHROME_TAG_PREFIXES = ["pie-tool-", "pie-section-player-tools-"];
const UNRENDERED_TEXT_TAGS = new Set([
	"style",
	"script",
	"noscript",
	"template",
]);

export const isShadowRootNode = (
	node: Node | null | undefined,
): node is ShadowRoot =>
	!!node &&
	node.nodeType === DOCUMENT_FRAGMENT_NODE &&
	(node as Partial<ShadowRoot>).host?.nodeType === ELEMENT_NODE;

/** Toolbars, tool elements and debug panels: chrome around content, never content. */
export const isToolkitChromeElement = (element: Element): boolean => {
	const tag = element.localName?.toLowerCase() || "";
	if (CHROME_TAGS.has(tag)) return true;
	return CHROME_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
};

const isSkippedElement = (element: Element): boolean => {
	const tag = element.localName?.toLowerCase() || "";
	if (UNRENDERED_TEXT_TAGS.has(tag)) return true;
	if (isToolkitChromeElement(element)) return true;
	// A shell's anchor: an `aria-hidden` element at the top of a shadow root,
	// there to reach the host's context and holding nothing to read.
	return (
		isShadowRootNode(element.parentNode) &&
		element.getAttribute("aria-hidden") === "true"
	);
};

const slotFlattenedNodes = (slot: Element): Node[] | null => {
	if (!isShadowRootNode(slot.getRootNode?.())) return null;
	const assignedNodes = (slot as HTMLSlotElement).assignedNodes;
	if (typeof assignedNodes !== "function") return null;
	try {
		return assignedNodes.call(slot, { flatten: true });
	} catch {
		return null;
	}
};

/** `node`'s children in the flat tree, with skipped elements left out. */
export const flatTreeChildNodes = (node: Node): Node[] => {
	let children: ArrayLike<Node> = node.childNodes;
	if (node.nodeType === ELEMENT_NODE) {
		const element = node as Element;
		const shadowRoot = element.shadowRoot;
		if (shadowRoot) {
			children = shadowRoot.childNodes;
		} else if (element.localName?.toLowerCase() === "slot") {
			children = slotFlattenedNodes(element) ?? element.childNodes;
		}
	}
	const result: Node[] = [];
	for (const child of Array.from(children || [])) {
		if (child.nodeType === ELEMENT_NODE && isSkippedElement(child as Element)) {
			continue;
		}
		result.push(child);
	}
	return result;
};

/**
 * What a visitor returns: `"skip"` leaves the node's subtree out, `"stop"` ends
 * the walk, anything else descends.
 */
export type FlatTreeVisitResult = "skip" | "stop" | undefined;

/** Visits `root`'s flat-tree descendants in rendering order; `root` itself is not visited. */
export const walkFlatTree = (
	root: Node,
	visit: (node: Node) => FlatTreeVisitResult,
): void => {
	const descend = (node: Node): boolean => {
		for (const child of flatTreeChildNodes(node)) {
			const result = visit(child);
			if (result === "stop") return false;
			if (result === "skip") continue;
			if (!descend(child)) return false;
		}
		return true;
	};
	descend(root);
};

/** `root`'s text nodes in rendering order. */
export const flatTreeTextNodes = (root: Node): Text[] => {
	const nodes: Text[] = [];
	walkFlatTree(root, (node) => {
		if (node.nodeType === TEXT_NODE) nodes.push(node as Text);
		return undefined;
	});
	return nodes;
};

/** `textContent` over the flat tree: shadow content in, skipped elements out. */
export const flatTextContent = (root: Node): string =>
	flatTreeTextNodes(root)
		.map((node) => node.data)
		.join("");

/** Elements under `root` matching `selector`, in rendering order. */
export const flatQuerySelectorAll = (
	root: Node,
	selector: string,
): Element[] => {
	const matches: Element[] = [];
	walkFlatTree(root, (node) => {
		if (node.nodeType === ELEMENT_NODE && (node as Element).matches(selector)) {
			matches.push(node as Element);
		}
		return undefined;
	});
	return matches;
};

export const flatQuerySelector = (
	root: Node,
	selector: string,
): Element | null => {
	let match: Element | null = null;
	walkFlatTree(root, (node) => {
		if (node.nodeType === ELEMENT_NODE && (node as Element).matches(selector)) {
			match = node as Element;
			return "stop";
		}
		return undefined;
	});
	return match;
};

/**
 * `node`'s parent in the flat tree: the slot rendering it, else its parent, with
 * a shadow root standing for its host.
 */
export const flatTreeParentNode = (node: Node): Node | null => {
	const slot = (node as Partial<Element>).assignedSlot;
	if (slot) return slot;
	const parent = node.parentNode;
	if (isShadowRootNode(parent)) return parent.host;
	return parent;
};

export const flatTreeParentElement = (node: Node): Element | null => {
	let parent = flatTreeParentNode(node);
	while (parent && parent.nodeType !== ELEMENT_NODE) {
		parent = flatTreeParentNode(parent);
	}
	return parent as Element | null;
};

/** The nearest element at or above `node` in the flat tree that matches `selector`. */
export const flatTreeClosest = (
	node: Node,
	selector: string,
): Element | null => {
	let current: Element | null =
		node.nodeType === ELEMENT_NODE
			? (node as Element)
			: flatTreeParentElement(node);
	while (current) {
		if (current.matches(selector)) return current;
		current = flatTreeParentElement(current);
	}
	return null;
};

/**
 * `node`'s parent element, continuing from a shadow root to its host. This is the
 * chain inheritance follows (`lang`, regions an author marks up), and for slotted
 * content it stays in the light tree the author wrote.
 */
export const composedParentElement = (node: Node): Element | null => {
	if (node.parentElement) return node.parentElement;
	const parent = node.parentNode;
	return isShadowRootNode(parent) ? parent.host : null;
};

/**
 * The nearest element at or above `node` on the composed chain that matches
 * `selector`, or null. With `boundary`, the climb ends after testing it.
 */
export const composedClosest = (
	node: Node,
	selector: string,
	boundary?: Element | null,
): Element | null => {
	let current: Element | null =
		node.nodeType === ELEMENT_NODE
			? (node as Element)
			: composedParentElement(node);
	while (current) {
		if (current.matches(selector)) return current;
		if (boundary && current === boundary) return null;
		current = composedParentElement(current);
	}
	return null;
};

/** `contains` across shadow boundaries: whether `node` is `container` or below it. */
export const composedContains = (
	container: Node | null | undefined,
	node: Node | null | undefined,
): boolean => {
	if (!container || !node) return false;
	let current: Node | null = node;
	while (current) {
		if (current === container || container.contains(current)) return true;
		const root = current.getRootNode?.();
		current = isShadowRootNode(root) ? root.host : null;
	}
	return false;
};

/**
 * `node`, or the shadow host above it, that lies in the tree rooted at
 * `treeRoot`; null when `node` is not inside that tree at any depth.
 */
export const retargetToTree = (node: Node, treeRoot: Node): Node | null => {
	let current: Node | null = node;
	while (current) {
		const root = current.getRootNode?.();
		if (root === treeRoot) return current;
		current = isShadowRootNode(root) ? root.host : null;
	}
	return null;
};

/**
 * Whether the character at `offset` in `node` lies inside `range`. A live range
 * holds nodes of one tree only, so a node in a shadow tree below it counts as
 * inside when the range holds that tree's host whole.
 */
export const rangeHoldsTextPosition = (
	range: Range,
	node: Text,
	offset: number,
): boolean => {
	try {
		const treeRoot = range.startContainer.getRootNode?.();
		if (!treeRoot || node.getRootNode?.() === treeRoot) {
			return (
				range.comparePoint(node, offset) === 0 &&
				range.comparePoint(node, Math.min(offset + 1, node.length)) === 0
			);
		}
		return rangeHoldsNodeWhole(range, retargetToTree(node, treeRoot));
	} catch {
		return false;
	}
};

/** Whether `range` intersects `node`, counting a shadow tree below the range as {@link rangeHoldsTextPosition} does. */
export const rangeIntersectsComposedNode = (
	range: Range,
	node: Node,
): boolean => {
	try {
		const treeRoot = range.startContainer.getRootNode?.();
		if (!treeRoot || node.getRootNode?.() === treeRoot) {
			return range.intersectsNode(node);
		}
		return rangeHoldsNodeWhole(range, retargetToTree(node, treeRoot));
	} catch {
		return false;
	}
};

const rangeHoldsNodeWhole = (range: Range, node: Node | null): boolean => {
	const parent = node?.parentNode;
	if (!node || !parent) return false;
	const index = Array.prototype.indexOf.call(parent.childNodes, node);
	if (index < 0) return false;
	return (
		range.comparePoint(parent, index) === 0 &&
		range.comparePoint(parent, index + 1) === 0
	);
};
