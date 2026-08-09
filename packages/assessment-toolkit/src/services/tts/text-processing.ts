export type NormalizedTextMap = Map<number, { node: Text; offset: number }>;
export type BoundarySpacingMode = "segmenterPreferred" | "alnum" | "none";

export interface TextProcessingOptions {
	locale?: string;
	boundarySpacingMode?: BoundarySpacingMode;
}

export const normalizeTextForSpeech = (text: string): string =>
	text.trim().replace(/\s+/g, " ");

// Single source of truth for aligning spoken text to visible / math text.
// Letters are matched with `\p{L}` so the tokenizer is Unicode-aware — accented
// Latin ("café") and non-Latin scripts stay one token instead of being split
// or dropped, which is what previously limited word-level highlight alignment
// to ASCII. Numbers cover integers and decimals; the trailing class lists the
// math glyphs a TTS engine may surface as a single visible token. A fresh
// RegExp is returned each call because the global flag carries mutable
// `lastIndex` state that must not be shared across call sites.
export const createSpeechAlignmentTokenPattern = (): RegExp =>
	/[\p{L}]+|\d+(?:\.\d+)?|[±√=+\-*/()²³^×÷≤≥≠≈<>|%°'′\u2062]/gu;

export const isElementHiddenForTTS = (element: Element): boolean => {
	if ((element as HTMLElement).hidden) return true;
	if (element.tagName?.toLowerCase() === "mjx-assistive-mml") return true;
	if (element.getAttribute("aria-hidden") === "true") return true;
	if (element.hasAttribute("inert")) return true;
	const classList = (element as HTMLElement).classList;
	if (
		classList?.contains("sr-only") ||
		classList?.contains("pie-sr-only") ||
		classList?.contains("visually-hidden")
	) {
		return true;
	}
	if (typeof window !== "undefined") {
		const style = window.getComputedStyle(element);
		if (style.display === "none" || style.visibility === "hidden") {
			return true;
		}
		const width = Number.parseFloat(style.width || "0");
		const height = Number.parseFloat(style.height || "0");
		const isTiny =
			Number.isFinite(width) &&
			Number.isFinite(height) &&
			width <= 1 &&
			height <= 1;
		const isOffscreenClip =
			style.clipPath.includes("inset(50%") ||
			style.clipPath.includes("inset(100%") ||
			style.clip.includes("rect(0px, 0px, 0px, 0px)") ||
			style.clip.includes("rect(0 0 0 0)");
		if (
			(style.position === "absolute" || style.position === "fixed") &&
			isTiny &&
			(style.overflow === "hidden" || isOffscreenClip)
		) {
			return true;
		}
		if (style.opacity === "0" && isTiny) {
			return true;
		}
	}
	return false;
};

export const isNodeHiddenForTTS = (
	node: Node,
	root?: Element | null,
): boolean => {
	let current =
		node.nodeType === 1
			? (node as Element)
			: (node.parentElement as Element | null);
	while (current) {
		if (isElementHiddenForTTS(current)) return true;
		if (root && current === root) break;
		current = current.parentElement;
	}
	return false;
};

/**
 * Marks content that must be shown but never spoken — items where reading *is*
 * the construct, such as decoding and spelling, where speaking the node hands
 * over the answer.
 *
 * Not a PNP field: `prohibitedSupports` is the learner declining a support, while
 * this is the item saying "not here, for anyone", so it overrides an entitlement
 * rather than yielding to it.
 *
 * Shape follows QTI 3's `data-qti-suppress-tts` — an attribute on the content
 * element, single-valued, vocabulary below. Element placement is what makes it
 * work on undocked nodes and enforceable in the selection read-aloud path, which
 * consults no catalog. The name follows PIE's `data-tts-*` family, and PIE reads
 * only this spelling; importers map QTI's.
 */
export const TTS_SUPPRESS_ATTRIBUTE = "data-tts-suppress";

const SUPPRESSES_COMPUTER_READ_ALOUD = new Set(["computer-read-aloud", "all"]);
// `screen-reader` is in the vocabulary but is not ours: it asks the delivery
// engine to hide the node from assistive technology, which is the host's job
// (and is what `aria-hidden` above already covers on the way in). A node marked
// only `screen-reader` is still legitimately machine-read aloud.
const SUPPRESS_VALUES = new Set([
	...SUPPRESSES_COMPUTER_READ_ALOUD,
	"screen-reader",
]);
const warnedSuppressValues = new Set<string>();

/**
 * Whether this element forbids machine read-aloud of itself and its subtree.
 *
 * Unrecognized and empty values suppress rather than pass through, and say so once
 * per distinct value: a typo that fell through would speak a word the item was
 * measuring, invalidating the score with no visible symptom, whereas
 * over-suppressing only withholds speech an author had already marked as withheld.
 */
export const isElementSuppressedForTTS = (element: Element): boolean => {
	const raw = element.getAttribute?.(TTS_SUPPRESS_ATTRIBUTE);
	if (raw === null || raw === undefined) return false;
	const value = raw.trim().toLowerCase();
	if (SUPPRESSES_COMPUTER_READ_ALOUD.has(value)) return true;
	if (SUPPRESS_VALUES.has(value)) return false;
	if (!warnedSuppressValues.has(value)) {
		warnedSuppressValues.add(value);
		console.warn(
			`[tts] ${TTS_SUPPRESS_ATTRIBUTE}="${raw}" is not one of ${Array.from(
				SUPPRESS_VALUES,
			).join(
				", ",
			)}; suppressing read-aloud for this content anyway, because a suppression attribute that fails open would leak the answer to items where reading is the construct. Correct the value to silence this.`,
		);
	}
	return true;
};

export const isNodeSuppressedForTTS = (
	node: Node,
	root?: Element | null,
): boolean => {
	let current =
		node.nodeType === 1
			? (node as Element)
			: (node.parentElement as Element | null);
	while (current) {
		if (isElementSuppressedForTTS(current)) return true;
		if (root && current === root) break;
		current = current.parentElement;
	}
	return false;
};

/**
 * The predicate every speech-producing path filters on: hidden *or* suppressed.
 *
 * Kept distinct from `isNodeHiddenForTTS`, which stays a question about
 * visibility — suppressed content is visible on purpose, and the highlight
 * geometry resolvers that ask "can the candidate see this" must keep getting
 * the visibility answer rather than this one.
 */
export const isNodeExcludedFromSpeech = (
	node: Node,
	root?: Element | null,
): boolean => isNodeHiddenForTTS(node, root) || isNodeSuppressedForTTS(node);

/**
 * Text of a range with the parts that must not be spoken removed.
 *
 * `Range.toString()` is not usable for speech: it is pure character extraction
 * and honours no DOM filter at all, so it happily returns suppressed — and
 * hidden — text. The selection read-aloud path is a text-in path rather than a
 * DOM walk, which makes this the only place its content can be filtered.
 *
 * `filtered` reports whether anything was dropped, so a caller can tell "the
 * candidate selected nothing speakable" apart from "the candidate selected
 * nothing".
 */
export const collectRangeTextForSpeech = (
	range: Range,
	root: Element,
): { text: string; filtered: boolean } => {
	if (
		typeof document === "undefined" ||
		typeof (document as { createTreeWalker?: unknown }).createTreeWalker !==
			"function" ||
		typeof NodeFilter === "undefined" ||
		typeof (range as { intersectsNode?: unknown }).intersectsNode !== "function"
	) {
		// Degraded, and deliberately not silent about the difference: callers still
		// enforce whole-selection suppression from the range's common ancestor, so
		// the construct guard holds even here. What is lost is per-node filtering
		// of a selection that only partly overlaps suppressed content.
		return { text: range.toString(), filtered: false };
	}
	const parts: string[] = [];
	let filtered = false;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current) {
		const textNode = current as Text;
		if (range.intersectsNode(textNode)) {
			if (isNodeExcludedFromSpeech(textNode, root)) {
				filtered = true;
			} else {
				const raw = textNode.textContent || "";
				const start = textNode === range.startContainer ? range.startOffset : 0;
				const end =
					textNode === range.endContainer ? range.endOffset : raw.length;
				parts.push(raw.slice(start, end));
			}
		}
		current = walker.nextNode();
	}
	return { text: parts.join(""), filtered };
};

