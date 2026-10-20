import { escapeHtml, isRecord, joinHtml, num, promptOf, records, summarizer, table, text } from "./shared.js";

/** The keyed chart as a table of category and value. */
export const charting = summarizer((model) => {
	const key = isRecord(model.correctAnswer) ? records(model.correctAnswer.data) : [];
	const title = text(model.title);
	return {
		prompt: joinHtml(promptOf(model), title && `<p><b>${title}</b></p>`),
		answer: table(
			key.map((entry): [string, string] => [text(entry.label) ?? "", escapeHtml(num(entry.value))]),
		),
	};
});
