import { resolveVisibleSpanForBoundary } from "../catalog-span-alignment.js";
import { createRangeFromVisibleMap } from "./visible-map-range.js";
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
	const range = createRangeFromVisibleMap(
		chunk.visibleMap,
		visibleSpan.start,
		visibleSpan.end,
	);
	if (!range) return null;
	return {
		type: "range",
		quality:
			chunk.catalogAlignment.playbackMode === "exact-word"
				? "exact-word"
				: "semantic-token",
		range,
	};
};
