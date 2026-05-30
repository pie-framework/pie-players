import type { MathAwareSpeechChunk } from "../math-aware-text-processing.js";
import {
	resolveMathSpeechFromChunks,
	type ResolvedMathSpeech,
	type SREMathSpeechOptions,
} from "../math-speech.js";
import { normalizeTextForSpeech } from "../text-processing.js";
import { segmentSentences as segmentTextToSentences } from "../text-segmentation.js";
import type { AssembledSegment, AssembledSpeech } from "./types.js";

type MathChunk = Extract<MathAwareSpeechChunk, { type: "math" }>;

/**
 * Resolves spoken text for a single math chunk. Injectable so the runtime can
 * supply a memoized resolver (deterministic caching) and tests can stub SRE.
 * Mirrors `resolveMathSpeechFromChunks([chunk], options)`.
 */
export type MathSpeechResolver = (
	chunk: MathChunk,
	options: {
		language?: string;
		produceSsml?: boolean;
		mathSpeech?: SREMathSpeechOptions;
	},
) => Promise<ResolvedMathSpeech>;

const defaultMathSpeechResolver: MathSpeechResolver = (chunk, options) =>
	resolveMathSpeechFromChunks([chunk], options);

const normalizeLocale = (language?: string): string =>
	(language || "en").split("-")[0].toLowerCase() || "en";

const PRESERVE_PROSE_CHUNK_TAGS = new Set([
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"LI",
	"LABEL",
	"BUTTON",
]);

const PRESERVE_PROSE_CHUNK_ROLES = new Set([
	"heading",
	"listitem",
	"option",
	"radio",
]);

const shouldPreserveProseChunk = (
	chunk: MathAwareSpeechChunk,
): boolean => {
	if (chunk.type !== "text" || !chunk.sourceElement) return false;
	const tagName = chunk.sourceElement.tagName.toUpperCase();
	const role = (chunk.sourceElement.getAttribute("role") || "").toLowerCase();
	return (
		PRESERVE_PROSE_CHUNK_TAGS.has(tagName) ||
		PRESERVE_PROSE_CHUNK_ROLES.has(role)
	);
};

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
	mathSpeech?: SREMathSpeechOptions;
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
			const proseSegments = shouldPreserveProseChunk(chunk)
				? [{ text: chunk.text, offset: 0 }]
				: segmentTextToSentences(chunk.text, {
						locale: args.language,
					});
			for (const prose of proseSegments) {
				const text = normalizeTextForSpeech(prose.text);
				if (!text) continue;
				const visibleSpan = nextVisibleSpan(text);
				segments.push({
					sourceChunkIndex: index,
					segment: {
						kind: "prose",
						spokenText: text,
						visibleText: text,
						visibleSpan,
					},
				});
				speechParts.push(text);
			}
			continue;
		}
		const visibleSpan = nextVisibleSpan(chunk.fallbackText);
		const generated = await resolveMathSpeech(chunk, {
			language: args.language,
			produceSsml: args.produceSsml,
			mathSpeech: args.mathSpeech,
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
