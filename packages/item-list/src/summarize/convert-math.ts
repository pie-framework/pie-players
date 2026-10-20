import type { ElementSummary, SummaryOption, SummaryPart } from "@pie-element/shared-types";
import { convertMath } from "../math.js";
import type { ItemSummary } from "./summarize-item.js";

/**
 * `summary` with the TeX in every HTML field as MathML, for a backend that stores summaries. A row
 * converts only HTML that still holds TeX, so a converted summary loads no converter in the
 * browser. HTML the converter fails on stays as authored, and the row converts it again.
 */
export async function convertSummaryMath(summary: ItemSummary): Promise<ItemSummary> {
	const [stem, entries] = await Promise.all([
		html(summary.stem),
		Promise.all(
			summary.entries.map(async (entry) => ({
				...entry,
				summary: await element(entry.summary),
			})),
		),
	]);
	return { ...summary, ...(stem === undefined ? {} : { stem }), entries };
}

async function element(summary: ElementSummary): Promise<ElementSummary> {
	const [content, parts] = await Promise.all([
		block(summary),
		summary.parts ? Promise.all(summary.parts.map(block)) : undefined,
	]);
	return { ...summary, ...content, ...(parts ? { parts } : {}) };
}

async function block<T extends SummaryPart>(content: T): Promise<T> {
	const [prompt, answer, options] = await Promise.all([
		html(content.prompt),
		html(content.answer),
		content.options ? Promise.all(content.options.map(option)) : undefined,
	]);
	return {
		...content,
		...(prompt === undefined ? {} : { prompt }),
		...(answer === undefined ? {} : { answer }),
		...(options ? { options } : {}),
	};
}

async function option(entry: SummaryOption): Promise<SummaryOption> {
	// Options group by `group` as a string, and equal TeX converts to equal MathML.
	const [label, group] = await Promise.all([html(entry.label), html(entry.group)]);
	return {
		...entry,
		label: label ?? entry.label,
		...(group === undefined ? {} : { group }),
	};
}

function html(source: string | undefined): Promise<string | undefined> {
	return typeof source === "string" ? convertMath(source) : Promise.resolve(undefined);
}
