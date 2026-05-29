import { tokenizeMathML } from "./mathml-tokenizer.js";
import {
	resolveMatchedHighlightTargetForBoundary as resolveMatchedTargetForBoundary,
	resolveHighlightTargetForBoundary as resolveTargetForBoundary,
} from "./range-resolver.js";
import { alignSpeechToMath } from "./sequence-aligner.js";
import {
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
	type SpeechSourceTokenization,
} from "./speech-tokenizer.js";
import type {
	AlignmentResult,
	HighlightTarget,
	MathMLTokenizationResult,
} from "./types.js";

export interface MathAwareAlignment {
	speech: SpeechSourceTokenization;
	math: MathMLTokenizationResult;
	result: AlignmentResult;
}

export const createMathAwareAlignment = (args: {
	mathElement: Element;
	speechText: string;
}): MathAwareAlignment => {
	const speech = tokenizeSpeechSource({ speechText: args.speechText });
	const math = tokenizeMathML(args.mathElement);
	return {
		speech,
		math,
		result: alignSpeechToMath({ speech, math }),
	};
};

export const resolveHighlightTargetForBoundary = (
	alignment: MathAwareAlignment,
	args: {
		position: number;
		length?: number;
		boundaryWord?: string;
	},
): HighlightTarget => {
	const boundary = resolveBoundaryToSpeechToken({
		tokenization: alignment.speech,
		position: args.position,
		length: args.length,
		boundaryWord: args.boundaryWord,
	});
	return resolveTargetForBoundary({
		alignment: alignment.result,
		boundary,
	});
};

export const resolveMatchedHighlightTargetForBoundary = (
	alignment: MathAwareAlignment,
	args: {
		position: number;
		length?: number;
		boundaryWord?: string;
	},
): HighlightTarget | null => {
	const boundary = resolveBoundaryToSpeechToken({
		tokenization: alignment.speech,
		position: args.position,
		length: args.length,
		boundaryWord: args.boundaryWord,
	});
	return resolveMatchedTargetForBoundary({
		alignment: alignment.result,
		boundary,
	});
};

export const resolveUniqueMathTargetForBoundaryWord = (
	alignment: MathAwareAlignment,
	args: {
		boundaryWord?: string;
	},
): HighlightTarget | null => {
	if (!args.boundaryWord || /^<[^>]+>$/.test(args.boundaryWord.trim())) {
		return null;
	}
	const boundaryToken = tokenizeSpeechSource({
		speechText: args.boundaryWord,
	}).tokens[0];
	if (!boundaryToken) return null;
	const matches = alignment.math.tokens.filter((token) => {
		const normalized = boundaryToken.normalized.toLowerCase();
		return (
			token.normalized.toLowerCase() === normalized ||
			token.spokenAliases.some((alias) => alias.toLowerCase() === normalized)
		);
	});
	return matches.length === 1 ? matches[0].target : null;
};

export type * from "./types.js";
