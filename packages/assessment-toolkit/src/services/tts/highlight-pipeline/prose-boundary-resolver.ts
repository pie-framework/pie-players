import { resolveVisibleSpanForBoundary } from "../catalog-span-alignment.js";
import { createRangesFromVisibleMap } from "./visible-map-range.js";
import type {
	NormalizedBoundaryEvent,
	RenderableHighlightTarget,
	TTSHighlightChunk,
} from "./types.js";

export const resolveProseBoundaryTarget = (
	chunk: TTSHighlightChunk,
	boundary: NormalizedBoundaryEvent,
): RenderableHighlightTarget | null => {
	if (!chunk.catalogAlignment || boundary.chunkSpokenStart === null)
		return null;
	const visibleSpan = resolveVisibleSpanForBoundary(
		chunk.catalogAlignment,
		boundary.chunkSpokenStart,
	);
	if (!visibleSpan) return null;
	// One range per tree, as the uncataloged word path builds them.
	const ranges = createRangesFromVisibleMap(
		chunk.visibleMap,
		visibleSpan.start,
		visibleSpan.end,
	);
	if (ranges.length === 0) return null;
	return {
		type: "range",
		quality:
			chunk.catalogAlignment.playbackMode === "exact-word"
				? "exact-word"
				: "semantic-token",
		range: ranges[0],
		ranges: ranges.length > 1 ? ranges : undefined,
	};
};
