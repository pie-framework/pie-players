import { option, shownPrompt, summarizer, text } from "./shared.js";

/** A survey grid: the column labels as options, one part per row. It has no answer key. */
export const matrix = summarizer((model) => {
	const labels = (value: unknown) => (Array.isArray(value) ? value.map((label) => text(label) ?? "") : []);
	return {
		prompt: shownPrompt(model),
		options: labels(model.columnLabels).map((label, index) => option(String(index), label)),
		parts: labels(model.rowLabels).map((label, index) => ({ id: String(index), prompt: label })),
	};
});
