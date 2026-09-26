import {
	type SpeechSourceTokenization,
	tokenizeAlignmentText,
	tokenizeSpeechSource,
} from "./math-alignment/speech-tokenizer.js";
import type { AlignmentTextToken } from "./math-alignment/types.js";
import { normalizeTextForSpeech } from "./text-processing.js";

export type CatalogChunkPlaybackMode =
	| "exact-word"
	| "anchor-span"
	| "region-fallback";

export interface CatalogSpanAnchor {
	spokenStart: number;
	spokenEnd: number;
	visibleStart: number;
	visibleEnd: number;
	score: number;
}

export interface CatalogSpanAlignment {
	speech: SpeechSourceTokenization;
	visibleText: string;
	playbackMode: CatalogChunkPlaybackMode;
	anchors: CatalogSpanAnchor[];
	confidence: number;
}

interface MatchCandidate {
	spokenStartToken: number;
	spokenEndToken: number;
	visibleToken: number;
	score: number;
}

// LIMITATION (i18n): the phrase table is English, so multi-word operator
// phrases ("plus or minus", "divided by") only align for English speech; other
// locales degrade to coarse region highlighting.
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

const createCandidates = (
	spokenTokens: AlignmentTextToken[],
	visibleTokens: AlignmentTextToken[],
): MatchCandidate[] => {
	const candidates: MatchCandidate[] = [];
	for (let spokenIndex = 0; spokenIndex < spokenTokens.length; spokenIndex++) {
		for (
			let visibleIndex = 0;
			visibleIndex < visibleTokens.length;
			visibleIndex++
		) {
			if (
				spokenTokens[spokenIndex].normalized ===
				visibleTokens[visibleIndex].normalized
			) {
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
				// Glyph targets compare against the visible text as written, so a
				// visible number word ("two") never stands in for the digit "2".
				if (visibleTokens[visibleIndex].text !== phraseTarget.visible) {
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
	spokenTokens: AlignmentTextToken[],
	visibleTokens: AlignmentTextToken[],
): CatalogSpanAnchor[] => {
	const candidates = createCandidates(spokenTokens, visibleTokens).sort(
		(left, right) =>
			spokenTokens[left.spokenStartToken].start -
				spokenTokens[right.spokenStartToken].start ||
			visibleTokens[left.visibleToken].start -
				visibleTokens[right.visibleToken].start,
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
	spokenTokens: AlignmentTextToken[],
	visibleTokens: AlignmentTextToken[],
): number => {
	if (anchors.length === 0) return 0;
	const tokenCoverage =
		anchors.length /
		Math.max(1, Math.min(spokenTokens.length, visibleTokens.length));
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
	const speech = tokenizeSpeechSource({ speechText: args.speechText });
	const visibleText = normalizeTextForSpeech(args.visibleText);
	const spokenTokens = speech.tokens;
	const visibleTokens = tokenizeAlignmentText(visibleText);
	const anchors = speech.unsupportedSemantic
		? []
		: computeAnchors(spokenTokens, visibleTokens);
	const confidence = scoreConfidence(anchors, spokenTokens, visibleTokens);
	const isExact =
		speech.spokenText === visibleText && speech.spokenText.length > 0;
	const hasShortSingleExactAnchor =
		anchors.length === 1 &&
		anchors[0].score === 10 &&
		spokenTokens.length <= 2 &&
		visibleTokens.length <= 2;
	const playbackMode: CatalogChunkPlaybackMode = speech.unsupportedSemantic
		? "region-fallback"
		: isExact
			? "exact-word"
			: anchors.length >= 2 || hasShortSingleExactAnchor
				? confidence >= 0.12
					? "anchor-span"
					: "region-fallback"
				: "region-fallback";

	return {
		speech,
		visibleText,
		playbackMode,
		anchors,
		confidence,
	};
};

export const resolveVisibleSpanForBoundary = (
	alignment: CatalogSpanAlignment,
	spokenOffset: number,
): { start: number; end: number } | null => {
	if (alignment.playbackMode === "region-fallback") return null;
	const exactAnchor = alignment.anchors.find(
		(anchor) =>
			anchor.spokenStart <= spokenOffset && spokenOffset < anchor.spokenEnd,
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
