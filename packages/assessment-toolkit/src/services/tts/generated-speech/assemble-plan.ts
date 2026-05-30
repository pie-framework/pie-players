import type { MathAwareSpeechChunk } from "../math-aware-text-processing.js";
import {
	resolveMathSpeechFromChunks,
	type ResolvedMathSpeech,
} from "../math-speech.js";
import { normalizeTextForSpeech } from "../text-processing.js";
import type { AssembledSegment, AssembledSpeech } from "./types.js";

type MathChunk = Extract<MathAwareSpeechChunk, { type: "math" }>;

/**
 * Resolves spoken text for a single math chunk. Injectable so the runtime can
 * supply a memoized resolver (deterministic caching) and tests can stub SRE.
 * Mirrors `resolveMathSpeechFromChunks([chunk], options)`.
 */
export type MathSpeechResolver = (
	chunk: MathChunk,
	options: { language?: string; produceSsml?: boolean },
) => Promise<ResolvedMathSpeech>;

const defaultMathSpeechResolver: MathSpeechResolver = (chunk, options) =>
	resolveMathSpeechFromChunks([chunk], options);

const normalizeLocale = (language?: string): string =>
	(language || "en").split("-")[0].toLowerCase() || "en";

/**
 * Assemble an anchor-free speech plan from already-collected math-aware chunks.
 *
 * PURE: no DOM walking, no app-service imports. Reproduces the spoken-text and
 * visible-span bookkeeping the legacy inline generated path performed, so the
 * runtime output is byte-identical once serialized to plain text.
 */
export const assembleGeneratedSpeech = async (args: {
	chunks: ReadonlyArray<MathAwareSpeechChunk>;
	visibleText: string;
	language?: string;
	/** Request SRE SSML per math equation (used by the SSML playback format). */
	produceSsml?: boolean;
	resolveMathSpeech?: MathSpeechResolver;
}): Promise<AssembledSpeech> => {
	const resolveMathSpeech = args.resolveMathSpeech ?? defaultMathSpeechResolver;
	const { visibleText } = args;
	const segments: AssembledSegment[] = [];

	// Cursor-based span tracking, identical to the legacy `nextVisibleSpan`:
	// locate each chunk's normalized text within the aggregate visible text,
	// advancing a cursor so math fallbacks reserve their span even though only
	// prose spans are sliced for highlighting.
	let visibleCursor = 0;
	const nextVisibleSpan = (text: string): { start: number; end: number } => {
		const normalized = normalizeTextForSpeech(text);
		const found = visibleText.indexOf(normalized, visibleCursor);
		const start = found >= 0 ? found : visibleCursor;
		const end = start + normalized.length;
		visibleCursor = end;
		return { start, end };
	};

	const speechParts: string[] = [];

	for (let index = 0; index < args.chunks.length; index++) {
		const chunk = args.chunks[index];
		if (chunk.type === "text") {
			const visibleSpan = nextVisibleSpan(chunk.text);
			segments.push({
				sourceChunkIndex: index,
				segment: {
					kind: "prose",
					spokenText: chunk.text,
					visibleText: chunk.text,
					visibleSpan,
				},
			});
			speechParts.push(chunk.text);
			continue;
		}
		const visibleSpan = nextVisibleSpan(chunk.fallbackText);
		const generated = await resolveMathSpeech(chunk, {
			language: args.language,
			produceSsml: args.produceSsml,
		});
		const usedFallback = !generated.speechText;
		const spokenText = generated.speechText || chunk.fallbackText;
		segments.push({
			sourceChunkIndex: index,
			segment: {
				kind: "math",
				spokenText,
				mathml: chunk.mathml,
				fallbackText: chunk.fallbackText,
				visibleSpan,
				usedFallback,
				ssml: generated.ssml,
			},
		});
		speechParts.push(spokenText);
	}

	return {
		segments,
		locale: normalizeLocale(args.language),
		visibleText,
		plainSpeechText: normalizeTextForSpeech(speechParts.join(" ")),
	};
};
