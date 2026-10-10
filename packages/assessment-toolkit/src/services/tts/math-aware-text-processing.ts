import {
	flatQuerySelector,
	flatTreeChildNodes,
	flatTreeParentElement,
	rangeIntersectsComposedNode,
} from "./flat-tree.js";
import { canonicalizeMathML } from "./mathml-sanitization.js";
import {
	collectVisibleTextAndMap,
	type NormalizedTextMap,
	type TextProcessingOptions,
	isNodeExcludedFromSpeech,
	normalizeTextForSpeech,
	rangeHoldsSpeakableElement,
	shouldInsertWordBoundarySpace,
} from "./text-processing.js";

export type MathAwareSpeechChunk =
	| {
			type: "text";
			text: string;
			sourceElement?: Element;
	  }
	| {
			type: "math";
			mathml: string;
			fallbackText: string;
			sourceElement?: Element;
	  };

export interface MathAwareTextResult {
	visibleText: string;
	map: NormalizedTextMap;
	chunks: MathAwareSpeechChunk[];
	containsMathMarkup: boolean;
}

interface TextAccumulator {
	chars: string[];
	map: NormalizedTextMap;
	position: number;
	inLeadingWhitespace: boolean;
	lastCharWasWhitespace: boolean;
	lastMapped: { node: Text; offset: number } | null;
	options?: TextProcessingOptions;
}

const createAccumulator = (
	options?: TextProcessingOptions,
): TextAccumulator => ({
	chars: [],
	map: new Map(),
	position: 0,
	inLeadingWhitespace: true,
	lastCharWasWhitespace: false,
	lastMapped: null,
	options,
});

const isMathJaxElement = (element: Element): boolean =>
	element.classList?.contains("MathJax") ||
	element.tagName?.toLowerCase() === "mjx-container";

const isAssistiveMathElement = (element: Element): boolean =>
	element.tagName?.toLowerCase() === "mjx-assistive-mml";

const isAnnotationElement = (element: Element): boolean => {
	const tagName = element.tagName?.toLowerCase();
	return tagName === "annotation" || tagName === "annotation-xml";
};

const getDataMathML = (element: Element): string | null => {
	const value = element.getAttribute("data-mathml");
	return value && value.trim() ? value : null;
};

const findAssistiveMathML = (element: Element): string | null => {
	const assistive = flatQuerySelector(element, "mjx-assistive-mml math");
	return assistive?.outerHTML || null;
};

const findCanonicalMathML = (element: Element): string | null => {
	if (element.tagName.toLowerCase() === "math") {
		return canonicalizeMathML(element.outerHTML);
	}
	const dataMath = getDataMathML(element);
	if (dataMath) {
		const canonical = canonicalizeMathML(dataMath);
		if (canonical) return canonical;
	}
	if (isMathJaxElement(element)) {
		const assistive = findAssistiveMathML(element);
		if (assistive) {
			const canonical = canonicalizeMathML(assistive);
			if (canonical) return canonical;
		}
	}
	return null;
};

const TEXT_CHUNK_SOURCE_TAGS = new Set([
	"P",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"LI",
	"TD",
	"TH",
	"DD",
	"DT",
	"FIGCAPTION",
	"LABEL",
	"BUTTON",
]);

const TEXT_CHUNK_SOURCE_ROLES = new Set([
	"heading",
	"listitem",
	"option",
	"radio",
	"row",
	"cell",
	"columnheader",
	"rowheader",
]);

const resolveTextChunkSourceElement = (
	textNode: Text,
	root: Element,
): Element => {
	let current = flatTreeParentElement(textNode);
	while (current && current !== root) {
		const role = (current.getAttribute("role") || "").toLowerCase();
		const tagName = current.tagName.toUpperCase();
		if (
			TEXT_CHUNK_SOURCE_TAGS.has(tagName) ||
			TEXT_CHUNK_SOURCE_ROLES.has(role)
		) {
			return current;
		}
		current = flatTreeParentElement(current);
	}
	return root;
};

const hasMathCandidate = (element: Element): boolean =>
	Boolean(
		typeof element.querySelector === "function" &&
			flatQuerySelector(
				element,
				"math, [data-mathml], .MathJax, mjx-container, mjx-assistive-mml",
			),
	) ||
	element.tagName?.toLowerCase() === "math" ||
	element.hasAttribute?.("data-mathml") ||
	isMathJaxElement(element);

const appendCharacter = (
	acc: TextAccumulator,
	character: string,
	mapping: { node: Text; offset: number } | null,
): void => {
	if (
		/[.,;:!?]/.test(character) &&
		acc.chars.length > 0 &&
		acc.chars[acc.chars.length - 1] === " "
	) {
		acc.chars.pop();
		acc.position--;
		acc.map.delete(acc.position);
	}
	acc.chars.push(character);
	if (mapping) {
		acc.map.set(acc.position, mapping);
		acc.lastMapped = mapping;
	} else if (acc.lastMapped) {
		acc.map.set(acc.position, acc.lastMapped);
	}
	acc.position++;
};

