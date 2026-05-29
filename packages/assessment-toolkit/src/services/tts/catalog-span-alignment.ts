import { normalizeTextForSpeech } from "./text-processing.js";

export type CatalogChunkPlaybackMode =
	| "exact-word"
	| "anchor-span"
	| "region-fallback";

export type BoundaryOffsetMode =
	| "plain-spoken-text"
	| "raw-ssml"
	| "unsupported";

export interface CatalogTextToken {
	text: string;
	normalized: string;
	start: number;
	end: number;
}

export interface CatalogSpanAnchor {
	spokenStart: number;
	spokenEnd: number;
	visibleStart: number;
	visibleEnd: number;
	score: number;
}

export interface CatalogSpanAlignment {
	speechText: string;
	spokenText: string;
	visibleText: string;
	playbackMode: CatalogChunkPlaybackMode;
	boundaryOffsetMode: BoundaryOffsetMode;
	anchors: CatalogSpanAnchor[];
	confidence: number;
	spokenTokens: CatalogTextToken[];
	visibleTokens: CatalogTextToken[];
	rawToSpokenOffsetMap: Map<number, number>;
}

interface SourceChar {
	char: string;
	rawOffset: number | null;
}

interface ExtractedCatalogSpeech {
	spokenText: string;
	rawToSpokenOffsetMap: Map<number, number>;
	unsupportedSemantic: boolean;
	hasMarkup: boolean;
}

interface MatchCandidate {
	spokenStartToken: number;
	spokenEndToken: number;
	visibleToken: number;
	score: number;
}

const STRUCTURAL_SSML_TAGS = new Set([
	"speak",
	"p",
	"s",
	"emphasis",
	"prosody",
	"say-as",
	"voice",
	"lang",
]);

const UNSUPPORTED_SEMANTIC_SSML_TAGS = new Set([
	"audio",
	"phoneme",
]);

// LIMITATION (i18n): word-level catalog↔visible alignment is currently
// English/Latin only — the tokenizer recognizes `[A-Za-z]` words and the phrase
// table below is English. Non-Latin scripts and other locales still get speech,
// they just degrade to coarse region highlighting rather than word tracking.
// Generalizing this (locale-aware tokenization + phrase tables) is intentionally
// out of scope here.
const TOKEN_PATTERN = /[A-Za-z]+|\d+(?:\.\d+)?|[±√=+\-*/()²³^\u2062]/gu;

const NUMERIC_WORDS = new Map<string, string>([
	["zero", "0"],
	["one", "1"],
	["two", "2"],
	["three", "3"],
	["four", "4"],
	["five", "5"],
	["six", "6"],
	["seven", "7"],
	["eight", "8"],
	["nine", "9"],
	["ten", "10"],
]);

const SPOKEN_PHRASE_TARGETS: Array<{
	phrase: string[];
	visible: string;
	score: number;
}> = [
	{ phrase: ["plus", "or", "minus"], visible: "±", score: 8 },
	{ phrase: ["square", "root"], visible: "√", score: 8 },
	{ phrase: ["divided", "by"], visible: "/", score: 7 },
	{ phrase: ["all", "over"], visible: "/", score: 7 },
	{ phrase: ["equals"], visible: "=", score: 7 },
	{ phrase: ["equal"], visible: "=", score: 7 },
	{ phrase: ["times"], visible: "\u2062", score: 7 },
	{ phrase: ["multiplied", "by"], visible: "\u2062", score: 7 },
	{ phrase: ["over"], visible: "/", score: 6 },
	{ phrase: ["squared"], visible: "²", score: 6 },
	{ phrase: ["squared"], visible: "2", score: 4 },
	{ phrase: ["negative"], visible: "-", score: 5 },
	{ phrase: ["minus"], visible: "-", score: 5 },
	{ phrase: ["plus"], visible: "+", score: 5 },
];

const decodeXmlEntities = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");

const appendSourceText = (
	chars: SourceChar[],
	value: string,
	rawOffset: number | null,
): void => {
	for (let i = 0; i < value.length; i++) {
		chars.push({
			char: value[i],
			rawOffset: rawOffset === null ? null : rawOffset + i,
		});
	}
};

