import { extractSpokenText } from "./ssml/spoken-text.js";
import {
	createSpeechAlignmentTokenPattern,
	normalizeTextForSpeech,
} from "./text-processing.js";

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

interface MatchCandidate {
	spokenStartToken: number;
	spokenEndToken: number;
	visibleToken: number;
	score: number;
}

// Shared Unicode-aware tokenizer (see `createSpeechAlignmentTokenPattern`), so
// accented Latin and non-Latin words tokenize the same way here as in the math
// speech tokenizer. LIMITATION (i18n): the phrase table below is still English,
// so multi-word operator phrases ("plus or minus", "divided by") only align for
// English speech; other locales degrade to coarse region highlighting. A fresh
// pattern per call because of the global flag's mutable `lastIndex`.
const TOKEN_PATTERN = createSpeechAlignmentTokenPattern();

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
	const extracted = extractSpokenText(args.speechText);
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
