import { blankAnswers, byIndex, clozeMarkup, joinHtml, promptOf, records, summarizer, text } from "./shared.js";

/** Typed blanks: every authored choice of a blank is an accepted answer, the first leading. */
export const explicitConstructedResponse = summarizer((model) => {
	const answers = new Map<number, string[]>();
	for (const [index, choices] of byIndex(model.choices)) {
		const accepted = records(choices).flatMap((choice) => text(choice.label) ?? []);
		if (accepted.length > 0) answers.set(index, accepted);
	}
	return {
		prompt: joinHtml(promptOf(model), clozeMarkup(model, "explicit_constructed_response")),
		answer: blankAnswers(answers),
	};
});
