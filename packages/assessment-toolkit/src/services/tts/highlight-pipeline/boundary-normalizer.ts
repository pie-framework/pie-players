import {
	normalizeBoundaryWord,
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
} from "../math-alignment/speech-tokenizer.js";
import type {
	NormalizedBoundaryEvent,
	TTSBoundaryEvent,
	TTSHighlightChunk,
} from "./types.js";

export const normalizeBoundaryEvent = (
	chunk: TTSHighlightChunk,
	event: TTSBoundaryEvent,
): NormalizedBoundaryEvent => {
	const normalizedWord = normalizeBoundaryWord(event.word);
	if (chunk.id !== event.chunkId) {
		return {
			chunkId: event.chunkId,
			normalizedWord,
			chunkSpokenStart: null,
			chunkSpokenEnd: null,
			confidence: 0,
			reason: "boundary chunk id did not match highlight chunk",
		};
	}
	if (
		event.providerOffsetSpace === "unknown" ||
		chunk.offsetSpace === "unsupported"
	) {
		return {
			chunkId: chunk.id,
			normalizedWord,
			chunkSpokenStart: null,
			chunkSpokenEnd: null,
			confidence: 0,
			reason: "boundary offset space is unsupported",
		};
	}
	// The provider's offset indexes `speechText` exactly as sent, which may be a
	// raw `<speak>` document; the shared tokenizer maps it into spoken text and
	// checks it against the reported word, on the catalog path and without one.
	const boundary = resolveBoundaryToSpeechToken({
		tokenization:
			chunk.catalogAlignment?.speech ??
			tokenizeSpeechSource({ speechText: chunk.speechText }),
		position: event.position,
		length: event.length,
		boundaryWord: event.word,
	});
	if (!boundary) {
		return {
			chunkId: chunk.id,
			normalizedWord,
			chunkSpokenStart: null,
			chunkSpokenEnd: null,
			confidence: 0,
			reason: "could not resolve provider boundary to chunk speech",
		};
	}
	return {
		chunkId: chunk.id,
		normalizedWord,
		chunkSpokenStart: boundary.start,
		chunkSpokenEnd: boundary.start + boundary.length,
		confidence: boundary.confidence,
		reason: chunk.catalogAlignment
			? "resolved through catalog alignment"
			: "resolved through speech tokenization",
	};
};
