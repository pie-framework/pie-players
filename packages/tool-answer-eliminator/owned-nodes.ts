/**
 * The nodes the eliminator adds to an element's markup: toggles, marks and
 * announcements. The core's observer ignores changes to them, and counts the
 * element's own structural changes as a reason to look for new choices; a
 * choice's name leaves them out.
 */
const owned = new WeakSet<Node>();

export function own<T extends Node>(node: T): T {
	owned.add(node);
	return node;
}

/** Whether `node` is, or lies inside, a node the eliminator added. */
export function isOwned(node: Node | null): boolean {
	for (let current = node; current; current = current.parentNode) {
		if (owned.has(current)) return true;
	}
	return false;
}
