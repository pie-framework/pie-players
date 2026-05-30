/**
 * Generated-speech plan model (PURE core).
 *
 * This module is the speech-composition core for items that contain math but
 * ship without authored SSML / `accessibilityCatalogs` (PIE-623). It is
 * deliberately free of any imports from `TTSService`, the highlight renderer,
 * `HighlightCoordinator`, Svelte, or custom-element entrypoints
 * (`scripts/check-speech-composition-purity.mjs` enforces this). DOM primitive
 * types (`Element`) and an injectable SRE resolver are allowed; live-DOM
 * walking, anchor binding, alignment, and rendering live in `./dom/`.
 *
 * The plan is generic over `Anchor` so the same assembly + SSML serialization
 * can be reused by a future authoring/persistable path (serializable locators)
 * without rewriting the core. The runtime binds live DOM via `DomAnchor`
 * (see `./dom/types.ts`).
 */

export type StructuralBreakStrength = "weak" | "medium" | "strong";

export interface ProseSegment {
	kind: "prose";
	/** Spoken words for this prose run. Identical to `visibleText` today. */
	spokenText: string;
	/** Visible text run this segment was collected from. */
	visibleText: string;
	/**
	 * Character span of this run within the plan's aggregate `visibleText`.
	 * Used by the DOM adapter to slice the visible-text map for highlighting.
	 */
	visibleSpan: { start: number; end: number };
}

export interface MathSegment {
	kind: "math";
	/** Spoken words for the equation (SRE output, or the visible fallback). */
	spokenText: string;
	/** Canonical MathML for the equation. */
	mathml: string;
	/** Visible fallback text (rendered glyphs) for the equation. */
	fallbackText: string;
	/** Character span of `fallbackText` within the plan's aggregate visible text. */
	visibleSpan: { start: number; end: number };
	/** True when SRE produced nothing and the visible fallback is spoken instead. */
	usedFallback: boolean;
	/**
	 * SRE SSML rendering of the equation (a self-contained `<speak>` document),
	 * present only when SSML production was requested and SRE produced trackable
	 * SSML. Highlight-safe (structural tags only); the same string is fed to the
	 * provider and to alignment so raw-SSML word offsets map correctly.
	 */
	ssml?: string;
}

/**
 * A structural pause. Breaks are never standalone speakable units: the DOM
 * adapter folds them into the SSML of an adjacent speakable segment (or relies
 * on the gap between sequential per-chunk utterances). Modeled here so the
 * plan can carry pause intent for the SSML serializer.
 */
export interface StructuralBreak {
	kind: "break";
	strength: StructuralBreakStrength;
}

export type SpeechSegment = ProseSegment | MathSegment;
export type PlanSegment = SpeechSegment | StructuralBreak;

/** One assembled (still anchor-free) segment plus its source chunk index. */
export interface AssembledSegment {
	segment: SpeechSegment;
	/** Index into the source `MathAwareSpeechChunk[]` used to attach anchors. */
	sourceChunkIndex: number;
}

/** Pure assembly output: spoken text + visible spans, no DOM anchors yet. */
export interface AssembledSpeech {
	segments: AssembledSegment[];
	locale: string;
	/** Aggregate visible text (prose + math fallbacks) in document order. */
	visibleText: string;
	/**
	 * Aggregate plain spoken text (NEVER SSML). Carried so playback metadata /
	 * flags can stay plain even when per-chunk payloads become SSML.
	 */
	plainSpeechText: string;
}

/**
 * One ordered plan entry pairing a content segment with an opaque `Anchor`
 * that points back at its source.
 */
export interface PlanItem<Anchor> {
	segment: SpeechSegment;
	anchor: Anchor;
}

/**
 * An anchored speech plan, generic over the anchor type. `serializeToSsml`
 * consumes it without touching `Anchor` (content is anchor-free); the DOM
 * adapter consumes it to build highlight chunks.
 */
export interface GeneratedSpeechPlan<Anchor> {
	items: PlanItem<Anchor>[];
	locale: string;
	visibleText: string;
	plainSpeechText: string;
}
