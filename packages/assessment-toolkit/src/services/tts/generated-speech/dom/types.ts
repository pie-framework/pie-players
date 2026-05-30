import type {
	CatalogChunkPlaybackMode,
	CatalogSpanAlignment,
} from "../../catalog-span-alignment.js";
import type { SpeechCompositionChunkInput } from "../../highlight-pipeline/index.js";
import type { MathAwareAlignment } from "../../math-alignment/index.js";
import type { NormalizedTextMap } from "../../text-processing.js";

/**
 * Live-DOM anchor for a plan segment (runtime binding). The DOM adapter is the
 * only place that produces these; the pure core never references DOM nodes.
 */
export interface DomAnchor {
	sourceElement: Element | null;
	regionElement: Element | null;
	/**
	 * Prose only: per-segment slice of the visible-text map, used to resolve
	 * highlight ranges. Math segments highlight via `mathAlignment` instead.
	 */
	visibleMap?: NormalizedTextMap;
}

/**
 * Playback chunk consumed by `TTSService.speakCatalogChunk`. Structurally the
 * same shape the authored-catalog path produces; extends the highlight
 * pipeline's stable {@link SpeechCompositionChunkInput} with the two playback
 * fields `speakCatalogChunk` reads directly (`playbackMode`,
 * `speechMatchesVisibleText`).
 */
export interface GeneratedSpeechChunk extends SpeechCompositionChunkInput {
	speechMatchesVisibleText: boolean;
	playbackMode?: CatalogChunkPlaybackMode;
	/**
	 * Plain-text variant of this chunk for speak-time fallback. Present only on
	 * SSML chunks; if the provider rejects the SSML `speechText`, the runtime
	 * retries with this plain chunk (same anchors, plain alignment). Browsers
	 * and SSML-incapable providers never receive the SSML variant in the first
	 * place (build-time provider gating), so this is a defensive net.
	 */
	plainFallback?: GeneratedSpeechChunk;
}

export type { CatalogSpanAlignment, MathAwareAlignment };
