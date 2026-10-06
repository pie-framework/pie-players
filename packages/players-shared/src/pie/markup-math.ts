/**
 * Math in an item's own markup: what the item and passage markup carry outside
 * every PIE element.
 *
 * Each element typesets its own subtree, so the player hands its renderer only
 * the markup around them. A renderer finds math below the element it is given,
 * so no root holds a PIE element: the markup splits into the elements that hold
 * none, and math sharing a parent with one is wrapped in a span of its own.
 */

import type { MathRenderer } from "./math-rendering.js";

/** TeX as `@pie-element/shared-math-rendering-mathjax` detects it. */
const TEX = /\\\(|\\\[|\$\$|\\\$|\\begin\{|\\(?:eq)?ref\{/;

/** The same, with `$…$` inline math turned on by the legacy opt-in. */
const TEX_WITH_SINGLE_DOLLAR = /\\\(|\\\[|\$|\\begin\{|\\(?:eq)?ref\{/;

/** Elements whose content MathJax leaves alone, as both PIE configurations list them. */
const SKIPPED_ELEMENTS = new Set([
	"script",
	"noscript",
	"style",
	"textarea",
	"pre",
	"code",
	"annotation",
	"annotation-xml",
	"mjx-container",
	"mjx-assistive-mml",
]);

/** The class an author marks content with to keep MathJax out of it. */
const IGNORED_CLASS = /(?:^|\s)mathjax_ignore(?:\s|$)/;

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

function texPattern(): RegExp {
	const legacy = (globalThis as Record<string, any>)[
		"@pie-lib/math-rendering@2"
	];
	return legacy?.opts?.useSingleDollar ? TEX_WITH_SINGLE_DOLLAR : TEX;
}

function isSkipped(element: Element): boolean {
	return (
		SKIPPED_ELEMENTS.has(element.localName) ||
		IGNORED_CLASS.test(element.getAttribute("class") ?? "")
	);
}

/** Math a renderer would only find on `element` itself, never below it. */
function holdsOwnMath(element: Element): boolean {
	return (
		element.localName === "math" ||
		(element.hasAttribute("data-latex") &&
			!element.hasAttribute("data-math-handled"))
	);
}

function holdsMath(element: Element, tex: RegExp): boolean {
	if (
		holdsOwnMath(element) ||
		element.querySelector("[data-latex]:not([data-math-handled])")
	) {
		return true;
	}
	for (const math of element.getElementsByTagName("math")) {
		if (!math.closest("mjx-assistive-mml")) return true;
	}
	return tex.test(element.textContent ?? "");
}

function wrapInSpan(node: ChildNode): HTMLElement {
	const span = (node.ownerDocument ?? document).createElement("span");
	node.replaceWith(span);
	span.append(node);
	return span;
}

/**
 * The parts of `container` holding math and no PIE element, each one a root to
 * typeset. `pieTags` are the tag names of the PIE elements its markup places.
 */
export function collectMarkupMathRoots(
	container: HTMLElement,
	pieTags: ReadonlySet<string>,
): HTMLElement[] {
	const tex = texPattern();
	const holdsPie = new Set<Element>();
	for (const tag of pieTags) {
		for (const element of container.getElementsByTagName(tag)) {
			for (
				let ancestor = element.parentElement;
				ancestor && !holdsPie.has(ancestor);
				ancestor = ancestor.parentElement
			) {
				holdsPie.add(ancestor);
				if (ancestor === container) break;
			}
		}
	}
	if (!holdsPie.has(container)) {
		return holdsMath(container, tex) ? [container] : [];
	}

	const roots: HTMLElement[] = [];
	const visit = (parent: Element) => {
		for (const child of [...parent.childNodes]) {
			if (child.nodeType === Node.TEXT_NODE) {
				if (tex.test((child as Text).data)) roots.push(wrapInSpan(child));
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const element = child as Element;
			if (pieTags.has(element.localName) || isSkipped(element)) continue;
			if (holdsPie.has(element)) {
				visit(element);
			} else if (holdsMath(element, tex)) {
				if (holdsOwnMath(element)) {
					roots.push(wrapInSpan(element));
				} else if (element.namespaceURI === HTML_NAMESPACE) {
					roots.push(element as HTMLElement);
				}
			}
		}
	};
	visit(container);
	return roots;
}

/**
 * Typesets the math in `containers` outside every PIE element with `render`,
 * one root at a time.
 */
export async function typesetMarkupMath(
	containers: Iterable<HTMLElement>,
	pieTags: ReadonlySet<string>,
	render: MathRenderer,
): Promise<void> {
	const roots = [...containers].flatMap((container) =>
		collectMarkupMathRoots(container, pieTags),
	);
	for (const root of roots) {
		await render(root);
	}
}
