import { FOCUSABLE_SELECTOR, isProgrammaticFocusTarget } from "./first-focusable.js";

type FocusTrapOptions = {
	initialFocus?: HTMLElement | null;
	onEscape?: () => void;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
		isProgrammaticFocusTarget(el),
	);
}

function focusInitialTarget(container: HTMLElement, initialFocus?: HTMLElement | null): void {
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
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): () => void {
	const prev =
		typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			options.onEscape?.();
			return;
		}
		if (event.key !== "Tab") return;

		const focusable = getFocusableElements(container);
		if (!focusable.length) {
			event.preventDefault();
			container.focus?.();
			return;
		}

		const current = document.activeElement as HTMLElement | null;
		const currentIndex = focusable.indexOf(current || focusable[0]);
		if (event.shiftKey) {
			if (currentIndex <= 0) {
				event.preventDefault();
				focusable[focusable.length - 1].focus();
			}
			return;
		}
		if (currentIndex === focusable.length - 1) {
			event.preventDefault();
			focusable[0].focus();
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
