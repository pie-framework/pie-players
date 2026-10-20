import { idOf, isRecord, option, orderedList, promptOf, records, summarizer, text } from "./shared.js";

/** Choices in authored order; the answer lists them in the keyed order. */
export const placementOrdering = summarizer((model) => {
	const choices = records(model.choices);
	const label = new Map(choices.map((choice, index) => [idOf(choice.id, index), text(choice.label) ?? ""]));
	const order = Array.isArray(model.correctResponse) ? model.correctResponse : [];
	const ordered = order.flatMap((entry) => label.get(String(isRecord(entry) ? entry.id : entry)) ?? []);
	return {
		prompt: promptOf(model),
		options: choices.map((choice, index) => option(idOf(choice.id, index), text(choice.label) ?? "")),
		answer: orderedList(ordered),
	};
});
