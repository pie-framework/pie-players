import { canonicalizeMathML } from "./mathml-sanitization.js";
import {
	collectVisibleTextAndMap,
	type NormalizedTextMap,
	type TextProcessingOptions,
	isNodeHiddenForTTS,
	normalizeTextForSpeech,
	shouldInsertWordBoundarySpace,
} from "./text-processing.js";

export type MathAwareSpeechChunk =
	| {
			type: "text";
			text: string;
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
	const assistive = element.querySelector("mjx-assistive-mml math");
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

const isMathContainer = (element: Element): boolean =>
	Boolean(findCanonicalMathML(element));

const hasMathCandidate = (element: Element): boolean =>
	Boolean(
		typeof element.querySelector === "function" &&
			element.querySelector(
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

const appendTextNode = (acc: TextAccumulator, textNode: Text): void => {
	const raw = textNode.textContent || "";
	let appendedNonWhitespaceInNode = false;
	for (let i = 0; i < raw.length; i++) {
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
		const mapping = collected.map.get(i) || null;
		const syntheticNode = mapping?.node || acc.lastMapped?.node || null;
		const syntheticOffset = mapping?.offset ?? acc.lastMapped?.offset ?? 0;
		const normalizedMapping = mapping
			? { node: mapping.node, offset: mapping.offset }
			: syntheticNode
				? { node: syntheticNode, offset: syntheticOffset }
				: null;
		if (acc.inLeadingWhitespace) {
			if (isWhitespace) continue;
			acc.inLeadingWhitespace = false;
		}
		if (isWhitespace) {
			if (!acc.lastCharWasWhitespace) {
				appendCharacter(acc, " ", normalizedMapping);
			}
			acc.lastCharWasWhitespace = true;
			continue;
		}
		if (i === 0 && shouldInsertBoundarySpace(acc, character)) {
			appendCharacter(acc, " ", normalizedMapping);
		}
		appendCharacter(acc, character, normalizedMapping);
		acc.lastCharWasWhitespace = false;
		if (mapping) {
			acc.map.set(acc.position - 1, {
				node: mapping.node,
				offset: mapping.offset,
			});
			acc.lastMapped = { node: mapping.node, offset: mapping.offset };
		} else if (syntheticNode) {
			acc.map.set(acc.position - 1, {
				node: syntheticNode,
				offset: syntheticOffset,
			});
		}
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

const collectVisibleMathFallback = (
	element: Element,
	canonicalMathML: string,
	options?: TextProcessingOptions,
): { text: string; map: NormalizedTextMap } => {
	const mathAcc = createAccumulator(options);
	const visit = (node: Node): void => {
		if (isNodeHiddenForTTS(node, element)) return;
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
		for (const child of Array.from(childElement.childNodes)) {
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
		map: new Map(),
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
): MathAwareTextResult => {
	const acc = createAccumulator(options);
	const chunks: MathAwareSpeechChunk[] = [];
	let textChunkStart = 0;
	let containsMathMarkup = false;

	const flushTextChunk = () => {
		const text = normalizeTextForSpeech(
			acc.chars.slice(textChunkStart, acc.chars.length).join(""),
		);
		if (text) {
			chunks.push({ type: "text", text });
		}
		textChunkStart = acc.chars.length;
	};

	const processNode = (node: Node): void => {
		if (isNodeHiddenForTTS(node, root)) return;
		if (node.nodeType === Node.TEXT_NODE) {
			appendTextNode(acc, node as Text);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const element = node as Element;
		if (isAssistiveMathElement(element)) return;
		const canonicalMathML = findCanonicalMathML(element);
		if (canonicalMathML) {
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
		for (const child of Array.from(element.childNodes)) {
			processNode(child);
		}
	};

	for (const child of Array.from(root.childNodes)) {
		processNode(child);
	}

	trimTrailingWhitespace(acc);
	flushTextChunk();
	const visibleText = acc.chars.join("");
	while (acc.map.has(visibleText.length)) {
		acc.map.delete(visibleText.length);
	}
	return {
		visibleText,
		map: acc.map,
		chunks,
		containsMathMarkup,
	};
};

export const collectMathAwareTextAndMap = (
	element: Element,
	options?: TextProcessingOptions,
): MathAwareTextResult => {
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