const appendSpace = (chars: SourceChar[]): void => {
	chars.push({ char: " ", rawOffset: null });
};

const normalizeSourceChars = (
	chars: SourceChar[],
): { text: string; rawToSpokenOffsetMap: Map<number, number> } => {
	const rawToSpokenOffsetMap = new Map<number, number>();
	const out: string[] = [];
	let lastWasWhitespace = true;

	for (const sourceChar of chars) {
		const isWhitespace = /\s/.test(sourceChar.char);
		if (isWhitespace) {
			if (!lastWasWhitespace && out.length > 0) {
				out.push(" ");
				if (sourceChar.rawOffset !== null) {
					rawToSpokenOffsetMap.set(sourceChar.rawOffset, out.length - 1);
				}
			}
			lastWasWhitespace = true;
			continue;
		}
		out.push(sourceChar.char);
		if (sourceChar.rawOffset !== null) {
			rawToSpokenOffsetMap.set(sourceChar.rawOffset, out.length - 1);
		}
		lastWasWhitespace = false;
	}

	while (out.length > 0 && out[out.length - 1] === " ") {
		out.pop();
	}

	return { text: out.join(""), rawToSpokenOffsetMap };
};

const getTagName = (tagSource: string): string => {
	const match = tagSource.match(/^<\/?\s*([A-Za-z0-9:-]+)/);
	return match?.[1]?.toLowerCase() || "";
};

const getAttribute = (tagSource: string, name: string): string | null => {
	const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
	const match = tagSource.match(pattern);
	return decodeXmlEntities(match?.[2] ?? match?.[3] ?? "") || null;
};

const extractCatalogSpeech = (speechText: string): ExtractedCatalogSpeech => {
	const sourceChars: SourceChar[] = [];
	let unsupportedSemantic = false;
	let hasMarkup = false;
	let index = 0;

	while (index < speechText.length) {
		const char = speechText[index];
		if (char !== "<") {
			appendSourceText(sourceChars, char, index);
			index++;
			continue;
		}

		const closeIndex = speechText.indexOf(">", index + 1);
		if (closeIndex < 0) {
			appendSourceText(sourceChars, char, index);
			index++;
			continue;
		}

		hasMarkup = true;
		const tagSource = speechText.slice(index, closeIndex + 1);
		const tagName = getTagName(tagSource);
		const isClosing = /^<\s*\//.test(tagSource);
		const isSelfClosing = /\/\s*>$/.test(tagSource);

		if (!isClosing && tagName === "sub") {
			const alias = getAttribute(tagSource, "alias");
			if (!alias) {
				unsupportedSemantic = true;
				index = closeIndex + 1;
				continue;
			}
			appendSourceText(sourceChars, alias, null);
			const closingSub = speechText
				.toLowerCase()
				.indexOf("</sub>", closeIndex + 1);
			index = closingSub >= 0 ? closingSub + "</sub>".length : closeIndex + 1;
			continue;
		}

		if (!isClosing && tagName === "break") {
			appendSpace(sourceChars);
			index = closeIndex + 1;
			continue;
		}

		if (!isClosing && UNSUPPORTED_SEMANTIC_SSML_TAGS.has(tagName)) {
			unsupportedSemantic = true;
			if (isSelfClosing) {
				index = closeIndex + 1;
				continue;
			}
		}

		if (
			tagName &&
			!STRUCTURAL_SSML_TAGS.has(tagName) &&
			!UNSUPPORTED_SEMANTIC_SSML_TAGS.has(tagName) &&
			tagName !== "break" &&
			tagName !== "sub"
		) {
			unsupportedSemantic = true;
		}

		if (!isClosing && (tagName === "p" || tagName === "s")) {
			appendSpace(sourceChars);
		}
		index = closeIndex + 1;
	}

	const normalized = normalizeSourceChars(sourceChars);
	return {
		spokenText: normalizeTextForSpeech(normalized.text),
		rawToSpokenOffsetMap: normalized.rawToSpokenOffsetMap,
		unsupportedSemantic,
		hasMarkup,
	};
};

