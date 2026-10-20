import { describeMark } from "./graph-marks.js";
import { isRecord, orderedList, promptOf, records, summarizer, tex } from "./shared.js";

/** The keyed marks, each as an equation or coordinates. */
export const graphing = summarizer((model) => {
	const answers = isRecord(model.answers) ? model.answers : {};
	const key = isRecord(answers.correctAnswer) ? records(answers.correctAnswer.marks) : [];
	return {
		prompt: promptOf(model),
		answer: orderedList(key.flatMap((mark) => describeMark(mark) ?? []).map(tex)),
	};
});
