import { blankGroup, byIndex, clozeMarkup, idOf, joinHtml, option, promptOf, records, summarizer, text } from "./shared.js";

/**
 * Dropdowns in markup: each blank's choices grouped under its marker, `correct` on the keyed choice
 * and on those `alternateResponse` also accepts.
 */
export const inlineDropdown = summarizer((model) => {
	const alternates = new Map(
		byIndex(model.alternateResponse).map(([index, values]) => [
			index,
			new Set(Array.isArray(values) ? values.map(String) : []),
		]),
	);
	return {
		prompt: joinHtml(promptOf(model), clozeMarkup(model, "inline_dropdown")),
		options: byIndex(model.choices).flatMap(([index, choices]) =>
			records(choices).map((choice, position) => {
				const value = idOf(choice.value, position);
				const correct = choice.correct === true || alternates.get(index)?.has(value) === true;
				return option(`${index}:${value}`, text(choice.label) ?? "", correct, blankGroup(index));
			}),
		),
	};
});
