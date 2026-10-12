/**
 * When the PIE elements of a player have rendered.
 *
 * An element renders after its model and session are assigned, in a task of
 * its own: legacy React elements debounce the render and commit through the
 * React scheduler, so the commit lands tens of milliseconds after the
 * assignment. No event marks it in both element generations — `model-set` is
 * dispatched by about half of them, some before rendering — so this reads the
 * DOM.
 *
 * An element has rendered once it holds content, and so has every custom
 * element defined below it: an `ebsr` paints its parts, which then render
 * themselves. Some elements render nothing, a rubric for a student among them,
 * so an element still empty when the subtree has had no mutation for
 * `quietMs` counts as rendered. A render slower than that window, with no
 * mutation before it, is missed rather than waited for.
 */

import type { ConfigEntity } from "../types/index.js";

/** Longer than the 50ms render debounce legacy elements use, plus a scheduler task. */
const ELEMENT_RENDER_QUIET_MS = 200;

function hasContent(element: Element): boolean {
	if (element.firstElementChild || element.shadowRoot?.firstChild) return true;
	return Boolean(element.textContent?.trim());
}

function isDefinedCustomElement(element: Element): boolean {
	return (
		element.localName.includes("-") &&
		customElements.get(element.localName) !== undefined
	);
}

function hasRendered(element: Element): boolean {
	if (!element.isConnected) return true;
	if (!hasContent(element)) return false;
	for (const nested of element.querySelectorAll("*")) {
		if (isDefinedCustomElement(nested) && !hasContent(nested)) return false;
	}
	return true;
}

/** The elements of `configs` in `root`, found as `updatePieElements` finds them. */
function renderedElements(root: Element, configs: ConfigEntity[]): Element[] {
	const elements: Element[] = [];
	for (const config of configs) {
		const ids = new Set((config.models ?? []).map((model) => model?.id));
		for (const tag of Object.keys(config.elements ?? {})) {
			// An undefined tag renders nothing until its bundle loads.
			if (!customElements.get(tag)) continue;
			for (const element of root.querySelectorAll(tag)) {
				if (ids.has(element.id)) elements.push(element);
			}
		}
	}
	return elements;
}

/**
 * Resolves once every element of `configs` in `root` has rendered, or when
 * `signal` aborts. Never rejects.
 */
export function elementsRendered(
	root: Element,
	configs: ConfigEntity[],
	signal: AbortSignal,
	quietMs: number = ELEMENT_RENDER_QUIET_MS,
): Promise<void> {
	const elements = renderedElements(root, configs);
	const allRendered = () => elements.every(hasRendered);
	if (
		signal.aborted ||
		allRendered() ||
		typeof MutationObserver === "undefined"
	) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve) => {
		let quiet: ReturnType<typeof setTimeout> | undefined;
		const observer = new MutationObserver(() => {
			if (allRendered()) {
				done();
				return;
			}
			armQuiet();
		});
		function armQuiet() {
			clearTimeout(quiet);
			quiet = setTimeout(done, quietMs);
		}
		function done() {
			clearTimeout(quiet);
			observer.disconnect();
			signal.removeEventListener("abort", done);
			resolve();
		}
		observer.observe(root, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		signal.addEventListener("abort", done);
		armQuiet();
	});
}
