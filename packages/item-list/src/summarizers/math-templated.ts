import { blankAnswers, byIndex, clozeMarkup, isRecord, joinHtml, promptOf, summarizer, tex, text } from "./shared.js";

/** Math blanks in markup; each blank's answer and alternates as TeX. */
export const mathTemplated = summarizer((model) => {
	const answers = new Map<number, string[]>();
	for (const [index, response] of byIndex(model.responses)) {
		if (!isRecord(response)) continue;
		const alternates = isRecord(response.alternates) ? Object.values(response.alternates) : [];
		const accepted = [response.answer, ...alternates].flatMap((entry) => text(entry) ?? []);
		if (accepted.length > 0) answers.set(index, accepted.map(tex));
	}
	return {
		prompt: joinHtml(promptOf(model), clozeMarkup(model, "math_templated")),
		answer: blankAnswers(answers),
	};
});
