import type { CatalogSpanAlignment } from "../catalog-span-alignment.js";
import type {
	MathAwareAlignment,
	HighlightTarget,
} from "../math-alignment/index.js";
import type { NormalizedTextMap } from "../text-processing.js";

export type ProviderOffsetSpace =
	| "plain-spoken-text"
	| "raw-ssml"
	| "provider-speech-marks"
	| "unknown";

export type ChunkOffsetSpace =
	| Exclude<ProviderOffsetSpace, "unknown">
	| "unsupported";

export interface TTSHighlightChunk {
	id: string;
	speechText: string;
	visibleText: string;
	sourceElement: Element | null;
	contentRoot: Element;
	regionElement: Element | null;
	regionRange?: Range;
	visibleMap?: NormalizedTextMap;
	catalogAlignment?: CatalogSpanAlignment;
	mathAlignments: Array<{ element: Element; alignment: MathAwareAlignment }>;
	offsetSpace: ChunkOffsetSpace;
}

export interface TTSBoundaryEvent {
	chunkId: string;
	word: string;
	position: number;
	length?: number;
	providerOffsetSpace: ProviderOffsetSpace;
}

export interface NormalizedBoundaryEvent {
	chunkId: string;
	normalizedWord: string | null;
	chunkSpokenStart: number | null;
	chunkSpokenEnd: number | null;
	confidence: number;
	reason: string;
}

export type RenderableHighlightTarget =
	| {
			type: "text-range";
			quality: "exact-word" | "semantic-token";
			node: Text;
			startOffset: number;
			endOffset: number;
	  }
	| {
			type: "range";
			quality: "exact-word" | "semantic-token" | "expression" | "region";
			range: Range;
	  }
	| {
			type: "element";
			quality: "semantic-token" | "expression" | "region";
			element: Element;
	  };

export type HighlightDecisionQuality =
	| "exact-word"
	| "semantic-token"
	| "expression"
	| "region";

export interface HighlightDecision {
	activeTarget: RenderableHighlightTarget | null;
	regionTarget: RenderableHighlightTarget | null;
	quality: HighlightDecisionQuality;
	confidence: number;
	reason: string;
}

export interface HighlightDecisionInput {
	semanticTarget: RenderableHighlightTarget | null;
	expressionTarget: RenderableHighlightTarget | null;
	regionTarget: RenderableHighlightTarget | null;
	confidence: number;
	reason: string;
}

export interface TTSHighlightPlan {
	chunks: TTSHighlightChunk[];
	resolveInitial(chunkId: string): HighlightDecision;
	resolveBoundary(event: TTSBoundaryEvent): HighlightDecision;
}

export type SemanticHighlightTarget = HighlightTarget;