const shouldInsertBoundarySpace = (
	acc: TextAccumulator,
	nextCharacter: string,
): boolean => {
	if (
		acc.inLeadingWhitespace ||
		acc.lastCharWasWhitespace ||
		acc.chars.length === 0
	) {
		return false;
	}
	const previous = acc.chars[acc.chars.length - 1];
	// Defer to the shared locale-aware decision (Intl.Segmenter, falling back to
	// alnum) so adjacent text nodes split into words consistently with the main
	// visible-text collector, instead of an ASCII-only heuristic.
	return shouldInsertWordBoundarySpace(previous, nextCharacter, acc.options);
};

/** `start` and `end` bound the part of the node appended, for a selection. */
const appendTextNode = (
	acc: TextAccumulator,
	textNode: Text,
	start = 0,
	end = (textNode.textContent || "").length,
): void => {
	const raw = textNode.textContent || "";
	let appendedNonWhitespaceInNode = false;
	for (let i = start; i < end; i++) {
		const character = raw[i];
		const isWhitespace = /\s/.test(character);
		if (acc.inLeadingWhitespace) {
			if (!isWhitespace) {
				acc.inLeadingWhitespace = false;
				appendCharacter(acc, character, { node: textNode, offset: i });
				appendedNonWhitespaceInNode = true;
				acc.lastCharWasWhitespace = false;
			}
			continue;
		}
		if (isWhitespace) {
			if (!acc.lastCharWasWhitespace) {
				appendCharacter(acc, " ", { node: textNode, offset: i });
			}
			acc.lastCharWasWhitespace = true;
			continue;
		}
		if (
			!appendedNonWhitespaceInNode &&
			shouldInsertBoundarySpace(acc, character)
		) {
			appendCharacter(acc, " ", { node: textNode, offset: i });
		}
		appendCharacter(acc, character, { node: textNode, offset: i });
		appendedNonWhitespaceInNode = true;
		acc.lastCharWasWhitespace = false;
	}
};

const appendCollectedText = (
	acc: TextAccumulator,
	collected: { text: string; map: NormalizedTextMap },
): void => {
	for (let i = 0; i < collected.text.length; i++) {
		const character = collected.text[i];
		const isWhitespace = /\s/.test(character);
		const mapping = collected.map.get(i);
		// An unmapped character borrows the last mapped position.
		const characterMapping = mapping
			? { node: mapping.node, offset: mapping.offset }
			: acc.lastMapped
				? { node: acc.lastMapped.node, offset: acc.lastMapped.offset }
				: null;
		if (acc.inLeadingWhitespace) {
			if (isWhitespace) continue;
			acc.inLeadingWhitespace = false;
		}
		if (isWhitespace) {
			if (!acc.lastCharWasWhitespace) {
				appendCharacter(acc, " ", characterMapping);
			}
			acc.lastCharWasWhitespace = true;
			continue;
		}
		if (i === 0 && shouldInsertBoundarySpace(acc, character)) {
			appendCharacter(acc, " ", characterMapping);
		}
		appendCharacter(acc, character, characterMapping);
		acc.lastCharWasWhitespace = false;
	}
};

const textFallbackFromMathML = (mathml: string): string => {
	if (typeof DOMParser === "undefined") return "";
	const parsed = new DOMParser().parseFromString(mathml, "application/xml");
	if (parsed.getElementsByTagName("parsererror").length > 0) return "";
	const parts: string[] = [];
	const visit = (node: Node): void => {
		if (node.nodeType === 3) {
			const text = node.textContent || "";
			if (text.trim()) parts.push(text);
			return;
		}
		if (node.nodeType !== 1) return;
		const element = node as Element;
		if (isAnnotationElement(element)) return;
		for (const child of Array.from(element.childNodes)) {
			visit(child);
		}
	};
	visit(parsed.documentElement);
	return normalizeTextForSpeech(parts.join(" "));
};

// MathJax CHTML paints its glyphs from CSS, so a typeset equation's only text
// nodes are the source MathML it keeps, clipped, in mjx-assistive-mml. Mapping
// the fallback text onto them places a catalog word inside its equation, where
// the rendered-math resolver finds the glyph. Any divergence between the two
// texts leaves the fallback unmapped.
const mapFallbackToAssistiveMath = (
	element: Element,
	fallbackText: string,
): NormalizedTextMap => {
	const map: NormalizedTextMap = new Map();
	const sourceMath = isMathJaxElement(element)
		? flatQuerySelector(element, "mjx-assistive-mml math")
		: null;
	if (!sourceMath) return map;
	const characters: Array<{ node: Text; offset: number }> = [];
	const visit = (node: Node): void => {
		if (node.nodeType === 3) {
			const text = node.textContent || "";
			for (let offset = 0; offset < text.length; offset++) {
				if (!/\s/.test(text[offset])) {
					characters.push({ node: node as Text, offset });
				}
			}
			return;
		}
		if (node.nodeType !== 1 || isAnnotationElement(node as Element)) return;
		for (const child of flatTreeChildNodes(node)) {
			visit(child);
		}
	};
	visit(sourceMath);
	let next = 0;
	for (let index = 0; index < fallbackText.length; index++) {
		if (/\s/.test(fallbackText[index])) continue;
		const mapping = characters[next];
		if (mapping?.node.textContent?.[mapping.offset] !== fallbackText[index]) {
			return new Map();
		}
		map.set(index, mapping);
		next++;
	}
	return next === characters.length ? map : new Map();
};

