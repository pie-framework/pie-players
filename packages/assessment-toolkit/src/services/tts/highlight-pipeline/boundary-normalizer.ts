import { resolveSpokenBoundaryOffset } from "../catalog-span-alignment.js";
import {
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
} from "../math-alignment/speech-tokenizer.js";
import type {
	NormalizedBoundaryEvent,
	TTSBoundaryEvent,
	TTSHighlightChunk,
} from "./types.js";

const normalizeBoundaryWord = (word: string): string | null => {
	if (!word || /^<[^>]+>$/.test(word.trim())) return null;
	return (
		tokenizeSpeechSource({ speechText: word }).tokens[0]?.normalized || null
	);
};

// Resolve a provider boundary for a chunk that carries no catalog span
// alignment — notably the generated-SSML math path, whose `speechText` is a
// raw `<speak>` document. The provider's offset is an index into `speechText`
// exactly as it was sent (which may include SSML tags), so we tokenize that
// same string and let the shared speech tokenizer translate the offset into the
// extracted spoken text. Returns the boundary in spoken-text space alongside
// that spoken text, so the downstream word/offset checks share one coordinate
// system. The previous "direct" path treated the raw-SSML offset as a
// spoken-text offset and rejected every math boundary (PIE-623 regression).
const speechSourceBoundary = (
	chunk: TTSHighlightChunk,
	event: TTSBoundaryEvent,
): { boundary: { start: number; length: number } | null; spokenText: string } => {
	const tokenization = tokenizeSpeechSource({ speechText: chunk.speechText });
	if (!Number.isFinite(event.position)) {
		return { boundary: null, spokenText: tokenization.spokenText };
	}
	const resolved = resolveBoundaryToSpeechToken({
		tokenization,
		position: event.position,
		length: event.length,
		boundaryWord: event.word,
	});
	return {
		boundary: resolved
			? { start: resolved.start, length: resolved.length }
			: null,
		spokenText: tokenization.spokenText,
	};
};

const tokenAtOffsetMatches = (
	speechText: string,
	start: number,
	normalizedWord: string | null,
): boolean => {
	if (!normalizedWord) return true;
	const token = tokenizeSpeechSource({ speechText }).tokens.find(
		(candidate) => candidate.start <= start && start < candidate.end,
	);
	return token?.normalized === normalizedWord;
};

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
	let boundary: { start: number; length: number } | null;
	let spokenText: string;
	if (chunk.catalogAlignment) {
		boundary = resolveSpokenBoundaryOffset(
			chunk.catalogAlignment,
			event.position,
			event.length,
			event.word,
		);
		spokenText = chunk.catalogAlignment.spokenText;
	} else {
		const resolved = speechSourceBoundary(chunk, event);
		boundary = resolved.boundary;
		spokenText = resolved.spokenText;
	}
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
	if (!tokenAtOffsetMatches(spokenText, boundary.start, normalizedWord)) {
		return {
			chunkId: chunk.id,
			normalizedWord,
			chunkSpokenStart: null,
			chunkSpokenEnd: null,
			confidence: 0,
			reason: "could not resolve provider boundary to matching word",
		};
	}
	return {
		chunkId: chunk.id,
		normalizedWord,
		chunkSpokenStart: boundary.start,
		chunkSpokenEnd: boundary.start + boundary.length,
		confidence: normalizedWord ? 1 : 0.75,
		reason: chunk.catalogAlignment
			? "resolved through catalog alignment"
			: "resolved through speech tokenization",
	};
};
