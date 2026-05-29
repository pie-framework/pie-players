import type {
	BoundaryOffsetSpace,
	SpeechAlignmentToken,
} from "./types.js";
import {
	createSpeechAlignmentTokenPattern,
	normalizeTextForSpeech,
} from "../text-processing.js";

interface SourceChar {
	char: string;
	rawOffset: number | null;
}

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

const UNSUPPORTED_SEMANTIC_SSML_TAGS = new Set(["audio", "phoneme"]);

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

const decodeXmlEntities = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, "\u00a0")
		.replace(/&#160;/g, "\u00a0")
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

	// Drop any raw→spoken entries that now point past the trimmed end; otherwise
	// a boundary at a trailing space would map to an out-of-range spoken offset.
	for (const [rawOffset, spokenOffset] of rawToSpokenOffsetMap) {
		if (spokenOffset >= out.length) rawToSpokenOffsetMap.delete(rawOffset);
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

const extractSpeech = (
	speechText: string,
): Pick<
	SpeechSourceTokenization,
	"spokenText" | "rawToSpokenOffsetMap" | "unsupportedSemantic" | "hasMarkup"
> => {
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

export const tokenizeSpeechSource = (args: {
	speechText: string;
}): SpeechSourceTokenization => {
	const extracted = extractSpeech(args.speechText);
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
