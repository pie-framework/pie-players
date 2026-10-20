import { promptOf, summarizer, text } from "./shared.js";

/** The prompt and the image the student marks. Hotspot shapes carry no label to list. */
export const hotspot = summarizer((model) => {
	const src = text(model.imageUrl);
	return { prompt: promptOf(model), ...(src ? { figure: { src } } : {}) };
});
