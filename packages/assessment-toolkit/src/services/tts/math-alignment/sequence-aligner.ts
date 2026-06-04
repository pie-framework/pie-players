import type {
	AlignmentResult,
	AlignmentSegment,
	MathAlignmentToken,
	MathMLTokenizationResult,
	SpeechAlignmentToken,
} from "./types.js";
import type { SpeechSourceTokenization } from "./speech-tokenizer.js";

const MIN_EXACT_WORD_CONFIDENCE = 0.95;

interface PhraseMatch {
	speechTokens: SpeechAlignmentToken[];
	math: MathAlignmentToken;
}

// Candidate spoken forms for a math token: its own normalized value plus every
// spoken alias, each split into the sequence of words a TTS engine emits (e.g.
// "÷" → ["divided", "by"], "≤" → ["less", "than", "or", "equal", "to"]). This is
// what lets multi-word operator names match — a single speech token can never
// equal "divided by". Speech tokens are already number-word normalized by the
// speech tokenizer (two → 2), so no numeric mapping is repeated here.
const candidatePhrasesFor = (math: MathAlignmentToken): string[][] => {
	const phrases: string[][] = [];
	const seen = new Set<string>();
	const add = (value: string): void => {
		const words = value.toLowerCase().trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) return;
		const key = words.join(" ");
		if (seen.has(key)) return;
		seen.add(key);
		phrases.push(words);
	};
	add(math.normalized);
	for (const alias of math.spokenAliases) add(alias);
	return phrases;
};

// Length (in speech tokens) of the longest candidate phrase that matches the
// run of speech tokens starting at `startIndex`, or 0 if none match. Longest
// match wins so a multi-word alias is preferred over a coincidental one-word
// prefix.
const matchPhraseLengthAt = (
	speechTokens: SpeechAlignmentToken[],
	startIndex: number,
	phrases: string[][],
): number => {
	let best = 0;
	for (const phrase of phrases) {
		if (phrase.length <= best) continue;
		let matched = true;
		for (let i = 0; i < phrase.length; i++) {
			const token = speechTokens[startIndex + i];
			if (!token || token.normalized.toLowerCase() !== phrase[i]) {
				matched = false;
				break;
			}
		}
		if (matched) best = phrase.length;
	}
	return best;
};

// Greedy forward (monotonic) pass: each math token consumes the next run of
// speech tokens that spells one of its candidate phrases. Optional math tokens
// (invisible operators, grouping fences) are consumed only when present.
// Unmatched speech tokens are skipped, which the perfect-cover check below then
// treats as a miss.
const computeMonotonicMatches = (
	speechTokens: SpeechAlignmentToken[],
	mathTokens: MathAlignmentToken[],
): PhraseMatch[] => {
	const matches: PhraseMatch[] = [];
	let speechIndex = 0;

	for (const math of mathTokens) {
		const phrases = candidatePhrasesFor(math);
		if (math.optional) {
			const consumed = matchPhraseLengthAt(speechTokens, speechIndex, phrases);
			if (consumed > 0) {
				matches.push({
					speechTokens: speechTokens.slice(speechIndex, speechIndex + consumed),
					math,
				});
				speechIndex += consumed;
			}
			continue;
		}
		while (speechIndex < speechTokens.length) {
			const consumed = matchPhraseLengthAt(speechTokens, speechIndex, phrases);
			if (consumed > 0) {
				matches.push({
					speechTokens: speechTokens.slice(speechIndex, speechIndex + consumed),
					math,
				});
				speechIndex += consumed;
				break;
			}
			speechIndex++;
		}
	}

	return matches;
};

// Word-level highlighting is all-or-nothing: it is emitted only when every
// required math token AND every spoken token is accounted for. Anything less
// falls back to a coarse whole-expression highlight, because "false positives
// are worse than coarse highlighting" — a partial alignment risks underlining
// the wrong glyph.
const isPerfectCover = (
	matches: PhraseMatch[],
	speechTokens: SpeechAlignmentToken[],
	mathTokens: MathAlignmentToken[],
): boolean => {
	const requiredTokenCount = mathTokens.filter(
		(token) => !token.optional,
	).length;
	const requiredMatched = matches.filter(
		(match) => !match.math.optional,
	).length;
	const consumedSpeech = matches.reduce(
		(total, match) => total + match.speechTokens.length,
		0,
	);
	return (
		requiredTokenCount > 0 &&
		requiredMatched === requiredTokenCount &&
		consumedSpeech === speechTokens.length
	);
};

const createSegments = (matches: PhraseMatch[]): AlignmentSegment[] =>
	matches.map(({ speechTokens, math }) => ({
		// Every spoken word that spells this math token maps back to it, so a
		// boundary on any of those words ("divided" or "by") resolves to the
		// same glyph.
		speechTokenIds: speechTokens.map((token) => token.id),
		mathTokenIds: [math.id],
		score: 1,
		confidence: 1,
		target: math.target,
	}));

export const alignSpeechToMath = (args: {
	speech: SpeechSourceTokenization;
	math: MathMLTokenizationResult;
	minExactWordConfidence?: number;
}): AlignmentResult => {
	const minConfidence =
		args.minExactWordConfidence ?? MIN_EXACT_WORD_CONFIDENCE;
	const matches = computeMonotonicMatches(args.speech.tokens, args.math.tokens);
	const confidence = isPerfectCover(
		matches,
		args.speech.tokens,
		args.math.tokens,
	)
		? 1
		: 0;

	return {
		segments: confidence >= minConfidence ? createSegments(matches) : [],
		confidence,
		fallbackTarget: args.math.expressionTarget,
	};
};
