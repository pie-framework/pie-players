/**
 * Selector for elements that are commonly keyboard-focusable in assessment UI.
 * Kept in sync with `focus-trap.ts` for consistent tab-order surfaces.
 */
export const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled]):not([type='hidden'])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[contenteditable]:not([contenteditable='false'])",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Whether `el` is a reasonable programmatic focus target (matches selector,
 * not disabled, not inside `inert`, and has a layout box).
 */
export function isProgrammaticFocusTarget(el: HTMLElement): boolean {
	if (!el.matches(FOCUSABLE_SELECTOR)) return false;
	if (el.hasAttribute("disabled")) return false;
	if (el.closest("[inert]")) return false;
	return el.offsetParent !== null || el.getClientRects().length > 0;
}

/**
 * Depth-first search for the first programmatically focusable element under
 * `root`, traversing **open** shadow roots. Closed shadow trees are opaque.
 */
export function queryFirstFocusableDeep(root: HTMLElement): HTMLElement | null {
	function walk(el: Element): HTMLElement | null {
		if (el instanceof HTMLElement && isProgrammaticFocusTarget(el)) {
			return el;
		}
		if (el.shadowRoot) {
			for (const child of el.shadowRoot.children) {
				if (child instanceof Element) {
					const hit = walk(child);
					if (hit) return hit;
				}
			}
		}
		for (const child of el.children) {
			if (child instanceof Element) {
				const hit = walk(child);
				if (hit) return hit;
			}
		}
		return null;
	}
	return walk(root);
}

/**
 * Focuses the first deep focusable under `root` and scrolls it into view.
 * @returns true when focus was moved to a descendant (or `root` if it matched).
 */
export function focusFirstFocusableInElement(root: HTMLElement): boolean {
	const target = queryFirstFocusableDeep(root);
	if (!target) return false;
	try {
		target.scrollIntoView({ block: "nearest", inline: "nearest" });
		target.focus();
		return true;
	} catch {
		return false;
	}
}
