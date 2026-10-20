import type { SummaryPart } from "@pie-element/shared-types";
import { excerpt, joinHtml, records, summarizer, text } from "./shared.js";

/** Each passage's title and an excerpt of its text; several passages become parts. */
export const passage = summarizer((model) => {
	const enabled = (key: string) => model[key] !== false;
	const parts: SummaryPart[] = records(model.passages).flatMap((entry, index) => {
		const title = enabled("titleEnabled") ? text(entry.title) : undefined;
		const body = enabled("textEnabled") ? text(entry.text) : undefined;
		const prompt = joinHtml(title && `<p><b>${title}</b></p>`, body && excerpt(body));
		return prompt ? [{ id: String(index), prompt }] : [];
	});
	return parts.length === 1 ? { prompt: parts[0].prompt } : { parts };
});
