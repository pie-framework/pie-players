import {
	composedClosest,
	flatQuerySelector,
} from "../services/tts/flat-tree.js";

/** Marks the part of a shell scope that holds the content tools read and annotate. */
export const CONTENT_REGION_SELECTOR = "[data-region='content']";

/** Marks the host of a shell scope (`<pie-item-shell>`, `<pie-passage-shell>`, `<pie-item-scope>`). */
export const SHELL_SCOPE_HOST_SELECTOR = "[data-pie-shell-root]";

/**
 * The content region of `scope` that tools read and annotate.
 *
 * With `target`, the region holding it: the nearest `data-region="content"`
 * element from `target` up to `scope`, climbing through shadow hosts. Otherwise,
 * or when `target` lies in none, `scope` itself when it is a content region,
 * else its first content region, else `scope`, so a scope that marks no region
 * is read whole. Resolved at each use, because a card renders its regions after
 * its tools connect.
 */
export const resolveContentRegion = (
	scope: Element,
	target?: Node | null,
): Element => {
	if (target) {
		const holding = composedClosest(target, CONTENT_REGION_SELECTOR, scope);
		if (holding) return holding;
	}
	if (scope.matches?.(CONTENT_REGION_SELECTOR)) return scope;
	return (
		scope.querySelector?.(CONTENT_REGION_SELECTOR) ??
		flatQuerySelector(scope, CONTENT_REGION_SELECTOR) ??
		scope
	);
};

/** The nearest shell scope host at or above `node`, climbing through shadow hosts. */
export const findShellScopeHost = (
	node: Node | null | undefined,
): Element | null =>
	node ? composedClosest(node, SHELL_SCOPE_HOST_SELECTOR) : null;
