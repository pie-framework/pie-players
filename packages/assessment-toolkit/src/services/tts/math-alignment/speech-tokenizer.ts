import { extractSpokenText } from "../ssml/spoken-text.js";
import type {
	BoundaryOffsetSpace,
	SpeechAlignmentToken,
} from "./types.js";
import { createSpeechAlignmentTokenPattern } from "../text-processing.js";

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

// Shared Unicode-aware tokenizer, identical to the catalog span aligner's, so
// spoken text tokenizes the same way on both paths (see
// `createSpeechAlignmentTokenPattern`).
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

const tokenizeSpokenText = (spokenText: string): SpeechAlignmentToken[] => {
	const tokens: SpeechAlignmentToken[] = [];
	for (const match of spokenText.matchAll(TOKEN_PATTERN)) {
		const text = match[0];
		const start = match.index ?? 0;
		tokens.push({
			id: `speech-token-${tokens.length}`,
			text,
			normalized: normalizedTokenValue(text),
			start,
			end: start + text.length,
			sourceStart: start,
			sourceEnd: start + text.length,
			coordinateSystem: "normalized-speech",
		});
	}
	return tokens;
};

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

const normalizeBoundaryWord = (word?: string): string | null => {
	if (!word) return null;
	if (/^<[^>]+>$/.test(word.trim())) return null;
	const match = word.match(TOKEN_PATTERN);
	if (!match?.[0]) return null;
	return normalizedTokenValue(match[0]);
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
	for (let offset = position; offset < tokenization.speechText.length; offset++) {
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
	boundaryWord?: string,
): boolean => {
	const normalizedBoundary = normalizeBoundaryWord(boundaryWord);
	return Boolean(
		candidate &&
			normalizedBoundary &&
			candidate.token.normalized === normalizedBoundary,
	);
};

export const resolveBoundaryToSpeechToken = (args: {
	tokenization: SpeechSourceTokenization;
	position: number;
	length?: number;
	boundaryWord?: string;
}): ResolvedSpeechBoundary | null => {
	if (
		args.tokenization.boundaryOffsetSpace === "unsupported" ||
		!Number.isFinite(args.position) ||
		(args.boundaryWord && /^<[^>]+>$/.test(args.boundaryWord.trim()))
	) {
		return null;
	}
	const safeLength = Math.max(1, Number.isFinite(args.length) ? args.length! : 1);
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

	if (candidateMatchesWord(rawCandidate, args.boundaryWord)) {
		return { ...rawCandidate!, confidence: 1 };
	}
	if (candidateMatchesWord(plainCandidate, args.boundaryWord)) {
		return { ...plainCandidate!, confidence: 1 };
	}
	if (args.boundaryWord && normalizeBoundaryWord(args.boundaryWord)) {
		return null;
	}

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
		(args.boundaryWord && /^<[^>]+>$/.test(args.boundaryWord.trim()))
	) {
		return null;
	}
	const safeLength = Math.max(1, Number.isFinite(args.length) ? args.length! : 1);
	const spokenCandidate = candidateForOffset(
		args.tokenization,
		args.position >= 0 && args.position < args.tokenization.spokenText.length
			? args.position
			: null,
		safeLength,
	);
	if (candidateMatchesWord(spokenCandidate, args.boundaryWord)) {
		return { ...spokenCandidate!, confidence: 1 };
	}
	if (args.boundaryWord && normalizeBoundaryWord(args.boundaryWord)) {
		return null;
	}
	return spokenCandidate;
};
