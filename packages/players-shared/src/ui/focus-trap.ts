/**
 * Minimal focus trap helper.
 *
 * Tools use this to keep keyboard focus within a floating dialog while visible.
 * For now, we implement a lightweight version that:
 * - focuses the container when activated
 * - restores previous focus on cleanup
 */
export function createFocusTrap(container: HTMLElement): () => void {
	const prev =
		typeof document !== "undefined"
			? (document.activeElement as HTMLElement | null)
			: null;

	queueMicrotask(() => {
		try {
			container.focus?.();
		} catch {
			// ignore
		}
	});

	return () => {
		try {
			prev?.focus?.();
		} catch {
			// ignore
		}
	};
}
