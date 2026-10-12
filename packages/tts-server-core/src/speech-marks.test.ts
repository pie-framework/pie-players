import { describe, expect, it } from "vitest";
import { anchorSpeechMarks, normalizeSpeechMarks } from "./speech-marks.js";
import type { SpeechMark } from "./types.js";

const SPANISH = "La canción está aquí, señor. Él comió más pan después.";
const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).length;

// Word marks as Polly reports them: UTF-8 byte offsets into `sent`, which
// holds `text` after `prefix`.
const pollyMarks = (text: string, prefix = ""): SpeechMark[] =>
	[...text.matchAll(/[\p{L}]+/gu)].map((match, index) => {
		const start = bytes(prefix) + bytes(text.slice(0, match.index));
		return {
			time: index * 300,
			type: "word",
			start,
			end: start + bytes(match[0]),
			value: match[0],
		};
	});

const spans = (marks: SpeechMark[], text: string) =>
	marks.map((mark) => text.slice(mark.start, mark.end));

const words = (text: string) => [...text.matchAll(/[\p{L}]+/gu)].map((m) => m[0]);

describe("anchorSpeechMarks", () => {
	it("turns UTF-8 byte offsets into indexes of the request text", () => {
		const anchored = anchorSpeechMarks(pollyMarks(SPANISH), SPANISH);
		expect(spans(anchored, SPANISH)).toEqual(words(SPANISH));
	});

	it("removes the shift of an SSML envelope the request text lacks", () => {
		const prefix = '<speak><prosody rate="80%">';
		const anchored = anchorSpeechMarks(pollyMarks(SPANISH, prefix), SPANISH);
		expect(spans(anchored, SPANISH)).toEqual(words(SPANISH));
	});

	it("follows repeated words in order", () => {
		const text = "the cat and the dog and the bird";
		const anchored = anchorSpeechMarks(pollyMarks(text, "xxxxxxxxxx"), text);
		expect(anchored.map((mark) => mark.start)).toEqual([
			0, 4, 8, 12, 16, 20, 24, 28,
		]);
	});

	it("leaves offsets that already index the text unchanged", () => {
		const text = "Read the passage.";
		const marks: SpeechMark[] = [
			{ time: 0, type: "word", start: 0, end: 4, value: "Read" },
			{ time: 200, type: "word", start: 5, end: 8, value: "the" },
			{ time: 400, type: "word", start: 9, end: 16, value: "passage" },
		];
		expect(anchorSpeechMarks(marks, text)).toEqual(marks);
	});

	it("moves a mark whose value is absent by the last anchored shift", () => {
		const text = "Read WWW now";
		const marks: SpeechMark[] = [
			{ time: 0, type: "word", start: 7, end: 11, value: "Read" },
			{ time: 200, type: "word", start: 12, end: 17, value: "World" },
			{ time: 400, type: "word", start: 15, end: 18, value: "now" },
		];
		expect(anchorSpeechMarks(marks, text).map((mark) => mark.start)).toEqual([
			0, 5, 9,
		]);
	});
});

describe("normalizeSpeechMarks", () => {
	it("anchors JSONL marks carrying UTF-8 byte offsets", () => {
		const raw = pollyMarks(SPANISH)
			.map((mark) => JSON.stringify(mark))
			.join("\n");
		expect(spans(normalizeSpeechMarks(raw, SPANISH), SPANISH)).toEqual(
			words(SPANISH),
		);
	});
});
