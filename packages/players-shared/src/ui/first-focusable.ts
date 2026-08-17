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
 * Whether `el` is in the sequential tab order.
 *
 * Stricter than {@link isProgrammaticFocusTarget}, which deliberately accepts
 * `tabindex="-1"`: such an element is a valid `focus()` target — a roving-tabindex
 * control or a landmark focused after a view change — but is explicitly not tabbable.
 * A tab order that included it would stop on elements the browser skips.
 */
export function isTabbable(el: HTMLElement): boolean {
	if (el.getAttribute("tabindex") === "-1") return false;
	return isProgrammaticFocusTarget(el);
}

/**
 * Focusable descendants of `root` in tab order, descending into open shadow roots.
 *
 * `querySelectorAll` stops at a shadow boundary, which makes it the wrong tool for
 * collecting a tab order in this codebase: every tool renders into `shadow: "open"`,
 * so a container holding one has focusable content the selector cannot see. A focus
 * trap built on the flat query traps Tab in the host's own chrome and never reaches
 * the tool — the tool's controls are then unreachable by keyboard entirely.
 *
 * Closed shadow roots are invisible to script and are skipped; nothing can be done
 * for them from outside.
 */
export function collectFocusable(root: Element | ShadowRoot): HTMLElement[] {
	const found: HTMLElement[] = [];
	const visit = (node: Element | ShadowRoot): void => {
		for (const child of Array.from(node.children)) {
			if (!(child instanceof HTMLElement)) continue;
			// `inert` and its subtree take no focus, so there is nothing below to collect.
			if (child.hasAttribute("inert")) continue;
			if (isTabbable(child)) found.push(child);
			// A shadow host's own light children are slotted into its shadow tree, so the
			// shadow root is where tab order continues.
			if (child.shadowRoot) visit(child.shadowRoot);
			else visit(child);
		}
	};
	visit(root);
	return found;
}
