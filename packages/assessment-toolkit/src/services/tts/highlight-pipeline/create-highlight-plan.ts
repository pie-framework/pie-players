import { normalizeBoundaryEvent } from "./boundary-normalizer.js";
import { createHighlightDecision } from "./highlight-policy.js";
import { resolveMathBoundaryTarget } from "./math-semantic-resolver.js";
import { resolveProseBoundaryTarget } from "./prose-boundary-resolver.js";
import {
	classifyMathHighlightCapability,
	createRenderedMathTargetResolver,
	type MathHighlightCapability,
	type RenderedMathTargetResolver,
} from "./rendered-math-target-resolver.js";
import type {
	HighlightDecision,
	RenderableHighlightTarget,
	TTSBoundaryEvent,
	TTSHighlightChunk,
	TTSHighlightPlan,
} from "./types.js";

export interface CreateTTSHighlightPlanArgs {
	chunks: TTSHighlightChunk[];
	// When false, math is never broken into per-token highlights: every equation
	// is painted as a single block — the same expression/region fallback used
	// whenever token alignment is not confident. Prose word tracking is
	// unaffected. Defaults to true.
	mathTokenHighlighting?: boolean;
}

interface PlannedChunk {
	chunk: TTSHighlightChunk;
	regionTarget: RenderableHighlightTarget | null;
	renderedMathTargetResolver: RenderedMathTargetResolver;
	// Capability decided once per equation (keyed by its source math element).
	// Sticky for the whole chunk so the same equation never switches between
	// token tracking and whole-expression highlighting mid-read.
	mathCapabilityByElement: Map<Element, MathHighlightCapability>;
	// The last precise token painted for each token-mode equation. Lets a gap
	// (SSML break / pause / unmappable boundary) hold the last token instead of
	// flashing the whole expression.
	heldTokenByElement: Map<Element, RenderableHighlightTarget>;
}

const regionTargetFor = (
	chunk: TTSHighlightChunk,
): RenderableHighlightTarget | null =>
	chunk.regionRange
		? {
				type: "range",
				quality: "region",
				range: chunk.regionRange,
			}
		: chunk.regionElement
			? {
					type: "element",
					quality: "region",
					element: chunk.regionElement,
				}
			: null;

const expressionTargetFor = (
	planned: PlannedChunk,
	candidates: TTSHighlightChunk["mathAlignments"] = planned.chunk
		.mathAlignments,
): RenderableHighlightTarget | null => {
	if (candidates.length !== 1) return null;
	const fallback = candidates[0]?.alignment.result.fallbackTarget;
	return fallback ? planned.renderedMathTargetResolver(fallback) : null;
};

const mathCandidatesForTarget = (
	target: RenderableHighlightTarget | null,
	chunk: TTSHighlightChunk,
): TTSHighlightChunk["mathAlignments"] => {
	if (!target) return chunk.mathAlignments;
	return chunk.mathAlignments.filter(({ element }) => {
		try {
			if (target.type === "range") return target.range.intersectsNode(element);
			if (target.type === "element") {
				return target.element === element || target.element.contains(element);
			}
			return target.node.parentElement?.contains(element) || false;
		} catch {
			return false;
		}
	});
};

const missingChunkDecision = (): HighlightDecision => ({
	activeTarget: null,
	regionTarget: null,
	quality: "region",
	confidence: 0,
	reason: "boundary chunk id was not found",
});

const soleEquationElement = (
	candidates: TTSHighlightChunk["mathAlignments"],
): Element | null => (candidates.length === 1 ? candidates[0].element : null);

const everyCandidateIsTokenMode = (
	planned: PlannedChunk,
	candidates: TTSHighlightChunk["mathAlignments"],
): boolean =>
	candidates.length > 0 &&
	candidates.every(
		({ element }) => planned.mathCapabilityByElement.get(element) === "token",
	);

const TEXT_NODE = 3;

// Safety policy for token-mode equations. A prose "range" target comes from the
// catalog span aligner, whose spoken→visible mapping inside an equation is
// heuristic and not trustworthy at glyph granularity. A multi-node range fully
// inside a token-mode equation is therefore rejected here in favor of holding
// the last token — painting it would be a likely false positive, and "false
// positives are worse than coarse highlighting." A single-text-node prose range
// is kept: it underlines one token cleanly and usefully fills in any token the
// math resolver missed. (The highlight coordinator no longer escalates word
// ranges to the whole <math> / <mjx-container>, so this is now a precision
// policy rather than flash-suppression — see HighlightCoordinator
// WORD_FALLBACK_SELECTOR.)
const wouldEscalateInsideTokenMath = (
	planned: PlannedChunk,
	target: RenderableHighlightTarget | null,
	candidates: TTSHighlightChunk["mathAlignments"],
): boolean => {
	if (!target || target.type !== "range") return false;
	const { startContainer, endContainer } = target.range;
	const singleTextNode =
		startContainer === endContainer && startContainer.nodeType === TEXT_NODE;
	if (singleTextNode) return false;
	return candidates.some(
		({ element }) =>
			planned.mathCapabilityByElement.get(element) === "token" &&
			element.contains(startContainer) &&
			element.contains(endContainer),
	);
};

const createPlannedChunk = (
	chunk: TTSHighlightChunk,
	mathTokenHighlighting: boolean,
): PlannedChunk => ({
	chunk,
	regionTarget: regionTargetFor(chunk),
	renderedMathTargetResolver: createRenderedMathTargetResolver(),
	mathCapabilityByElement: new Map(
		chunk.mathAlignments.map(({ element }) => [
			element,
			// Forcing "expression" when per-token math highlighting is disabled
			// routes every equation through the sticky whole-block path, so the
			// formula is highlighted as one unit instead of glyph by glyph.
			mathTokenHighlighting
				? classifyMathHighlightCapability(element)
				: "expression",
		]),
	),
	heldTokenByElement: new Map(),
});

