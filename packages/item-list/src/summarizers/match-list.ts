import { idOf, option, records, shownPrompt, summarizer, text } from "./shared.js";

/** Answers as options, then one part per prompt whose answer is the answer it pairs with. */
export const matchList = summarizer((model) => {
	const answers = records(model.answers);
	const title = new Map(answers.map((answer, index) => [idOf(answer.id, index), text(answer.title) ?? ""]));
	return {
		prompt: shownPrompt(model),
		options: answers.map((answer, index) => option(idOf(answer.id, index), text(answer.title) ?? "")),
		parts: records(model.prompts).map((prompt, index) => {
			const answer = prompt.relatedAnswer == null ? undefined : title.get(String(prompt.relatedAnswer));
			return { id: idOf(prompt.id, index), prompt: text(prompt.title), ...(answer ? { answer } : {}) };
		}),
	};
});