export const shouldInsertWordBoundarySpace = (
	previousChar: string | null,
	nextChar: string | null,
	options?: TextProcessingOptions,
): boolean => {
	if (!previousChar || !nextChar) return false;
	if (/\s/.test(previousChar) || /\s/.test(nextChar)) return false;
	const mode = options?.boundarySpacingMode ?? "segmenterPreferred";
	if (mode === "none") return false;
	if (mode === "segmenterPreferred") {
		try {
			const Segmenter = globalThis.Intl?.Segmenter;
			if (typeof Segmenter === "function") {
				const segmenter = new Segmenter(options?.locale, {
					granularity: "word",
				});
				const segments = Array.from(
					segmenter.segment(`${previousChar}${nextChar}`),
				);
				const wordLikeCount = segments.filter(
					(segment) =>
						(segment as { isWordLike?: boolean }).isWordLike !== false &&
						segment.segment.trim().length > 0,
				).length;
				if (wordLikeCount >= 2) return true;
			}
		} catch {
			// Fall back to alnum heuristics below.
		}
	}
	const prevIsAlnum = /[A-Za-z0-9]/.test(previousChar);
	const nextIsAlnum = /[A-Za-z0-9]/.test(nextChar);
	return prevIsAlnum && nextIsAlnum;
};

