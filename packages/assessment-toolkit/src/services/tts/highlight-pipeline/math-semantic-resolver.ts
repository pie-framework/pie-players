import {
	resolveMatchedHighlightTargetForBoundary,
	resolveUniqueMathTargetForBoundaryWord,
} from "../math-alignment/index.js";
import {
	resolveRenderedMathTarget,
	type RenderedMathTargetResolver,
} from "./rendered-math-target-resolver.js";
import type {
	NormalizedBoundaryEvent,
	RenderableHighlightTarget,
	TTSBoundaryEvent,
	TTSHighlightChunk,
} from "./types.js";

export const resolveMathBoundaryTarget = (
	chunk: TTSHighlightChunk,
	boundary: NormalizedBoundaryEvent,
	event: TTSBoundaryEvent,
	candidates: TTSHighlightChunk["mathAlignments"] = chunk.mathAlignments,
	renderedResolver: RenderedMathTargetResolver = resolveRenderedMathTarget,
): RenderableHighlightTarget | null => {
	if (boundary.chunkSpokenStart === null || boundary.chunkSpokenEnd === null) {
		return null;
	}
	// Prefer a precise per-token target across all candidate equations before
	// settling for a coarse expression fallback: scan every candidate for a
	// semantic-token first, remembering the first expression-quality hit only as
	// a last resort.
	let expressionFallback: RenderableHighlightTarget | null = null;
	for (const mathAlignment of candidates) {
		const target =
			resolveMatchedHighlightTargetForBoundary(mathAlignment.alignment, {
				position: boundary.chunkSpokenStart,
				length: Math.max(
					1,
					boundary.chunkSpokenEnd - boundary.chunkSpokenStart,
				),
				boundaryWord: event.word,
			}) ||
			resolveUniqueMathTargetForBoundaryWord(mathAlignment.alignment, {
				boundaryWord: event.word,
			});
		if (!target) continue;
		const rendered = renderedResolver(target);
		if (!rendered) continue;
		if (rendered.quality === "semantic-token") return rendered;
		expressionFallback ??= rendered;
	}
	return expressionFallback;
};