const tokenize = (text: string): CatalogTextToken[] => {
	const tokens: CatalogTextToken[] = [];
	for (const match of text.matchAll(TOKEN_PATTERN)) {
		const value = match[0];
		const start = match.index ?? 0;
		tokens.push({
			text: value,
			normalized: value.toLowerCase(),
			start,
			end: start + value.length,
		});
	}
	return tokens;
};

const normalizedTokenValue = (token: CatalogTextToken): string =>
	NUMERIC_WORDS.get(token.normalized) || token.normalized;

const createCandidates = (
	spokenTokens: CatalogTextToken[],
	visibleTokens: CatalogTextToken[],
): MatchCandidate[] => {
	const candidates: MatchCandidate[] = [];
	for (let spokenIndex = 0; spokenIndex < spokenTokens.length; spokenIndex++) {
		for (let visibleIndex = 0; visibleIndex < visibleTokens.length; visibleIndex++) {
			const spokenValue = normalizedTokenValue(spokenTokens[spokenIndex]);
			const visibleValue = normalizedTokenValue(visibleTokens[visibleIndex]);
			if (spokenValue === visibleValue) {
				candidates.push({
					spokenStartToken: spokenIndex,
					spokenEndToken: spokenIndex + 1,
					visibleToken: visibleIndex,
					score: 10,
				});
			}
		}

		for (const phraseTarget of SPOKEN_PHRASE_TARGETS) {
			const phraseTokens = spokenTokens.slice(
				spokenIndex,
				spokenIndex + phraseTarget.phrase.length,
			);
			if (phraseTokens.length !== phraseTarget.phrase.length) continue;
			if (
				!phraseTokens.every(
					(token, tokenIndex) =>
						token.normalized === phraseTarget.phrase[tokenIndex],
				)
			) {
				continue;
			}
			for (
				let visibleIndex = 0;
				visibleIndex < visibleTokens.length;
				visibleIndex++
			) {
				if (visibleTokens[visibleIndex].normalized !== phraseTarget.visible) {
					continue;
				}
				candidates.push({
					spokenStartToken: spokenIndex,
					spokenEndToken: spokenIndex + phraseTarget.phrase.length,
					visibleToken: visibleIndex,
					score: phraseTarget.score,
				});
			}
		}
	}
	return candidates;
};

const computeAnchors = (
	spokenTokens: CatalogTextToken[],
	visibleTokens: CatalogTextToken[],
): CatalogSpanAnchor[] => {
	const candidates = createCandidates(spokenTokens, visibleTokens).sort(
		(left, right) =>
			spokenTokens[left.spokenStartToken].start -
				spokenTokens[right.spokenStartToken].start ||
			visibleTokens[left.visibleToken].start - visibleTokens[right.visibleToken].start,
	);
	const bestScore = new Array(candidates.length).fill(0) as number[];
	const previous = new Array(candidates.length).fill(-1) as number[];

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		bestScore[i] = candidate.score;
		for (let j = 0; j < i; j++) {
			const prior = candidates[j];
			if (
				prior.spokenEndToken <= candidate.spokenStartToken &&
				prior.visibleToken < candidate.visibleToken
			) {
				const spokenGap = candidate.spokenStartToken - prior.spokenEndToken;
				const visibleGap = candidate.visibleToken - prior.visibleToken - 1;
				const gapPenalty = Math.max(0, Math.abs(spokenGap - visibleGap) - 2);
				const score = bestScore[j] + candidate.score - gapPenalty;
				if (score > bestScore[i]) {
					bestScore[i] = score;
					previous[i] = j;
				}
			}
		}
	}

	let bestIndex = -1;
	for (let i = 0; i < bestScore.length; i++) {
		if (bestIndex < 0 || bestScore[i] > bestScore[bestIndex]) {
			bestIndex = i;
		}
	}
	if (bestIndex < 0) return [];

	const chosen: MatchCandidate[] = [];
	let current = bestIndex;
	while (current >= 0) {
		chosen.unshift(candidates[current]);
		current = previous[current];
	}

	return chosen.map((candidate) => {
		const firstSpoken = spokenTokens[candidate.spokenStartToken];
		const lastSpoken = spokenTokens[candidate.spokenEndToken - 1];
		const visible = visibleTokens[candidate.visibleToken];
		return {
			spokenStart: firstSpoken.start,
			spokenEnd: lastSpoken.end,
			visibleStart: visible.start,
			visibleEnd: visible.end,
			score: candidate.score,
		};
	});
};

