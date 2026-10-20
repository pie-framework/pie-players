import { idOf, option, promptOf, records, summarizer, text } from "./shared.js";

/** Choices as options, then one part per category whose answer is the choices it takes. */
export const categorize = summarizer((model) => {
	const choices = records(model.choices);
	const content = new Map(choices.map((choice, index) => [idOf(choice.id, index), text(choice.content) ?? ""]));
	const key = new Map(
		records(model.correctResponse).map((response) => [
			String(response.category),
			Array.isArray(response.choices) ? response.choices.map(String) : [],
		]),
	);
	return {
		prompt: promptOf(model),
		options: choices.map((choice, index) => option(idOf(choice.id, index), text(choice.content) ?? "")),
		parts: records(model.categories).map((category, index) => {
			const id = idOf(category.id, index);
			const members = (key.get(id) ?? []).flatMap((choice) => content.get(choice) || []);
			return {
				id,
				prompt: text(category.label),
				...(members.length > 0 ? { answer: members.join(", ") } : {}),
			};
		}),
	};
});
