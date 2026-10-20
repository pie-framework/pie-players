import { promptOf, summarizer, text } from "./shared.js";

/** The prompt and the background the student draws on. */
export const drawingResponse = summarizer((model) => {
	const src = model.backgroundImageEnabled === false ? undefined : text(model.imageUrl);
	return {
		prompt: promptOf(model),
		...(src ? { figure: { src } } : {}),
		manualScoring: true,
	};
});
