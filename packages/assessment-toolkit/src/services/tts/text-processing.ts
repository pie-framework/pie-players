export type NormalizedTextMap = Map<number, { node: Text; offset: number }>;
export type BoundarySpacingMode = "segmenterPreferred" | "alnum" | "none";

export interface TextProcessingOptions {
	locale?: string;
	boundarySpacingMode?: BoundarySpacingMode;
}

export const normalizeTextForSpeech = (text: string): string =>
	text.trim().replace(/\s+/g, " ");

export const isElementHiddenForTTS = (element: Element): boolean => {
	if ((element as HTMLElement).hidden) return true;
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

const shouldInsertBoundarySpace = (
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
				const segmenter = new Segmenter(options?.locale, { granularity: "word" });
				const segments = Array.from(segmenter.segment(`${previousChar}${nextChar}`));
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
		if (parent && !isElementHiddenForTTS(parent)) {
			const raw = textNode.textContent || "";
			const firstVisibleMatch = raw.match(/\S/);
			const firstVisibleChar = firstVisibleMatch ? firstVisibleMatch[0] : null;

			if (
				!inLeadingWhitespace &&
				!lastCharWasWhitespace &&
				shouldInsertBoundarySpace(previousVisibleChar, firstVisibleChar, options)
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
