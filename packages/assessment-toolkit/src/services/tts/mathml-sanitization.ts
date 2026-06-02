const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

const ALLOWED_MATHML_ELEMENTS = new Set([
	"math",
	"maction",
	"menclose",
	"merror",
	"mfenced",
	"mfrac",
	"mi",
	"mmultiscripts",
	"mn",
	"mo",
	"mover",
	"mpadded",
	"mphantom",
	"mprescripts",
	"mroot",
	"mrow",
	"ms",
	"mspace",
	"msqrt",
	"mstyle",
	"msub",
	"msubsup",
	"msup",
	"mtable",
	"mtd",
	"mtext",
	"mtr",
	"munder",
	"munderover",
	"none",
	"semantics",
	"annotation",
	"annotation-xml",
]);

const ALLOWED_ATTRIBUTES = new Set([
	"accent",
	"accentunder",
	"align",
	"bevelled",
	"class",
	"close",
	"columnalign",
	"columnlines",
	"columnspacing",
	"columnspan",
	"denomalign",
	"depth",
	"dir",
	"display",
	"encoding",
	"fence",
	"height",
	"href",
	"id",
	"largeop",
	"length",
	"linethickness",
	"lspace",
	"mathbackground",
	"mathcolor",
	"mathsize",
	"mathvariant",
	"maxsize",
	"minsize",
	"movablelimits",
	"notation",
	"numalign",
	"open",
	"rowalign",
	"rowlines",
	"rowspacing",
	"rowspan",
	"rspace",
	"scriptlevel",
	"scriptminsize",
	"scriptsizemultiplier",
	"selection",
	"separator",
	"separators",
	"stretchy",
	"subscriptshift",
	"supscriptshift",
	"symmetric",
	"width",
	"xmlns",
	"xml:lang",
]);

const escapeText = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string): string =>
	escapeText(value).replace(/"/g, "&quot;");

const isUnsafeAttribute = (name: string, value: string): boolean => {
	const lowerName = name.toLowerCase();
	const lowerValue = value.trim().toLowerCase();
	if (lowerName.startsWith("on")) return true;
	if (!ALLOWED_ATTRIBUTES.has(lowerName)) return true;
	if (lowerValue.includes("javascript:")) return true;
	if (lowerValue.includes("data:text/html")) return true;
	return false;
};

const isAllowedMathElement = (element: Element): boolean => {
	const localName = element.localName.toLowerCase();
	if (!ALLOWED_MATHML_ELEMENTS.has(localName)) return false;
	const namespace = element.namespaceURI;
	return (
		!namespace ||
		namespace === MATHML_NAMESPACE ||
		namespace === "http://www.w3.org/1999/xhtml"
	);
};

const serializeMathNode = (node: Node): string | null => {
	if (node.nodeType === Node.TEXT_NODE) {
		return escapeText(node.textContent || "");
	}
	if (node.nodeType === Node.COMMENT_NODE) {
		return "";
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return null;
	}
	const element = node as Element;
	if (!isAllowedMathElement(element)) return null;
	const tagName = element.localName.toLowerCase();
	const attrs: string[] = [];
	for (const attr of Array.from(element.attributes)) {
		const name = attr.name.toLowerCase();
		if (isUnsafeAttribute(name, attr.value)) continue;
		if (name === "xmlns" && attr.value !== MATHML_NAMESPACE) return null;
		attrs.push(`${name}="${escapeAttribute(attr.value)}"`);
	}
	if (tagName === "math" && !attrs.some((attr) => attr.startsWith("xmlns="))) {
		attrs.unshift(`xmlns="${MATHML_NAMESPACE}"`);
	}
	const children: string[] = [];
	for (const child of Array.from(element.childNodes)) {
		const serialized = serializeMathNode(child);
		if (serialized === null) return null;
		children.push(serialized);
	}
	const attrText = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
	return `<${tagName}${attrText}>${children.join("")}</${tagName}>`;
};

const parseMathML = (input: string): Document | null => {
	if (typeof DOMParser !== "undefined") {
		return new DOMParser().parseFromString(input, "application/xml");
	}
	return null;
};

export const canonicalizeMathML = (input: string): string | null => {
	const trimmed = String(input || "").trim();
	if (!trimmed) return null;
	const parsed = parseMathML(trimmed);
	if (!parsed) return null;
	if (parsed.getElementsByTagName("parsererror").length > 0) return null;
	const root = parsed.documentElement;
	if (!root || root.localName.toLowerCase() !== "math") return null;
	return serializeMathNode(root);
};
