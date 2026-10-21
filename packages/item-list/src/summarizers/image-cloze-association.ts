import { blankAnswers, isRecord, joinHtml, option, shownPrompt, summarizer, text } from "./shared.js";

/** The image, its draggable responses as options, and the responses each container takes. */
export const imageClozeAssociation = summarizer((model) => {
	const pick = (source: Record<string, unknown>, camel: string, snake: string) => source[camel] ?? source[snake];
	const image = isRecord(model.image) ? text(model.image.src) : undefined;
	const responses = pick(model, "possibleResponses", "possible_responses");
	const validation = isRecord(model.validation) ? model.validation : {};
	const valid = pick(validation, "validResponse", "valid_response");
	const alternates = pick(validation, "altResponses", "alt_responses");
	const answers = new Map<number, string[]>();
	for (const response of [valid, ...(Array.isArray(alternates) ? alternates : [])]) {
		const containers = isRecord(response) && Array.isArray(response.value) ? response.value : [];
		containers.forEach((container, index) => {
			const images = isRecord(container) && Array.isArray(container.images) ? container.images : [];
			const accepted = images.map((img) => text(img)).filter((img): img is string => !!img);
			if (accepted.length === 0) return;
			const joined = accepted.join(" ");
			const listed = answers.get(index) ?? [];
			if (!listed.includes(joined)) answers.set(index, [...listed, joined]);
		});
	}
	return {
		prompt: joinHtml(shownPrompt(model), text(model.stimulus)),
		...(image ? { figure: { src: image } } : {}),
		options: (Array.isArray(responses) ? responses : []).flatMap((response, index) => {
			const label = text(response);
			return label ? [option(String(index), label)] : [];
		}),
		answer: blankAnswers(answers),
	};
});