const scoreConfidence = (
	anchors: CatalogSpanAnchor[],
	spokenTokens: CatalogTextToken[],
	visibleTokens: CatalogTextToken[],
): number => {
	if (anchors.length === 0) return 0;
	const tokenCoverage =
		anchors.length / Math.max(1, Math.min(spokenTokens.length, visibleTokens.length));
	const averageScore =
		anchors.reduce((total, anchor) => total + anchor.score, 0) /
		anchors.length /
		10;
	return Math.min(1, tokenCoverage * averageScore);
};

export const createCatalogSpanAlignment = (args: {
	speechText: string;
	visibleText: string;
}): CatalogSpanAlignment => {
	const extracted = extractCatalogSpeech(args.speechText);
	const visibleText = normalizeTextForSpeech(args.visibleText);
	const spokenText = extracted.spokenText;
	const spokenTokens = tokenize(spokenText);
	const visibleTokens = tokenize(visibleText);
	const anchors = extracted.unsupportedSemantic
		? []
		: computeAnchors(spokenTokens, visibleTokens);
	const confidence = scoreConfidence(anchors, spokenTokens, visibleTokens);
	const isExact = spokenText === visibleText && spokenText.length > 0;
	const hasShortSingleExactAnchor =
		anchors.length === 1 &&
		anchors[0].score === 10 &&
		spokenTokens.length <= 2 &&
		visibleTokens.length <= 2;
	const playbackMode: CatalogChunkPlaybackMode = extracted.unsupportedSemantic
		? "region-fallback"
		: isExact
			? "exact-word"
			: anchors.length >= 2 || hasShortSingleExactAnchor
				? confidence >= 0.12
					? "anchor-span"
					: "region-fallback"
				: "region-fallback";
	const boundaryOffsetMode: BoundaryOffsetMode = extracted.unsupportedSemantic
		? "unsupported"
		: extracted.hasMarkup
			? "raw-ssml"
			: "plain-spoken-text";

	return {
		speechText: args.speechText,
		spokenText,
		visibleText,
		playbackMode,
		boundaryOffsetMode,
		anchors,
		confidence,
		spokenTokens,
		visibleTokens,
		rawToSpokenOffsetMap: extracted.rawToSpokenOffsetMap,
	};
};

const findTokenAtOffset = (
	tokens: CatalogTextToken[],
	offset: number,
): CatalogTextToken | null =>
	tokens.find((token) => token.start <= offset && offset < token.end) || null;

const normalizeBoundaryWord = (word?: string): string | null => {
	if (!word) return null;
	if (/^<[^>]+>$/.test(word.trim())) return null;
	const token = tokenize(word)[0];
	if (!token) return null;
	return NUMERIC_WORDS.get(token.normalized) || token.normalized;
};

const candidateMatchesBoundaryWord = (
	alignment: CatalogSpanAlignment,
	candidate: { start: number; length: number } | null,
	boundaryWord?: string,
): boolean => {
	const normalizedBoundary = normalizeBoundaryWord(boundaryWord);
	if (!candidate || !normalizedBoundary) return false;
	const token = findTokenAtOffset(alignment.spokenTokens, candidate.start);
	if (!token) return false;
	return normalizedTokenValue(token) === normalizedBoundary;
};

