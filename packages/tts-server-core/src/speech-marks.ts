/**
 * Speech marks utilities
 * @module @pie-players/tts-server-core
 */

import type { SpeechMark } from "./types.js";

const asFiniteNumber = (value: unknown): number | null => {
	const next = Number(value);
	return Number.isFinite(next) ? next : null;
};

const sortWordMarks = (marks: SpeechMark[]): SpeechMark[] =>
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

const estimateOffsetShift = (marks: SpeechMark[], requestText: string): number => {
	if (!marks.length || !requestText.length) return 0;
	const textLower = requestText.toLowerCase();
	const candidates: number[] = [];
	let cursor = 0;
	for (const mark of marks) {
		const token = mark.value.trim().toLowerCase();
		if (!token) continue;
		const found = textLower.indexOf(token, cursor);
		if (found < 0) continue;
		const delta = mark.start - found;
		if (delta >= 0) candidates.push(delta);
		cursor = found + token.length;
		if (candidates.length >= 8) break;
	}
	if (candidates.length > 0) {
		const ordered = [...candidates].sort((a, b) => a - b);
		return ordered[Math.floor(ordered.length / 2)];
	}
	return Math.max(0, Math.floor(marks[0].start));
};

const rebaseOffsetsToRequestText = (
	marks: SpeechMark[],
	requestText: string,
): SpeechMark[] => {
	if (!marks.length || !requestText.length) return marks;
	const textLength = requestText.length;
	const maxEnd = Math.max(...marks.map((mark) => mark.end));
	if (maxEnd <= textLength + 2) return marks;
	const shift = estimateOffsetShift(marks, requestText);
	if (shift <= 0) return marks;
	return marks.map((mark) => ({
		...mark,
		start: mark.start - shift,
		end: mark.end - shift,
	}));
};

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
 * rebases offsets that drifted from the request text (a provider quirk seen
 * in production), and clamps ranges to the request text's bounds.
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
	const rebased = rebaseOffsetsToRequestText(withTimes, requestText);
	return clampMarkRanges(rebased, requestText);
}

/**
 * Estimate speech marks for text when provider doesn't support them
 *
 * Uses average speaking rate to estimate word timing.
 * Not as accurate as provider-generated marks, but better than nothing.
 *
 * @param text - Text to generate marks for
 * @param avgWordsPerMinute - Average speaking rate (default 150)
 * @returns Estimated speech marks
 */
export function estimateSpeechMarks(
	text: string,
	avgWordsPerMinute = 150,
): SpeechMark[] {
	const words = text.split(/\s+/).filter((w) => w.length > 0);
	const msPerWord = (60 * 1000) / avgWordsPerMinute;

	const marks: SpeechMark[] = [];
	let charIndex = 0;

	for (let i = 0; i < words.length; i++) {
		const word = words[i];

		// Find word position in original text (preserves spacing)
		const wordStart = text.indexOf(word, charIndex);
		if (wordStart === -1) {
			// Word not found (shouldn't happen), skip
			charIndex += word.length + 1;
			continue;
		}

		marks.push({
			time: Math.round(i * msPerWord),
			type: "word",
			start: wordStart,
			end: wordStart + word.length,
			value: word,
		});

		charIndex = wordStart + word.length;
	}

	return marks;
}

/**
 * Adjust speech marks timing for different speaking rates
 *
 * @param marks - Original speech marks
 * @param rate - Speech rate multiplier (0.25 to 4.0)
 * @returns Adjusted speech marks
 */
export function adjustSpeechMarksForRate(
	marks: SpeechMark[],
	rate: number,
): SpeechMark[] {
	if (rate === 1.0) {
		return marks; // No adjustment needed
	}

	return marks.map((mark) => ({
		...mark,
		time: Math.round(mark.time / rate),
	}));
}

/**
 * Validate speech marks
 * Ensures marks are properly ordered and have valid data
 *
 * @param marks - Speech marks to validate
 * @returns Validation errors (empty array if valid)
 */
