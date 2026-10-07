/**
 * The content a container holds in the flattened tree: its light descendants,
 * the open shadow roots among them, and the elements assigned to every slot in
 * either. Web components put that content outside the tree a selector or a
 * `MutationObserver` on the container covers: `<pie-section-player-base>` renders
 * the toolkit in its shadow root and slots its items into it, so the toolkit's
 * own subtree holds a `<slot>` and none of the items.
 *
 * Duck-typed rather than `instanceof`: the legacy players' tests run on
 * Stencil's mock DOM, where a mounted element is no instance of the globals.
 * Closed shadow roots are invisible to script and stay out.
 */

export type FlattenedTreeRoot = Element | ShadowRoot;

/** `node`'s open shadow root, where its flattened tree continues. */
export function openShadowRootOf(node: unknown): ShadowRoot | null {
	return (
		(node as { shadowRoot?: ShadowRoot | null } | null)?.shadowRoot ?? null
	);
}

/** The elements `element` shows when it is a slot, nested slots resolved. */
export function slottedElementsOf(element: Element): Element[] {
	const slot = element as HTMLSlotElement;
	if (typeof slot.assignedElements !== "function") return [];
	try {
		return slot.assignedElements({ flatten: true });
	} catch {
		return [];
	}
}

export interface FlattenedTreeObserverOptions {
	/** Attributes whose change reports the element that changed. */
	attributeFilter?: string[];
}

/**
 * Reports content as it enters `root`'s flattened tree: `root` itself at once,
 * then each added subtree, newly attached open shadow root and newly slotted
 * element, and each element whose `attributeFilter` attribute changes. A
 * reported node stands for its whole subtree; content an earlier report already
 * covers is not reported again. A shadow root its host attaches after entering
 * the tree is not seen. Returns the function that stops observing.
 */
export function observeFlattenedTree(
	root: FlattenedTreeRoot,
	onChange: (node: FlattenedTreeRoot) => void,
	options: FlattenedTreeObserverOptions = {},
): () => void {
	if (typeof MutationObserver === "undefined") return () => {};
	const { attributeFilter } = options;
	const roots = new Set<FlattenedTreeRoot>();

	const covered = (node: FlattenedTreeRoot): boolean => {
		for (const observed of roots) {
			if (observed !== node && observed.contains(node)) return true;
		}
		return false;
	};

	// `node` and its subtree are in view: report them, and take in what the
	// shadow roots and slots among them hold.
	const enter = (node: FlattenedTreeRoot): void => {
		onChange(node);
		const elements = node.querySelectorAll("*");
		for (const element of [
			...(node.nodeType === Node.ELEMENT_NODE ? [node as Element] : []),
			...elements,
		]) {
			const shadowRoot = openShadowRootOf(element);
			if (shadowRoot) observe(shadowRoot);
			if (element.localName === "slot") follow(element);
		}
	};

	const follow = (slot: Element): void => {
		for (const assigned of slottedElementsOf(slot)) observe(assigned);
	};

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "attributes") {
				onChange(record.target as Element);
				continue;
			}
			for (const node of record.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) enter(node as Element);
			}
		}
	});

	const onSlotChange = (event: Event): void => {
		follow(event.target as Element);
	};

	function observe(node: FlattenedTreeRoot): void {
		if (roots.has(node) || covered(node)) return;
		roots.add(node);
		observer.observe(node, {
			childList: true,
			subtree: true,
			...(attributeFilter ? { attributes: true, attributeFilter } : {}),
		});
		node.addEventListener("slotchange", onSlotChange);
		enter(node);
	}

	observe(root);

	return () => {
		observer.disconnect();
		for (const node of roots) {
			node.removeEventListener("slotchange", onSlotChange);
		}
		roots.clear();
	};
}
