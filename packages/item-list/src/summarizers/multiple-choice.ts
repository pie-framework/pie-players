import type { SummaryOption } from "@pie-element/shared-types";
import { idOf, type Model, option, promptOf, records, summarizer, text } from "./shared.js";

/** Choices as options, `correct` where the author marked them. EBSR's parts read the same way. */
export function choiceOptions(model: Model): SummaryOption[] {
	return records(model.choices).map((choice, index) =>
		option(idOf(choice.value, index), text(choice.label) ?? "", choice.correct === true),
	);
}

export const multipleChoice = summarizer((model) => ({
	prompt: promptOf(model),
	options: choiceOptions(model),
}));
