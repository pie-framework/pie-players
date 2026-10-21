import { blankAnswers, byIndex, clozeMarkup, idOf, joinHtml, option, promptOf, records, summarizer, text } from "./shared.js";

/** Tokens dragged into blanks: the tokens as options, the token each blank takes as the answer. */
export const dragInTheBlank = summarizer((model) => {
	const choices = records(model.choices);
	const value = new Map(choices.map((choice, index) => [idOf(choice.id, index), text(choice.value) ?? ""]));
	const answers = new Map<number, string[]>();
	for (const [index, id] of byIndex(model.correctResponse)) {
		const alternates = byIndex(model.alternateResponses).find(([at]) => at === index)?.[1];
		const ids = [id, ...(Array.isArray(alternates) ? alternates : [])];
		const accepted = ids.flatMap((entry) => value.get(String(entry)) || []);
		if (accepted.length > 0) answers.set(index, [...new Set(accepted)]);
	}
	return {
		prompt: joinHtml(promptOf(model), clozeMarkup(model, "drag_in_the_blank")),
		options: choices.map((choice, index) => option(idOf(choice.id, index), text(choice.value) ?? "")),
		answer: blankAnswers(answers),
	};
});
