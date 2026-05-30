import { resolveReadableRegion } from "../../highlight-pipeline/index.js";
import { collectMathAwareTextAndMap } from "../../math-aware-text-processing.js";
import type {
	NormalizedTextMap,
	TextProcessingOptions,
} from "../../text-processing.js";
import {
	assembleGeneratedSpeech,
	type MathSpeechResolver,
} from "../assemble-plan.js";
import type { GeneratedSpeechPlan, PlanItem } from "../types.js";
import type { DomAnchor } from "./types.js";

const sliceVisibleMap = (
	map: NormalizedTextMap,
	start: number,
	end: number,
): NormalizedTextMap => {
	const sliced: NormalizedTextMap = new Map();
	for (let index = start; index < end; index++) {
		const mapping = map.get(index);
		if (mapping) {
			sliced.set(index - start, mapping);
		}
	}
	return sliced;
};

export interface BuildGeneratedSpeechResult {
	plan: GeneratedSpeechPlan<DomAnchor>;
	containsMathMarkup: boolean;
	/** Aggregate visible text from the DOM walk (may be empty). */
	visibleText: string;
}

/**
 * DOM adapter: walk a live content root, assemble the (pure) speech plan, and
 * bind each segment to its live-DOM anchor. This is the only generated-speech
 * entry point that touches the DOM; assembly and serialization stay pure.
 */
export const buildGeneratedSpeechFromRoot = async (args: {
	contentRoot: Element;
	language?: string;
	textProcessingOptions?: TextProcessingOptions;
	/** Request SRE SSML per equation (for the SSML playback format). */
	produceSsml?: boolean;
	resolveMathSpeech?: MathSpeechResolver;
}): Promise<BuildGeneratedSpeechResult> => {
	const extracted = collectMathAwareTextAndMap(
		args.contentRoot,
		args.textProcessingOptions,
	);
	const assembled = await assembleGeneratedSpeech({
		chunks: extracted.chunks,
		visibleText: extracted.visibleText,
		language: args.language,
		produceSsml: args.produceSsml,
		resolveMathSpeech: args.resolveMathSpeech,
	});

	const items: PlanItem<DomAnchor>[] = assembled.segments.map(
		({ segment, sourceChunkIndex }) => {
			if (segment.kind === "prose") {
				return {
					segment,
					anchor: {
						sourceElement: args.contentRoot,
						regionElement: resolveReadableRegion(
							args.contentRoot,
							args.contentRoot,
						),
						visibleMap: sliceVisibleMap(
							extracted.map,
							segment.visibleSpan.start,
							segment.visibleSpan.end,
						),
					},
				};
			}
			const sourceChunk = extracted.chunks[sourceChunkIndex];
			const mathElement =
				sourceChunk?.type === "math"
					? (sourceChunk.sourceElement ?? null)
					: null;
			return {
				segment,
				anchor: {
					sourceElement: mathElement,
					regionElement: mathElement,
				},
			};
		},
	);

	return {
		plan: {
			items,
			locale: assembled.locale,
			visibleText: assembled.visibleText,
			plainSpeechText: assembled.plainSpeechText,
		},
		containsMathMarkup: extracted.containsMathMarkup,
		visibleText: extracted.visibleText,
	};
};
