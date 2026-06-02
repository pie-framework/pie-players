import { createCatalogSpanAlignment } from "../../catalog-span-alignment.js";
import { createRangeFromVisibleMap } from "../../highlight-pipeline/visible-map-range.js";
import { createMathAwareAlignment } from "../../math-alignment/index.js";
import type {
	GeneratedSpeechPlan,
	MathSegment,
	ProseSegment,
} from "../types.js";
import type { DomAnchor, GeneratedSpeechChunk } from "./types.js";

export interface PlanToChunksOptions {
	/**
	 * Playback format:
	 *   - "plain" (default): plain spoken text for every chunk (Phase A, the
	 *     stable generated-speech behavior).
	 *   - "ssml": math chunks with SRE SSML send that SSML to the provider (with
	 *     a plain fallback attached); prose chunks always stay plain.
	 */
	format?: "plain" | "ssml";
}

const buildProseChunk = (
	segment: ProseSegment,
	anchor: DomAnchor,
): GeneratedSpeechChunk => {
	const alignment = createCatalogSpanAlignment({
		speechText: segment.spokenText,
		visibleText: segment.spokenText,
	});
	return {
		speechText: segment.spokenText,
		visibleText: segment.visibleText,
		sourceElement: anchor.sourceElement,
		regionElement: anchor.regionElement,
		regionRange:
			createRangeFromVisibleMap(
				anchor.visibleMap,
				0,
				segment.visibleText.length,
			) ?? undefined,
		speechMatchesVisibleText: true,
		playbackMode: alignment.playbackMode,
		alignment,
		visibleMap: anchor.visibleMap,
	};
};

const buildPlainMathChunk = (
	segment: MathSegment,
	anchor: DomAnchor,
): GeneratedSpeechChunk => {
	const mathElement = anchor.sourceElement;
	return {
		speechText: segment.spokenText,
		visibleText: segment.fallbackText,
		sourceElement: mathElement,
		regionElement: anchor.regionElement,
		speechMatchesVisibleText: segment.spokenText === segment.fallbackText,
		mathAlignment: mathElement
			? createMathAwareAlignment({
					mathElement,
					speechText: segment.spokenText,
				})
			: undefined,
	};
};

const buildSsmlMathChunk = (
	segment: MathSegment,
	anchor: DomAnchor,
	ssml: string,
): GeneratedSpeechChunk => {
	const mathElement = anchor.sourceElement;
	return {
		speechText: ssml,
		visibleText: segment.fallbackText,
		sourceElement: mathElement,
		regionElement: anchor.regionElement,
		// SSML never equals the visible fallback; the region-vs-token decision is
		// driven by alignment confidence, not by this flag.
		speechMatchesVisibleText: false,
		// SINGLE SOURCE OF TRUTH: the exact SSML string sent to the provider is
		// also the string alignment tokenizes, so provider word-boundary offsets
		// (into the raw SSML) map back to spoken tokens via `rawToSpokenOffsetMap`.
		mathAlignment: mathElement
			? createMathAwareAlignment({ mathElement, speechText: ssml })
			: undefined,
		// Defensive net: if the provider rejects the SSML, retry with plain text.
		plainFallback: buildPlainMathChunk(segment, anchor),
	};
};

/**
 * Convert an anchored speech plan into playback chunks for
 * `TTSService.speakCatalogChunk`. The aggregate `contentToSpeak` stays plain
 * (see `plan.plainSpeechText`), so no SSML leaks into break-detection or seek
 * planning — SSML lives only in per-chunk `speechText`.
 */
export const planToCompositionChunkInputs = (
	plan: GeneratedSpeechPlan<DomAnchor>,
	options: PlanToChunksOptions = {},
): GeneratedSpeechChunk[] =>
	plan.items.map(({ segment, anchor }) => {
		if (segment.kind === "prose") return buildProseChunk(segment, anchor);
		if (options.format === "ssml" && segment.ssml) {
			return buildSsmlMathChunk(segment, anchor, segment.ssml);
		}
		return buildPlainMathChunk(segment, anchor);
	});
