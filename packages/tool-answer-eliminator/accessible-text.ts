import { isOwned } from "./owned-nodes.js";

const SKIPPED = new Set(["script", "style", "template", "noscript"]);

/** The name a rendered expression or image is spoken by, or null for neither. */
function spokenName(element: Element): string | null {
	const mathName = element.getAttribute("data-pie-math-name");
	if (mathName) return mathName;
	const role = element.getAttribute("role");
	if (
		element.localName === "mjx-container" ||
		element.localName === "svg" ||
		role === "img" ||
		role === "math"
	) {
		const label = element.getAttribute("aria-label");
		if (label) return label;
	}
	if (element.localName === "img") return element.getAttribute("alt") ?? "";
	return null;
}

/**
 * What a choice reads as, for its toggle's name: its text, with each rendered
 * expression's spoken name and each image's alt text in its place, leaving out
 * what is hidden from assistive technology and what the eliminator added.
 * `textContent` alone reads MathJax output as source fragments ("x2=4") and
 * drops images.
 */
export function accessibleText(root: Element): string {
	const parts: string[] = [];
	const visit = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.nodeValue ?? "");
			return;
		}
		if (!(node instanceof Element) || isOwned(node)) return;
		if (SKIPPED.has(node.localName)) return;
		if (node.getAttribute("aria-hidden") === "true") return;
		const name = spokenName(node);
		if (name !== null) {
			parts.push(` ${name} `);
			return;
		}
		for (const child of node.childNodes) visit(child);
	};
	visit(root);
	return parts.join("").replace(/\s+/g, " ").trim();
}
