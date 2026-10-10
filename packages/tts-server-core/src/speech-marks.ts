/**
 * Speech marks utilities
 * @module @pie-players/tts-server-core
 */

import type { SpeechMark } from "./types.js";

// A mark as a wire format carries it, before `type` is narrowed.
type WireSpeechMark = Omit<SpeechMark, "type"> & { type: string };

const asFiniteNumber = (value: unknown): number | null => {
	const next = Number(value);
	return Number.isFinite(next) ? next : null;
};

const sortWordMarks = <Mark extends WireSpeechMark>(marks: Mark[]): Mark[] =>
	[...marks].sort((left, right) => {
		if (left.time !== right.time) return left.time - right.time;
		if (left.start !== right.start) return left.start - right.start;
		return left.end - right.end;
	});

/**
 * Parse a provider's JSONL word-mark wire format: one `{time, type, start,
 * end, value}` object per line. Rows missing a numeric `time` are dropped —
 * that anchor is load-bearing for the timing correction below — but rows
 * missing `start`/`end` still surface (estimated from the previous mark's
 * end) rather than being lost outright.
 */
const parseWordMarksJsonl = (raw: string): SpeechMark[] => {
	const marks: SpeechMark[] = [];
	let fallbackIndex = 0;
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed = JSON.parse(trimmed) as Record<string, unknown>;
			if (parsed.type && parsed.type !== "word") continue;
			const time = asFiniteNumber(parsed.time);
			if (time === null) continue;
			const value = typeof parsed.value === "string" ? parsed.value : "";
			const start = asFiniteNumber(parsed.start) ?? fallbackIndex;
			const end =
				asFiniteNumber(parsed.end) ?? start + Math.max(1, value.length);
			fallbackIndex = Math.max(end + 1, fallbackIndex);
			marks.push({ time, type: "word", start, end, value });
		} catch {
			// Ignore malformed JSONL rows while preserving valid marks.
		}
	}
	return sortWordMarks(marks);
};

// Some services report mark times in seconds. A timeline too short or too
// tightly spaced to be milliseconds (max under 100 across more than 3 marks, or
// a median gap under 10) is read as seconds and scaled to ms.
const normalizeMarkTimeUnits = (marks: SpeechMark[]): SpeechMark[] => {
	if (marks.length < 2) return marks;
	const times = marks.map((mark) => mark.time).filter((time) => time >= 0);
	const maxTime = times.length ? Math.max(...times) : 0;
	const deltas: number[] = [];
	for (let index = 1; index < times.length; index += 1) {
		const delta = times[index] - times[index - 1];
		if (delta > 0 && Number.isFinite(delta)) deltas.push(delta);
	}
	const medianDelta =
		deltas.length > 0
			? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]
			: 0;
	const shapeSuggestsSeconds =
		(maxTime > 0 && maxTime < 100 && marks.length > 3) ||
		(medianDelta > 0 && medianDelta < 10);
	if (!shapeSuggestsSeconds) return marks;
	return marks.map((mark) => ({ ...mark, time: mark.time * 1000 }));
};

// Case-folds for matching only, and only when folding keeps every index.
const foldForMatching = (text: string): string => {
	const folded = text.toLowerCase();
	return folded.length === text.length ? folded : text;
};

const nearestOccurrence = (
	haystack: string,
	token: string,
	from: number,
	expected: number,
	tolerance: number,
): number => {
	let best = -1;
	for (
		let found = haystack.indexOf(token, from);
		found >= 0 && found <= expected + tolerance;
		found = haystack.indexOf(token, found + 1)
	) {
		if (best < 0 || Math.abs(found - expected) < Math.abs(best - expected)) {
			best = found;
		}
	}
	return best >= 0 && Math.abs(best - expected) <= tolerance ? best : -1;
};

/**
 * Re-derive each mark's `start`/`end` from where its `value` occurs in the
 * request text, in time order, so offsets index that text in UTF-16 code
 * units. Reported offsets are only comparable within one provider: Polly's
 * count UTF-8 bytes of the SSML it was sent, and SchoolCity's carry a constant
 * shift. The first mark of each type takes its value's first occurrence; each
 * later one takes the occurrence nearest the offset the previous anchored
 * mark's shift predicts. A mark whose value is not found there keeps that
 * predicted offset. Idempotent on offsets that already index the text.
 */
export function anchorSpeechMarks<Mark extends WireSpeechMark>(
	marks: Mark[],
	requestText: string,
): Mark[] {
	if (!marks.length || !requestText.length) return marks;
	const haystack = foldForMatching(requestText);
	const progress = new Map<string, { cursor: number; shift: number | null }>();
	return sortWordMarks(marks).map((mark) => {
		const state = progress.get(mark.type) ?? { cursor: 0, shift: null };
		progress.set(mark.type, state);
		const token = mark.value.trim();
		const length = mark.end - mark.start;
		const expected = mark.start - (state.shift ?? 0);
		const found = !token
			? -1
			: state.shift === null
				? haystack.indexOf(foldForMatching(token), state.cursor)
				: nearestOccurrence(
						haystack,
						foldForMatching(token),
						state.cursor,
						expected,
						Math.max(8, token.length),
					);
		if (found < 0) {
			return { ...mark, start: expected, end: expected + length };
		}
		state.shift = mark.start - found;
		state.cursor = found + token.length;
		return { ...mark, start: found, end: found + token.length };
	});
}

const clampMarkRanges = (marks: SpeechMark[], requestText: string): SpeechMark[] => {
	if (!requestText.length) return marks;
	const textLength = requestText.length;
	return sortWordMarks(
		marks.map((mark) => {
			const start = Math.max(0, Math.min(textLength, Math.floor(mark.start)));
			const end = Math.max(
				start + 1,
				Math.min(textLength, Math.floor(mark.end)),
			);
			return { ...mark, start, end };
		}),
	);
};

/**
 * Parse and correct a provider's JSONL word-mark response against the text
 * that was actually requested: normalizes second-vs-millisecond time units,
 * anchors offsets to the request text (`anchorSpeechMarks`), and clamps
 * ranges to the request text's bounds.
 *
 * Shared by every provider/transport that speaks this wire shape so the
 * correction is applied once rather than reimplemented per caller.
 */
export function normalizeSpeechMarks(
	raw: string,
	requestText: string,
): SpeechMark[] {
	const parsed = parseWordMarksJsonl(raw);
	const withTimes = normalizeMarkTimeUnits(parsed);
	const anchored = anchorSpeechMarks(withTimes, requestText);
	return clampMarkRanges(anchored, requestText);
}
