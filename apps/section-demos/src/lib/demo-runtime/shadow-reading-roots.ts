/**
 * Open shadow roots for the shadow-reading demo. Each element in the page that
 * carries `data-demo-shadow-reading` gets one, filled with the content its value
 * names, so it stands in for an element that keeps its content behind a shadow
 * boundary and read-aloud, highlighting and the annotation toolbar can be shown
 * reaching it.
 *
 * The hosts are plain `<div>`s: the PIE config contract requires every custom
 * element tag in an item's markup to be declared in its `elements`, and a demo
 * element has no package to declare. Light children render where the shadow
 * root's `<slot>` sits. Started from the demo's page rather than at import, so
 * the content module loads in Node.
 */

export const SHADOW_READING_ATTRIBUTE = "data-demo-shadow-reading";

const VARIANTS: Record<string, string> = {
	reading: `<p>Words inside a shadow root.</p>
<p>The span <span data-catalog-idref="shadow-reading-span">carries a catalog</span>.</p>
<p>A sum: <math><mi>x</mi><mo>+</mo><mn>1</mn></math></p>
<p><slot></slot></p>`,
	spanish: `<p>El agua hierve <span data-catalog-idref="shadow-reading-spanish-span">a cien grados</span>.</p>`,
	math: `<p>The total is <math><mi>y</mi><mo>-</mo><mn>2</mn></math>.</p>`,
};

const attachTo = (host: Element): void => {
	if (host.shadowRoot) return;
	const variant = host.getAttribute(SHADOW_READING_ATTRIBUTE) || "reading";
	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = VARIANTS[variant] ?? VARIANTS.reading;
};

const attachAll = (): void => {
	for (const host of document.querySelectorAll(
		`[${SHADOW_READING_ATTRIBUTE}]`,
	)) {
		attachTo(host);
	}
};

/** Attaches the demo's shadow roots now and to hosts rendered later; returns the stop. */
export function attachShadowReadingRoots(): () => void {
	if (
		typeof document === "undefined" ||
		typeof MutationObserver === "undefined"
	) {
		return () => {};
	}
	attachAll();
	const observer = new MutationObserver(attachAll);
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
	return () => observer.disconnect();
}
