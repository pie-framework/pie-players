export type HighlightTargetQuality =
	| "exact-word"
	| "element-range"
	| "region-fallback";

export type HighlightTarget =
	| {
			type: "text-range";
			quality: "exact-word";
			node: Text;
			startOffset: number;
			endOffset: number;
	  }
	| {
			type: "element-range";
			quality: Exclude<HighlightTargetQuality, "exact-word">;
			element: Element;
	  }
	| {
			type: "region";
			quality: "region-fallback";
			element: Element;
	  };

export type MathAlignmentTokenKind =
	| "identifier"
	| "number"
	| "operator"
	| "text"
	| "space"
	| "structure"
	| "layout"
	| "unknown";

export interface MathAlignmentToken {
	id: string;
	kind: MathAlignmentTokenKind;
	role: string;
	text: string;
	normalized: string;
	spokenAliases: string[];
	sourceElement: Element;
	path: string;
	target: HighlightTarget;
	optional?: boolean;
}

export interface MathMLTokenizationResult {
	tokens: MathAlignmentToken[];
	layoutTargets: MathAlignmentToken[];
	expressionTarget: HighlightTarget;
}

export type BoundaryCoordinateSystem =
	| "normalized-speech"
	| "raw-ssml"
	| "provider-speech-marks";

export type BoundaryOffsetSpace =
	| "plain-spoken-text"
	| "raw-ssml"
	| "unsupported";

export interface SpeechAlignmentToken {
	id: string;
	text: string;
	normalized: string;
	start: number;
	end: number;
	sourceStart: number;
	sourceEnd: number;
	coordinateSystem: BoundaryCoordinateSystem;
}

export interface AlignmentSegment {
	speechTokenIds: string[];
	mathTokenIds: string[];
	score: number;
	confidence: number;
	target: HighlightTarget;
}

export interface AlignmentResult {
	segments: AlignmentSegment[];
	confidence: number;
	fallbackTarget: HighlightTarget;
}
