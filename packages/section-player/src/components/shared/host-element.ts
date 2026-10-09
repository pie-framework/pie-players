/**
 * The custom element a component renders into, reached from an anchor node at
 * the top of its template.
 *
 * The anchor's parent node: the element itself under `shadow: "none"`, or its
 * shadow root otherwise. The anchor's root node names the host only in the second
 * case. A light-DOM element inside another component's shadow root shares that
 * root, so resolving through `getRootNode()` returned the outer component.
 */
export function getHostElementFromAnchor(
	anchor: HTMLElement | null,
): HTMLElement | null {
	if (!anchor) return null;
	const parent = anchor.parentNode;
	if (parent?.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in parent) {
		return (parent as ShadowRoot).host as HTMLElement;
	}
	return anchor.parentElement;
}
