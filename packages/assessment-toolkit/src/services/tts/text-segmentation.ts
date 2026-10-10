export interface SentenceSegment {
	text: string;
	offset: number;
}

export interface SentenceSegmentationOptions {
	locale?: string;
	useSentenceSegmenter?: boolean;
}

/**
 * `text` split into sentences at their offsets in it, by Intl.Segmenter unless
 * the policy disables it or it is missing. The segmenter path drops
 * whitespace-only segments; the regex fallback keeps every match.
 */
export const segmentSentences = (
	text: string,
	options?: SentenceSegmentationOptions,
): SentenceSegment[] => {
	const Segmenter =
		options?.useSentenceSegmenter === false
			? undefined
			: globalThis.Intl?.Segmenter;
	if (typeof Segmenter === "function") {
		try {
			const segmenter = new Segmenter(options?.locale, {
				granularity: "sentence",
			});
			const parsed = Array.from(segmenter.segment(text))
				.map((segment) => ({
					text: segment.segment,
					offset: segment.index,
				}))
				.filter((segment) => segment.text.trim().length > 0);
			if (parsed.length > 0) return parsed;
		} catch {
			// Fall through to regex segmentation.
		}
	}

	const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
	const raw = text.match(sentenceRegex) || [text];
	const parsed: SentenceSegment[] = [];
	let processed = 0;
	for (const sentence of raw) {
		const offset = text.indexOf(sentence, processed);
		if (offset === -1) continue;
		parsed.push({ text: sentence, offset });
		processed = offset + sentence.length;
	}
	return parsed.length > 0 ? parsed : [{ text, offset: 0 }];
};

/**
 * `text` in pieces of at most `maxLength` characters: whole sentences while they
 * fit, a sentence too long for one piece cut at its last space that fits, and a
 * word too long for one piece cut where the limit falls. Each piece is a trimmed
 * substring of `text`, at its offset there.
 */
export const splitTextToLength = (
	text: string,
	maxLength: number,
	options?: SentenceSegmentationOptions,
): SentenceSegment[] => {
	const limit = Math.max(1, Math.floor(maxLength));
	const pieces: SentenceSegment[] = [];
	let start = -1;
	let end = -1;
	const flush = () => {
		if (start >= 0)
			pieces.push({ text: text.slice(start, end), offset: start });
		start = -1;
	};
	const append = (spanStart: number, spanEnd: number) => {
		if (start >= 0 && spanEnd - start <= limit) {
			end = spanEnd;
			return;
		}
		flush();
		let cursor = spanStart;
		while (spanEnd - cursor > limit) {
			const window = text.slice(cursor, cursor + limit + 1);
			const space = window.search(/\s\S*$/);
			const cut = space > 0 ? cursor + space : cursor + limit;
			pieces.push({ text: text.slice(cursor, cut).trimEnd(), offset: cursor });
			cursor = cut;
			while (cursor < spanEnd && /\s/.test(text[cursor])) cursor++;
		}
		if (cursor < spanEnd) {
			start = cursor;
			end = spanEnd;
		}
	};
	for (const sentence of segmentSentences(text, options)) {
		const leading = sentence.text.search(/\S/);
		if (leading === -1) continue;
		const spanStart = sentence.offset + leading;
		append(spanStart, sentence.offset + sentence.text.trimEnd().length);
	}
	flush();
	return pieces;
};