const mapRawOffsetToSpokenOffset = (
	alignment: CatalogSpanAlignment,
	position: number,
): number | null => {
	const direct = alignment.rawToSpokenOffsetMap.get(position);
	if (direct !== undefined) return direct;
	for (let offset = position; offset < alignment.speechText.length; offset++) {
		const mapped = alignment.rawToSpokenOffsetMap.get(offset);
		if (mapped !== undefined) return mapped;
		if (alignment.speechText[offset] === ">") break;
	}
	return null;
};

const resolveRawBoundaryOffset = (
	alignment: CatalogSpanAlignment,
	position: number,
	safeLength: number,
): { start: number; length: number } | null => {
	const mappedStart = mapRawOffsetToSpokenOffset(alignment, position);
	if (mappedStart === null) return null;
	const mappedEnd = mapRawOffsetToSpokenOffset(
		alignment,
		Math.max(position, position + safeLength - 1),
	);
	const token = findTokenAtOffset(alignment.spokenTokens, mappedStart);
	const mappedLength =
		mappedEnd !== null && mappedEnd >= mappedStart
			? mappedEnd - mappedStart + 1
			: token
				? token.end - mappedStart
				: safeLength;
	return { start: mappedStart, length: Math.max(1, mappedLength) };
};

const resolvePlainBoundaryOffset = (
	alignment: CatalogSpanAlignment,
	position: number,
	safeLength: number,
): { start: number; length: number } | null => {
	if (position < 0 || position >= alignment.spokenText.length) return null;
	const token = findTokenAtOffset(alignment.spokenTokens, position);
	if (!token) return null;
	return { start: position, length: Math.min(safeLength, token.end - position) };
};

export const resolveSpokenBoundaryOffset = (
	alignment: CatalogSpanAlignment,
	position: number,
	length = 1,
	boundaryWord?: string,
): { start: number; length: number } | null => {
	if (
		alignment.boundaryOffsetMode === "unsupported" ||
		!Number.isFinite(position)
	) {
		return null;
	}
	const safeLength = Math.max(1, Number.isFinite(length) ? length : 1);
	if (boundaryWord && /^<[^>]+>$/.test(boundaryWord.trim())) return null;
	if (alignment.boundaryOffsetMode === "raw-ssml") {
		const rawCandidate = resolveRawBoundaryOffset(
			alignment,
			position,
			safeLength,
		);
		const plainCandidate = resolvePlainBoundaryOffset(
			alignment,
			position,
			safeLength,
		);
		if (boundaryWord) {
			if (
				candidateMatchesBoundaryWord(alignment, rawCandidate, boundaryWord)
			) {
				return rawCandidate;
			}
			if (
				candidateMatchesBoundaryWord(alignment, plainCandidate, boundaryWord)
			) {
				return plainCandidate;
			}
			if (normalizeBoundaryWord(boundaryWord)) return null;
		}
		return rawCandidate || plainCandidate;
	}
	return (
		resolvePlainBoundaryOffset(alignment, position, safeLength) ||
		resolveRawBoundaryOffset(alignment, position, safeLength)
	);
};

export const resolveVisibleSpanForBoundary = (
	alignment: CatalogSpanAlignment,
	spokenOffset: number,
): { start: number; end: number } | null => {
	if (alignment.playbackMode === "region-fallback") return null;
	const exactAnchor = alignment.anchors.find(
		(anchor) => anchor.spokenStart <= spokenOffset && spokenOffset < anchor.spokenEnd,
	);
	if (exactAnchor) {
		return { start: exactAnchor.visibleStart, end: exactAnchor.visibleEnd };
	}

	let previous: CatalogSpanAnchor | null = null;
	let next: CatalogSpanAnchor | null = null;
	for (const anchor of alignment.anchors) {
		if (anchor.spokenEnd <= spokenOffset) {
			previous = anchor;
			continue;
		}
		if (anchor.spokenStart > spokenOffset) {
			next = anchor;
			break;
		}
	}
	if (previous && next) {
		return {
			start: Math.min(previous.visibleStart, next.visibleStart),
			end: Math.max(previous.visibleEnd, next.visibleEnd),
		};
	}
	return null;
};
