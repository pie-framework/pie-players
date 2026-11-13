/**
 * The delivery-cost pages' readiness probe. A response field is interactive
 * once it is laid out and its editor has attached: MathLive's `math-field` is
 * upgraded, or a MathQuill field (math-inline before 13.0.8) holds its
 * textarea. The probe walks open shadow roots, since the players mix shadow and
 * light DOM.
 */

function collect(root: ParentNode, selector: string, found: Element[]): void {
	for (const element of root.querySelectorAll(selector)) found.push(element);
	const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const shadow = (node as Element).shadowRoot;
		if (shadow) collect(shadow, selector, found);
	}
}

export function deepQueryAll(root: ParentNode, selector: string): Element[] {
	const found: Element[] = [];
	collect(root, selector, found);
	return found;
}

const FIELD_SELECTORS = ["math-field", ".mq-editable-field"];

/** The response fields under `scope`, MathLive or MathQuill. */
export function fieldSelector(scope = ""): string {
	return FIELD_SELECTORS.map((field) => `${scope} ${field}`.trim()).join(", ");
}

function isInteractiveField(element: Element): boolean {
	const MathField = customElements.get("math-field");
	const attached =
		element.localName === "math-field"
			? Boolean(MathField) && element instanceof (MathField as CustomElementConstructor)
			: element.querySelector("textarea") !== null;
	if (!attached) return false;
	const { width, height } = element.getBoundingClientRect();
	return width > 0 && height > 0;
}

export function interactiveFields(root: ParentNode, scope = ""): Element[] {
	return deepQueryAll(root, fieldSelector(scope)).filter(isInteractiveField);
}

/**
 * Resolves with `performance.now()` on the first animation frame at which
 * `root` holds `count` interactive response fields under `scope`.
 */
export function whenFieldsInteractive(
	root: ParentNode,
	count: number,
	scope = "",
	timeoutMs = 120_000,
): Promise<number> {
	const started = performance.now();
	return new Promise((resolve, reject) => {
		const poll = () => {
			if (interactiveFields(root, scope).length >= count) {
				resolve(performance.now());
				return;
			}
			if (performance.now() - started > timeoutMs) {
				reject(new Error(`${count} response field(s) under "${scope}" not interactive after ${timeoutMs}ms`));
				return;
			}
			requestAnimationFrame(poll);
		};
		requestAnimationFrame(poll);
	});
}
