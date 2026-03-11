export interface SentenceSegment {
	text: string;
	offset: number;
}

export interface SentenceSegmentationOptions {
	locale?: string;
	useSentenceSegmenter?: boolean;
}

export const segmentSentences = (
	text: string,
	options?: SentenceSegmentationOptions,
): SentenceSegment[] => {
	const useSentenceSegmenter = options?.useSentenceSegmenter !== false;
	try {
		if (!useSentenceSegmenter) {
			throw new Error("Segmenter disabled by policy");
		}
		const Segmenter = globalThis.Intl?.Segmenter;
		if (typeof Segmenter === "function") {
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
		}
	} catch {
		// Fall through to regex segmentation.
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