export function validateSpeechMarks(marks: SpeechMark[]): string[] {
	const errors: string[] = [];

	if (!marks || marks.length === 0) {
		return errors; // Empty is valid
	}

	for (let i = 0; i < marks.length; i++) {
		const mark = marks[i];

		// Check required fields
		if (typeof mark.time !== "number" || mark.time < 0) {
			errors.push(`Mark ${i}: invalid time (${mark.time})`);
		}

		if (typeof mark.start !== "number" || mark.start < 0) {
			errors.push(`Mark ${i}: invalid start (${mark.start})`);
		}

		if (typeof mark.end !== "number" || mark.end <= mark.start) {
			errors.push(`Mark ${i}: invalid end (${mark.end}, start: ${mark.start})`);
		}

		if (!mark.value || typeof mark.value !== "string") {
			errors.push(`Mark ${i}: invalid value`);
		}

		// Check ordering (time should be monotonically increasing)
		if (i > 0 && mark.time < marks[i - 1].time) {
			errors.push(
				`Mark ${i}: time (${mark.time}) is less than previous mark (${marks[i - 1].time})`,
			);
		}
	}

	return errors;
}

/**
 * Merge overlapping or adjacent speech marks
 * Useful when combining marks from multiple sources
 *
 * @param marks - Speech marks to merge
 * @returns Merged speech marks
 */
export function mergeSpeechMarks(marks: SpeechMark[]): SpeechMark[] {
	if (marks.length <= 1) {
		return marks;
	}

	// Sort by start position
	const sorted = [...marks].sort((a, b) => a.start - b.start);
	const merged: SpeechMark[] = [sorted[0]];

	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const previous = merged[merged.length - 1];

		// Check if marks overlap or are adjacent
		if (current.start <= previous.end) {
			// Merge with previous mark
			previous.end = Math.max(previous.end, current.end);
			previous.value = previous.value + " " + current.value;
			previous.time = Math.min(previous.time, current.time); // Use earlier time
		} else {
			// No overlap, add as new mark
			merged.push(current);
		}
	}

	return merged;
}

/**
 * Filter speech marks by type
 *
 * @param marks - Speech marks to filter
 * @param type - Type to filter by
 * @returns Filtered speech marks
 */
export function filterSpeechMarksByType(
	marks: SpeechMark[],
	type: "word" | "sentence" | "ssml",
): SpeechMark[] {
	return marks.filter((mark) => mark.type === type);
}

/**
 * Get speech mark at specific time
 *
 * @param marks - Speech marks
 * @param time - Time in milliseconds
 * @returns Speech mark at time, or null if none found
 */
export function getSpeechMarkAtTime(
	marks: SpeechMark[],
	time: number,
): SpeechMark | null {
	// Binary search for efficiency
	let left = 0;
	let right = marks.length - 1;
	let closest: SpeechMark | null = null;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const mark = marks[mid];

		if (mark.time === time) {
			return mark;
		}

		// Track closest mark
		if (
			!closest ||
			Math.abs(mark.time - time) < Math.abs(closest.time - time)
		) {
			closest = mark;
		}

		if (mark.time < time) {
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	// Return closest mark if within reasonable threshold (500ms)
	if (closest && Math.abs(closest.time - time) <= 500) {
		return closest;
	}

	return null;
}

/**
 * Calculate statistics for speech marks
 *
 * @param marks - Speech marks
 * @returns Statistics about the marks
 */
export function getSpeechMarksStats(marks: SpeechMark[]) {
	if (marks.length === 0) {
		return {
			count: 0,
			totalDuration: 0,
			avgWordDuration: 0,
			wordsPerMinute: 0,
		};
	}

	const wordMarks = filterSpeechMarksByType(marks, "word");
	const totalDuration = marks[marks.length - 1].time;
	const avgWordDuration = totalDuration / wordMarks.length;
	const wordsPerMinute = (wordMarks.length / totalDuration) * 60 * 1000;

	return {
		count: marks.length,
		wordCount: wordMarks.length,
		totalDuration,
		avgWordDuration,
		wordsPerMinute,
	};
}
