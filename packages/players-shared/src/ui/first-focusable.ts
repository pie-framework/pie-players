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
