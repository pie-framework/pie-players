import type { HighlightDecision, HighlightDecisionInput } from "./types.js";

export const createHighlightDecision = (
	input: HighlightDecisionInput,
): HighlightDecision => {
	if (input.semanticTarget) {
		return {
			activeTarget: input.semanticTarget,
			regionTarget: input.regionTarget,
			quality:
				input.semanticTarget.quality === "exact-word"
					? "exact-word"
					: input.semanticTarget.quality === "expression"
						? "expression"
						: "semantic-token",
			confidence: input.confidence,
			reason: input.reason,
		};
	}
	if (input.expressionTarget) {
		return {
			activeTarget: input.expressionTarget,
			regionTarget: input.regionTarget,
			quality: "expression",
			confidence: input.confidence,
			reason: input.reason,
		};
	}
	return {
		activeTarget: null,
		regionTarget: input.regionTarget,
		quality: "region",
		confidence: input.confidence,
		reason: input.reason,
	};
};
