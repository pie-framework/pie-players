import { idOf, option, records, shownPrompt, summarizer, text } from "./shared.js";

/** The statement and its scale points. It has no answer key. */
export const likert = summarizer((model) => ({
	prompt: shownPrompt(model),
	options: records(model.choices).map((choice, index) => option(idOf(choice.value, index), text(choice.label) ?? "")),
}));
