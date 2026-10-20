import { describeMark } from "./graph-marks.js";
import { isRecord, orderedList, promptOf, records, summarizer, tex } from "./shared.js";

/** The keyed boundary lines as equations. Which side is shaded lives in the polygons only. */
export const graphingSolutionSet = summarizer((model) => {
	const answers = isRecord(model.answers) ? model.answers : {};
	const key = isRecord(answers.correctAnswer) ? records(answers.correctAnswer.marks) : [];
	const lines = key.filter((mark) => mark.type === "line");
	return {
		prompt: promptOf(model),
		answer: orderedList(lines.flatMap((mark) => describeMark(mark) ?? []).map(tex)),
	};
});
