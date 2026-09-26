import { extractSpokenText } from "../ssml/spoken-text.js";
import { createSpeechAlignmentTokenPattern } from "../text-processing.js";
import type {
	AlignmentTextToken,
	BoundaryOffsetSpace,
	SpeechAlignmentToken,
} from "./types.js";

export interface SpeechSourceTokenization {
	speechText: string;
	spokenText: string;
	tokens: SpeechAlignmentToken[];
	rawToSpokenOffsetMap: Map<number, number>;
	boundaryOffsetSpace: BoundaryOffsetSpace;
	unsupportedSemantic: boolean;
	hasMarkup: boolean;
}

export interface ResolvedSpeechBoundary {
	token: SpeechAlignmentToken;
	start: number;
	length: number;
	confidence: number;
}

// The one tokenizer and normalization table for TTS alignment. Spoken text,
// visible catalog text and provider boundary words all tokenize here, so a word
// normalizes the same way on the catalog, math and generated-speech paths.
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

const normalizedTokenValue = (value: string): string => {
	const normalized = value.toLowerCase();
	return NUMERIC_WORDS.get(normalized) || normalized;
};

export const tokenizeAlignmentText = (text: string): AlignmentTextToken[] => {
	const tokens: AlignmentTextToken[] = [];
	for (const match of text.matchAll(TOKEN_PATTERN)) {
		const value = match[0];
		const start = match.index ?? 0;
		tokens.push({
			text: value,
			normalized: normalizedTokenValue(value),
			start,
			end: start + value.length,
		});
	}
	return tokens;
};

const tokenizeSpokenText = (spokenText: string): SpeechAlignmentToken[] =>
	tokenizeAlignmentText(spokenText).map((token, index) => ({
		...token,
		id: `speech-token-${index}`,
		sourceStart: token.start,
		sourceEnd: token.end,
		coordinateSystem: "normalized-speech",
	}));

export const tokenizeSpeechSource = (args: {
	speechText: string;
}): SpeechSourceTokenization => {
	const extracted = extractSpokenText(args.speechText);
	return {
		speechText: args.speechText,
		spokenText: extracted.spokenText,
		tokens: tokenizeSpokenText(extracted.spokenText),
		rawToSpokenOffsetMap: extracted.rawToSpokenOffsetMap,
		boundaryOffsetSpace: extracted.unsupportedSemantic
			? "unsupported"
			: extracted.hasMarkup
				? "raw-ssml"
				: "plain-spoken-text",
		unsupportedSemantic: extracted.unsupportedSemantic,
		hasMarkup: extracted.hasMarkup,
	};
};

const isControlTagWord = (word?: string): boolean =>
	Boolean(word && /^<[^>]+>$/.test(word.trim()));

/**
 * A provider boundary word in the form spoken tokens compare in, or null when
 * the word carries no token (empty, a control tag, punctuation). The word goes
 * through the same SSML extraction as the chunk, so an entity-encoded word
 * normalizes to the text it encodes.
 */
export const normalizeBoundaryWord = (word?: string): string | null => {
	if (!word || isControlTagWord(word)) return null;
	return (
		tokenizeSpeechSource({ speechText: word }).tokens[0]?.normalized ?? null
	);
};

const findTokenAtOffset = (
	tokens: SpeechAlignmentToken[],
	offset: number,
): SpeechAlignmentToken | null =>
	tokens.find((token) => token.start <= offset && offset < token.end) || null;

const mapRawOffsetToSpokenOffset = (
	tokenization: SpeechSourceTokenization,
	position: number,
): number | null => {
	const direct = tokenization.rawToSpokenOffsetMap.get(position);
	if (direct !== undefined) return direct;
	for (
		let offset = position;
		offset < tokenization.speechText.length;
		offset++
	) {
		const mapped = tokenization.rawToSpokenOffsetMap.get(offset);
		if (mapped !== undefined) return mapped;
		if (tokenization.speechText[offset] === ">") break;
	}
	return null;
};

const candidateForOffset = (
	tokenization: SpeechSourceTokenization,
	offset: number | null,
	length: number,
): ResolvedSpeechBoundary | null => {
	if (offset === null) return null;
	const token = findTokenAtOffset(tokenization.tokens, offset);
	if (!token) return null;
	return {
		token,
		start: offset,
		length: Math.max(1, Math.min(length, token.end - offset)),
		confidence: 0.75,
	};
};

const candidateMatchesWord = (
	candidate: ResolvedSpeechBoundary | null,
	normalizedWord: string | null,
): candidate is ResolvedSpeechBoundary =>
	Boolean(
		candidate &&
			normalizedWord &&
			candidate.token.normalized === normalizedWord,
	);

export const resolveBoundaryToSpeechToken = (args: {
	tokenization: SpeechSourceTokenization;
	position: number;
	length?: number;
	boundaryWord?: string;
}): ResolvedSpeechBoundary | null => {
	if (
		args.tokenization.boundaryOffsetSpace === "unsupported" ||
		!Number.isFinite(args.position) ||
		isControlTagWord(args.boundaryWord)
	) {
		return null;
	}
	const safeLength = Math.max(
		1,
		Number.isFinite(args.length) ? args.length! : 1,
	);
	const normalizedWord = normalizeBoundaryWord(args.boundaryWord);
	const rawCandidate = candidateForOffset(
		args.tokenization,
		mapRawOffsetToSpokenOffset(args.tokenization, args.position),
		safeLength,
	);
	const plainCandidate = candidateForOffset(
		args.tokenization,
		args.position >= 0 && args.position < args.tokenization.spokenText.length
			? args.position
			: null,
		safeLength,
	);

	if (candidateMatchesWord(rawCandidate, normalizedWord)) {
		return { ...rawCandidate, confidence: 1 };
	}
	if (candidateMatchesWord(plainCandidate, normalizedWord)) {
		return { ...plainCandidate, confidence: 1 };
	}
	if (normalizedWord) return null;

	return args.tokenization.boundaryOffsetSpace === "raw-ssml"
		? rawCandidate || plainCandidate
		: plainCandidate || rawCandidate;
};

export const resolveSpokenOffsetToSpeechToken = (args: {
	tokenization: SpeechSourceTokenization;
	position: number;
	length?: number;
	boundaryWord?: string;
}): ResolvedSpeechBoundary | null => {
	if (
		args.tokenization.boundaryOffsetSpace === "unsupported" ||
		!Number.isFinite(args.position) ||
		isControlTagWord(args.boundaryWord)
	) {
		return null;
	}
	const safeLength = Math.max(
		1,
		Number.isFinite(args.length) ? args.length! : 1,
	);
	const normalizedWord = normalizeBoundaryWord(args.boundaryWord);
	const spokenCandidate = candidateForOffset(
		args.tokenization,
		args.position >= 0 && args.position < args.tokenization.spokenText.length
			? args.position
			: null,
		safeLength,
	);
	if (candidateMatchesWord(spokenCandidate, normalizedWord)) {
		return { ...spokenCandidate, confidence: 1 };
	}
	if (normalizedWord) return null;
	return spokenCandidate;
};