export const createTTSHighlightPlan = (
	args: CreateTTSHighlightPlanArgs,
): TTSHighlightPlan => {
	const mathTokenHighlighting = args.mathTokenHighlighting !== false;
	const plannedChunksById = new Map(
		args.chunks.map((chunk) => [
			chunk.id,
			createPlannedChunk(chunk, mathTokenHighlighting),
		]),
	);
	return {
		chunks: args.chunks,
		resolveInitial(chunkId: string): HighlightDecision {
			const planned = plannedChunksById.get(chunkId);
			if (!planned) return missingChunkDecision();
			const alignments = planned.chunk.mathAlignments;
			const soleElement = alignments.length === 1 ? alignments[0].element : null;
			const capability = soleElement
				? planned.mathCapabilityByElement.get(soleElement)
				: null;
			// Sticky mode. Only an equation we already know cannot be tracked per
			// token gets the whole-expression paint up front. A token-mode equation
			// stays on the region layer until its first token resolves, so the full
			// equation never flashes before (or between) tokens.
			if (capability === "expression") {
				return createHighlightDecision({
					semanticTarget: null,
					expressionTarget: expressionTargetFor(planned),
					regionTarget: planned.regionTarget,
					confidence: 0.5,
					reason: "initial expression (sticky expression mode)",
				});
			}
			return createHighlightDecision({
				semanticTarget: null,
				expressionTarget: null,
				regionTarget: planned.regionTarget,
				confidence: 0,
				reason:
					capability === "token"
						? "initial region (sticky token mode, awaiting first token)"
						: "initial region fallback",
			});
		},
		resolveBoundary(event: TTSBoundaryEvent): HighlightDecision {
			const planned = plannedChunksById.get(event.chunkId);
			if (!planned) return missingChunkDecision();
			const { chunk } = planned;
			const normalized = normalizeBoundaryEvent(chunk, event);
			const proseTarget = resolveProseBoundaryTarget(chunk, normalized);
			const mathCandidates = mathCandidatesForTarget(proseTarget, chunk);
			const mathTarget =
				(!proseTarget || mathCandidates.length > 0
					? resolveMathBoundaryTarget(
							chunk,
							normalized,
							event,
							mathCandidates,
							planned.renderedMathTargetResolver,
						)
					: null) || null;
			const mathTokenTarget =
				mathTokenHighlighting &&
				mathTarget &&
				mathTarget.quality !== "expression"
					? mathTarget
					: null;
			const mathExpressionFallback =
				mathTarget && mathTarget.quality === "expression" ? mathTarget : null;

			// (1) A precise token always wins, and becomes the held target for its
			// equation so a later gap can keep it lit instead of flashing the whole
			// expression.
			if (mathTokenTarget) {
				const equationElement = soleEquationElement(mathCandidates);
				if (equationElement) {
					planned.heldTokenByElement.set(equationElement, mathTokenTarget);
				}
				return createHighlightDecision({
					semanticTarget: mathTokenTarget,
					expressionTarget: null,
					regionTarget: planned.regionTarget,
					confidence: normalized.confidence,
					reason: normalized.reason,
				});
			}

			// (2) A spoken word that maps to visible prose. The prose anchor is
			// precise; a coarse math expression fallback must never override it.
			// Exception: a multi-node prose range inside a token-mode equation
			// would escalate to the whole expression, so it is rejected here and
			// falls through to the token hold below. When per-token math
			// highlighting is disabled, any prose range that lands inside a
			// formula is likewise rejected so the formula stays a single block.
			if (
				proseTarget &&
				(mathTokenHighlighting
					? !wouldEscalateInsideTokenMath(planned, proseTarget, mathCandidates)
					: mathCandidates.length === 0)
			) {
				return createHighlightDecision({
					semanticTarget: proseTarget,
					expressionTarget: null,
					regionTarget: planned.regionTarget,
					confidence: normalized.confidence,
					reason: normalized.reason,
				});
			}

			// (3) A boundary inside a token-mode equation that did not map to a
			// token — an SSML break, a pause, or a gap between spoken tokens. Hold
			// the last token instead of flashing the whole expression; before the
			// first token there is nothing to hold, so fall to the region layer.
			// The whole expression is deliberately never painted in token mode.
			if (everyCandidateIsTokenMode(planned, mathCandidates)) {
				const equationElement = soleEquationElement(mathCandidates);
				const heldToken = equationElement
					? (planned.heldTokenByElement.get(equationElement) ?? null)
					: null;
				return createHighlightDecision({
					semanticTarget: heldToken,
					expressionTarget: null,
					regionTarget: planned.regionTarget,
					confidence: normalized.confidence,
					reason: heldToken
						? "hold last token (sticky token mode)"
						: "region (sticky token mode, awaiting first token)",
				});
			}

			// (4) An expression-mode (or mixed/ambiguous) math region: paint the
			// whole equation. Stable for the equation's full duration because
			// tokens never resolve here, so there is no flicker.
			return createHighlightDecision({
				semanticTarget: null,
				expressionTarget:
					mathExpressionFallback ??
					expressionTargetFor(planned, mathCandidates),
				regionTarget: planned.regionTarget,
				confidence: normalized.confidence,
				reason: normalized.reason,
			});
		},
	};
};
