import type { ElementSummary } from "@pie-element/shared-types";

/** `summary` with `answer` and `correct` removed, whatever the summarizer returned for a student. */
export function withoutAnswers(summary: ElementSummary): ElementSummary {
	const { answer: _answer, options, parts, ...rest } = summary;
	return {
		...rest,
		...(options ? { options: options.map(({ correct: _correct, ...option }) => option) } : {}),
		...(parts
			? {
					parts: parts.map(({ answer: _partAnswer, options: partOptions, ...part }) => ({
						...part,
						...(partOptions
							? { options: partOptions.map(({ correct: _correct, ...option }) => option) }
							: {}),
					})),
				}
			: {}),
	};
}