const collectVisibleMathFallback = (
	element: Element,
	canonicalMathML: string,
	options?: TextProcessingOptions,
): { text: string; map: NormalizedTextMap } => {
	const mathAcc = createAccumulator(options);
	const visit = (node: Node): void => {
		if (isNodeExcludedFromSpeech(node, element)) return;
		if (node.nodeType === 3) {
			appendTextNode(mathAcc, node as Text);
			return;
		}
		if (node.nodeType !== 1) return;
		const childElement = node as Element;
		if (
			isAssistiveMathElement(childElement) ||
			isAnnotationElement(childElement)
		) {
			return;
		}
		for (const child of flatTreeChildNodes(childElement)) {
			visit(child);
		}
	};
	visit(element);
	trimTrailingWhitespace(mathAcc);
	const text = normalizeTextForSpeech(mathAcc.chars.join(""));
	if (text) {
		return { text, map: mathAcc.map };
	}
	const fallbackText = textFallbackFromMathML(canonicalMathML);
	if (!fallbackText) {
		return collectVisibleTextAndMap(element, options);
	}
	return {
		text: fallbackText,
		map: mapFallbackToAssistiveMath(element, fallbackText),
	};
};

const trimTrailingWhitespace = (acc: TextAccumulator): void => {
	while (acc.chars.length > 0 && /\s/.test(acc.chars[acc.chars.length - 1])) {
		acc.chars.pop();
		acc.position--;
		acc.map.delete(acc.position);
	}
};

const collectMathAware = (
	root: Element,
	options?: TextProcessingOptions,
	range?: Range,
): MathAwareTextResult => {
	const acc = createAccumulator(options);
	const chunks: MathAwareSpeechChunk[] = [];
	let textChunkStart = 0;
	let textChunkSourceElement: Element | undefined;
	let containsMathMarkup = false;

	const flushTextChunk = () => {
		const text = normalizeTextForSpeech(
			acc.chars.slice(textChunkStart, acc.chars.length).join(""),
		);
		if (text) {
			chunks.push({
				type: "text",
				text,
				sourceElement: textChunkSourceElement,
			});
		}
		textChunkStart = acc.chars.length;
		textChunkSourceElement = undefined;
	};

	const processNode = (node: Node): void => {
		if (isNodeExcludedFromSpeech(node, root)) return;
		if (range && !rangeIntersectsComposedNode(range, node)) return;
		if (node.nodeType === 3) {
			const sourceElement = resolveTextChunkSourceElement(node as Text, root);
			if (textChunkSourceElement && sourceElement !== textChunkSourceElement) {
				flushTextChunk();
			}
			textChunkSourceElement = sourceElement;
			const textNode = node as Text;
			appendTextNode(
				acc,
				textNode,
				range?.startContainer === textNode ? range.startOffset : undefined,
				range?.endContainer === textNode ? range.endOffset : undefined,
			);
			return;
		}
		if (node.nodeType !== 1) return;
		const element = node as Element;
		if (isAssistiveMathElement(element)) return;
		const canonicalMathML = findCanonicalMathML(element);
		// An equation is spoken as math only when the selection holds all of it;
		// a part of one reads as the text selected.
		if (
			canonicalMathML &&
			(!range || rangeHoldsSpeakableElement(range, element, root))
		) {
			flushTextChunk();
			const collected = collectVisibleMathFallback(
				element,
				canonicalMathML,
				options,
			);
			appendCollectedText(acc, collected);
			const fallbackText = normalizeTextForSpeech(collected.text);
			chunks.push({
				type: "math",
				mathml: canonicalMathML,
				fallbackText,
				sourceElement: element,
			});
			textChunkStart = acc.chars.length;
			containsMathMarkup = true;
			return;
		}
		for (const child of flatTreeChildNodes(element)) {
			processNode(child);
		}
	};

	for (const child of flatTreeChildNodes(root)) {
		processNode(child);
	}

	trimTrailingWhitespace(acc);
	flushTextChunk();
	const visibleText = acc.chars.join("");
	return {
		visibleText,
		map: acc.map,
		chunks,
		containsMathMarkup,
	};
};

/**
 * With `range`, only the part of `element` the range selects: text it selects
 * and equations it holds whole.
 */
export const collectMathAwareTextAndMap = (
	element: Element,
	options?: TextProcessingOptions,
	range?: Range,
): MathAwareTextResult => {
	if (range) return collectMathAware(element, options, range);
	if (!hasMathCandidate(element)) {
		const { text, map } = collectVisibleTextAndMap(element, options);
		return {
			visibleText: text,
			map,
			chunks: text ? [{ type: "text", text }] : [],
			containsMathMarkup: false,
		};
	}
	return collectMathAware(element, options);
};
