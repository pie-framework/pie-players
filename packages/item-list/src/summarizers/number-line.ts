import { isRecord, joinHtml, num, records, shownPrompt, summarizer, tex, text } from "./shared.js";

/** Each keyed mark in interval notation: `\{3\}` for a point, `[1,4)` for a segment, rays to ∞. */
export const numberLine = summarizer((model) => {
	const graph = isRecord(model.graph) ? model.graph : {};
	const marks = records(model.correctResponse).flatMap((mark) => {
		const at = num(mark.domainPosition);
		const closed = (fill: unknown) => fill !== "empty";
		switch (mark.type) {
			case "point":
				return [`\\{${at}\\}`];
			case "line": {
				const end = num(Number(mark.domainPosition) + Number(mark.size));
				return [`${closed(mark.leftPoint) ? "[" : "("}${at},${end}${closed(mark.rightPoint) ? "]" : ")"}`];
			}
			case "ray":
				return mark.direction === "negative"
					? [`(-\\infty,${at}${closed(mark.pointType) ? "]" : ")"}`]
					: [`${closed(mark.pointType) ? "[" : "("}${at},\\infty)`];
			default:
				return [];
		}
	});
	return {
		prompt: joinHtml(shownPrompt(model), text(graph.title)),
		...(marks.length > 0 ? { answer: `<p>${tex(marks.join(",\\ "))}</p>` } : {}),
	};
});
