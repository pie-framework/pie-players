import type { AlignmentResult, HighlightTarget } from "./types.js";
import type { ResolvedSpeechBoundary } from "./speech-tokenizer.js";

export const resolveHighlightTargetForBoundary = (args: {
	alignment: AlignmentResult;
	boundary: ResolvedSpeechBoundary | null;
}): HighlightTarget => {
	if (!args.boundary) return args.alignment.fallbackTarget;
	const segment = args.alignment.segments.find((candidate) =>
		candidate.speechTokenIds.includes(args.boundary!.token.id),
	);
	return segment?.target || args.alignment.fallbackTarget;
};

export const resolveMatchedHighlightTargetForBoundary = (args: {
	alignment: AlignmentResult;
	boundary: ResolvedSpeechBoundary | null;
}): HighlightTarget | null => {
	if (!args.boundary) return null;
	const segment = args.alignment.segments.find((candidate) =>
		candidate.speechTokenIds.includes(args.boundary!.token.id),
	);
	return segment?.target || null;
};
