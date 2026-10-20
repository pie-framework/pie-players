import type { SummaryPart } from "@pie-element/shared-types";
import { choiceOptions } from "./multiple-choice.js";
import { isRecord, promptOf, summarizer } from "./shared.js";

/** Part A and part B, each a multiple-choice question. */
export const ebsr = summarizer((model) => ({
	parts: ["partA", "partB"].flatMap((id): SummaryPart[] => {
		const part = model[id];
		return isRecord(part) ? [{ id, prompt: promptOf(part), options: choiceOptions(part) }] : [];
	}),
}));
