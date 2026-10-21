import { isRecord, joinHtml, orderedList, promptOf, records, summarizer, tex, text } from "./shared.js";

/**
 * The expression with its blanks as boxes. Each keyed response is the whole expression filled in,
 * so the answer lists complete expressions; Simple mode scores against the first only.
 */
export const mathInline = summarizer((model) => {
	const expression = text(model.expression);
	const responses = records(model.responses);
	const scored = model.responseType === "Simple" ? responses.slice(0, 1) : responses;
	const accepted = scored.flatMap((response) => {
		const alternates = isRecord(response.alternates) ? Object.values(response.alternates) : [];
		return [response.answer, ...alternates].flatMap((entry) => text(entry) ?? []);
	});
	return {
		prompt: joinHtml(
			promptOf(model),
			expression && `<p>${tex(expression.replace(/\{\{response\}\}/g, "\\square"))}</p>`,
		),
		answer: orderedList([...new Set(accepted)].map(tex)),
	};
});