export const collectVisibleTextAndMap = (
	element: Element,
	options?: TextProcessingOptions,
): { text: string; map: NormalizedTextMap } => {
	const map: NormalizedTextMap = new Map();
	if (
		typeof document === "undefined" ||
		typeof (document as { createTreeWalker?: unknown }).createTreeWalker !==
			"function" ||
		typeof NodeFilter === "undefined"
	) {
		return { text: "", map };
	}
	const outChars: string[] = [];
	let outPos = 0;
	let inLeadingWhitespace = true;
	let lastCharWasWhitespace = false;
	let lastMapped: { node: Text; offset: number } | null = null;
	let previousVisibleChar: string | null = null;

	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current) {
		const textNode = current as Text;
		const parent = textNode.parentElement;
		if (parent && !isNodeExcludedFromSpeech(textNode, element)) {
			const raw = textNode.textContent || "";
			const firstVisibleMatch = raw.match(/\S/);
			const firstVisibleChar = firstVisibleMatch ? firstVisibleMatch[0] : null;

			if (
				!inLeadingWhitespace &&
				!lastCharWasWhitespace &&
				shouldInsertWordBoundarySpace(
					previousVisibleChar,
					firstVisibleChar,
					options,
				)
			) {
				outChars.push(" ");
				if (lastMapped) {
					map.set(outPos, lastMapped);
				}
				outPos++;
				lastCharWasWhitespace = true;
			}

			for (let i = 0; i < raw.length; i++) {
				const ch = raw[i];
				const isWhitespace = /\s/.test(ch);

				if (inLeadingWhitespace) {
					if (!isWhitespace) {
						inLeadingWhitespace = false;
						outChars.push(ch);
						map.set(outPos, { node: textNode, offset: i });
						lastMapped = { node: textNode, offset: i };
						outPos++;
						lastCharWasWhitespace = false;
						previousVisibleChar = ch;
					}
				} else if (isWhitespace) {
					if (!lastCharWasWhitespace) {
						outChars.push(" ");
						map.set(outPos, { node: textNode, offset: i });
						lastMapped = { node: textNode, offset: i };
						outPos++;
					}
					lastCharWasWhitespace = true;
				} else {
					outChars.push(ch);
					map.set(outPos, { node: textNode, offset: i });
					lastMapped = { node: textNode, offset: i };
					outPos++;
					lastCharWasWhitespace = false;
					previousVisibleChar = ch;
				}
			}
		}
		current = walker.nextNode();
	}

	const text = outChars.join("").trimEnd();
	while (map.has(text.length)) {
		map.delete(text.length);
	}
	return { text, map };
};

export const extractVisibleText = (
	element: Element,
	options?: TextProcessingOptions,
): string => collectVisibleTextAndMap(element, options).text;
