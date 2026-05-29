import { resolveSpokenBoundaryOffset } from "../catalog-span-alignment.js";
import { tokenizeSpeechSource } from "../math-alignment/speech-tokenizer.js";
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

const directBoundary = (
	chunk: TTSHighlightChunk,
	event: TTSBoundaryEvent,
): { start: number; length: number } | null => {
	if (!Number.isFinite(event.position)) return null;
	if (event.position < 0 || event.position >= chunk.speechText.length)
		return null;
	const length = Math.max(
		1,
		Number.isFinite(event.length) ? (event.length ?? 1) : 1,
	);
	return { start: event.position, length };
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
	const boundary = chunk.catalogAlignment
		? resolveSpokenBoundaryOffset(
				chunk.catalogAlignment,
				event.position,
				event.length,
				event.word,
			)
		: directBoundary(chunk, event);
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
	const spokenText = chunk.catalogAlignment?.spokenText || chunk.speechText;
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
			: "resolved through direct chunk offsets",
	};
};
