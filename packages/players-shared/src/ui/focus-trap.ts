import { collectFocusable } from "./first-focusable.js";

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

/**
 * Shadow-aware: a trapped panel almost always hosts a custom element rendering into
 * `shadow: "open"`, and a flat `querySelectorAll` would collect only the panel's own
 * chrome — trapping Tab there and leaving the hosted tool's controls unreachable.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return collectFocusable(container);
}

function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
	let active: Element | null = root.activeElement;
	while (active?.shadowRoot?.activeElement) {
		active = active.shadowRoot.activeElement;
	}
	return active;
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
			? (getDeepActiveElement(document) as HTMLElement | null)
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

		const rootNode = container.getRootNode();
		const current = getDeepActiveElement(
			rootNode instanceof ShadowRoot ? rootNode : document,
		) as HTMLElement | null;
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

/**
 * Returns focus to where it was before a tool took it, for a tool that closes
 * itself: the tool's element leaves the DOM on close, which drops focus to the
 * document body. `capture` runs as the tool takes focus and `restore` as it
 * closes, before its element goes.
 */
export function createFocusReturn(): {
	/** Records the focused element, unless focus is already inside `container`. */
	capture: (container: Node) => void;
	/** Focuses the recorded element, if it is still in the document. */
	restore: () => void;
} {
	let opener: HTMLElement | null = null;
	return {
		capture(container) {
			if (typeof document === "undefined") return;
			const active = getDeepActiveElement(document);
			if (active && container.contains(active)) return;
			opener =
				active instanceof HTMLElement && active !== document.body
					? active
					: null;
		},
		restore() {
			const target = opener;
			opener = null;
			if (!target?.isConnected) return;
			try {
				target.focus();
			} catch {
				// ignore
			}
		},
	};
}
