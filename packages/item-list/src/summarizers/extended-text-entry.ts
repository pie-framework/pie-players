import { promptOf, summarizer } from "./shared.js";

export const extendedTextEntry = summarizer((model) => ({
	prompt: promptOf(model),
	manualScoring: true,
}));
