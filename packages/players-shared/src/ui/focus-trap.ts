import {
	FOCUSABLE_SELECTOR,
	isProgrammaticFocusTarget,
} from "./first-focusable.js";

type FocusTrapOptions = {
	initialFocus?: HTMLElement | null;
	onEscape?: () => void;
	/**
	 * When true (default), Tab from the last focusable wraps to the first and
	 * Shift+Tab from the first wraps to the last — appropriate for modal dialogs
	 * and popovers. When false, tab boundaries fall through to the browser's
	 * natural tab order, so users can step out of the container in either
	 * direction. Escape handling is unaffected.
	 */
	wrap?: boolean;
	/**
	 * Fires when Tab attempts to leave the trap from a boundary. Only invoked
	 * when `wrap` is false. The handler may call `event.preventDefault()` and
	 * move focus to a custom destination; otherwise the browser's natural tab
	 * order applies.
	 */
	onTabExit?: (direction: "forward" | "backward", event: KeyboardEvent) => void;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	).filter((el) => isProgrammaticFocusTarget(el));
}

function focusInitialTarget(
	container: HTMLElement,
	initialFocus?: HTMLElement | null,
): void {
	try {
		if (initialFocus && container.contains(initialFocus)) {
			initialFocus.focus();
			return;
		}
		const focusable = getFocusableElements(container);
		if (focusable.length > 0) {
			focusable[0].focus();
			return;
		}
		container.focus?.();
	} catch {
		// ignore
	}
}

/**
 * Focus trap helper for floating dialogs/panels.
 *
 * Keeps tab navigation contained, supports Escape callback,
 * and restores prior focus when the trap is removed.
 */
export function createFocusTrap(
	container: HTMLElement,
	options: FocusTrapOptions = {},
): () => void {
	const prev =
		typeof document !== "undefined"
			? (document.activeElement as HTMLElement | null)
			: null;
	const wrap = options.wrap ?? true;
	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			options.onEscape?.();
			return;
		}
		if (event.key !== "Tab") return;

		const focusable = getFocusableElements(container);
		if (!focusable.length) {
			if (!wrap) return;
			event.preventDefault();
			container.focus?.();
			return;
		}

		const current = document.activeElement as HTMLElement | null;
		const currentIndex = focusable.indexOf(current || focusable[0]);
		if (event.shiftKey) {
			if (currentIndex <= 0) {
				if (wrap) {
					event.preventDefault();
					focusable[focusable.length - 1].focus();
				} else {
					options.onTabExit?.("backward", event);
				}
			}
			return;
		}
		if (currentIndex === focusable.length - 1) {
			if (wrap) {
				event.preventDefault();
				focusable[0].focus();
			} else {
				options.onTabExit?.("forward", event);
			}
		}
	};

	queueMicrotask(() => focusInitialTarget(container, options.initialFocus));
	container.addEventListener("keydown", onKeydown);

	return () => {
		container.removeEventListener("keydown", onKeydown);
		try {
			prev?.focus?.();
		} catch {
			// ignore
		}
	};
}
