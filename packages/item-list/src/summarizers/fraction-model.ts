import { joinHtml, num, records, shownPrompt, summarizer, tex, text } from "./shared.js";

/** The fraction the keyed models fill: the parts filled across models over the parts per model. */
export const fractionModel = summarizer((model) => {
	const parts = Number(model.partsPerModel);
	const filled = records(model.correctResponse).reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
	const title = text(model.title);
	return {
		prompt: joinHtml(title && `<p><b>${title}</b></p>`, shownPrompt(model)),
		...(parts > 0 && filled > 0 ? { answer: `<p>${tex(`\\frac{${num(filled)}}{${num(parts)}}`)}</p>` } : {}),
	};
});
