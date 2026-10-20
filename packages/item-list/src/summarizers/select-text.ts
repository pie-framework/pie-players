import { idOf, joinHtml, option, promptOf, records, summarizer, text } from "./shared.js";

/** The text to select from, and its selectable tokens as options. */
export const selectText = summarizer((model) => {
	const body = text(model.text);
	return {
		prompt: joinHtml(promptOf(model), body),
		options: records(model.tokens).map((token, index) => {
			const start = typeof token.start === "number" ? token.start : 0;
			const end = typeof token.end === "number" ? token.end : start;
			const label = text(token.text) ?? body?.slice(start, end) ?? "";
			return option(idOf(token.id, index), label, token.correct === true);
		}),
	};
});
