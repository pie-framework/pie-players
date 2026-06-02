import type { CatalogSpanAlignment } from "../catalog-span-alignment.js";
import type { MathAwareAlignment } from "../math-alignment/index.js";
import type { NormalizedTextMap } from "../text-processing.js";
import type { ChunkOffsetSpace, TTSHighlightChunk } from "./types.js";

export interface SpeechCompositionChunkInput {
	speechText: string;
	visibleText: string;
	sourceElement: Element | null;
	regionElement?: Element | null;
	regionRange?: Range;
	alignment?: CatalogSpanAlignment;
	mathAlignment?: MathAwareAlignment;
	mathAlignments?: Array<{ element: Element; alignment: MathAwareAlignment }>;
	visibleMap?: NormalizedTextMap;
}

export interface NormalizeSpeechChunksArgs {
	contentRoot: Element;
	chunks?: SpeechCompositionChunkInput[];
	speechText?: string;
	visibleText?: string;
	sourceElement?: Element | null;
	regionElement?: Element | null;
	regionRange?: Range;
	visibleMap?: NormalizedTextMap;
}

const chunkOffsetSpaceFor = (
	chunk: SpeechCompositionChunkInput,
): ChunkOffsetSpace => {
	if (chunk.alignment?.boundaryOffsetMode)
		return chunk.alignment.boundaryOffsetMode;
	const mathOffsetSpace = chunk.mathAlignment?.speech.boundaryOffsetSpace;
	if (mathOffsetSpace) return mathOffsetSpace;
	return "plain-spoken-text";
};

const mathAlignmentsFor = (
	chunk: SpeechCompositionChunkInput,
): Array<{ element: Element; alignment: MathAwareAlignment }> => {
	if (chunk.mathAlignments?.length) return chunk.mathAlignments;
	if (chunk.mathAlignment && chunk.sourceElement) {
		return [{ element: chunk.sourceElement, alignment: chunk.mathAlignment }];
	}
	return [];
};

export const normalizeSpeechChunks = (
	args: NormalizeSpeechChunksArgs,
): TTSHighlightChunk[] => {
	const sourceChunks =
		args.chunks && args.chunks.length
			? args.chunks
			: [
					{
						speechText: args.speechText || "",
						visibleText: args.visibleText || args.speechText || "",
						sourceElement: args.sourceElement || args.contentRoot,
						regionElement:
							args.regionElement || args.sourceElement || args.contentRoot,
						regionRange: args.regionRange,
						visibleMap: args.visibleMap,
					},
				];
	return sourceChunks.map((chunk, index) => ({
		id: `tts-chunk-${index}`,
		speechText: chunk.speechText,
		visibleText: chunk.visibleText,
		sourceElement: chunk.sourceElement,
		contentRoot: args.contentRoot,
		regionElement: chunk.regionElement ?? chunk.sourceElement,
		regionRange: chunk.regionRange,
		visibleMap: chunk.visibleMap,
		catalogAlignment: chunk.alignment,
		mathAlignments: mathAlignmentsFor(chunk),
		offsetSpace: chunkOffsetSpaceFor(chunk),
	}));
};
