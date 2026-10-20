import type {
	ElementSummary,
	SummaryOption,
	SummaryOptions,
} from "@pie-element/shared-types";
import { sanitizeItemMarkup } from "@pie-players/pie-players-shared/security";
import { convertMath } from "../math.js";
import type {
	ItemSummary,
	ItemSummaryEntry,
} from "../summarize/summarize-item.js";
import { withoutAnswers } from "../summarize/answers.js";

/** A summary as the sanitized HTML `<pie-item-summary>` renders. */
export interface RenderedSummary {
	stem?: string;
	entries: RenderedEntry[];
}

export interface RenderedBlock {
	prompt?: string;
	/** Options by `group`, in order of each group's first option. Ungrouped options form one group. */
	groups: RenderedGroup[];
	answer?: string;
}

export interface RenderedGroup {
	/** HTML; absent for the ungrouped options. */
	label?: string;
	options: RenderedOption[];
}

export interface RenderedOption {
	id: string;
	label: string;
	correct: boolean;
}

export interface RenderedEntry extends RenderedBlock {
	id: string;
	pkg: string;
	source: ItemSummaryEntry["source"];
	label: string;
	parts: RenderedBlock[];
	figure?: string;
	media: { kind: "audio" | "video"; title?: string }[];
	manualScoring: boolean;
}

/**
 * Converts the math in `summary` and sanitizes every HTML string after conversion. A `student`
 * render drops answers and correct markers, whatever the summary holds.
 */
export async function renderSummary(
	summary: ItemSummary,
	role: SummaryOptions["role"],
): Promise<RenderedSummary> {
	const stem = await html(summary.stem);
	const entries = await Promise.all(
		summary.entries.map(async (entry): Promise<RenderedEntry> => {
			const element: ElementSummary =
				role === "student" ? withoutAnswers(entry.summary) : entry.summary;
			const parts = await Promise.all((element.parts ?? []).map(block));
			return {
				id: entry.id,
				pkg: entry.pkg,
				source: entry.source,
				label: entry.label,
				...(await block(element)),
				parts,
				...(element.figure?.src ? { figure: figure(element.figure) } : {}),
				media: (element.media ?? []).map(({ kind, title }) =>
					title ? { kind, title } : { kind },
				),
				manualScoring: element.manualScoring === true,
			};
		}),
	);
	return { ...(stem ? { stem } : {}), entries };
}

async function block(content: {
	prompt?: string;
	options?: SummaryOption[];
	answer?: string;
}): Promise<RenderedBlock> {
	const [prompt, answer, groups] = await Promise.all([
		html(content.prompt),
		html(content.answer),
		optionGroups(content.options ?? []),
	]);
	return {
		...(prompt ? { prompt } : {}),
		groups,
		...(answer ? { answer } : {}),
	};
}

async function optionGroups(options: SummaryOption[]): Promise<RenderedGroup[]> {
	const byGroup = new Map<string | undefined, SummaryOption[]>();
	for (const option of options) {
		const key = typeof option.group === "string" && option.group.length > 0 ? option.group : undefined;
		const members = byGroup.get(key);
		if (members) members.push(option);
		else byGroup.set(key, [option]);
	}
	return Promise.all(
		[...byGroup].map(async ([group, members]) => {
			const label = await html(group);
			return {
				...(label ? { label } : {}),
				options: await Promise.all(
					members.map(async (option) => ({
						id: option.id,
						label: (await html(option.label)) ?? "",
						correct: option.correct === true,
					})),
				),
			};
		}),
	);
}

async function html(source: string | undefined): Promise<string | undefined> {
	if (typeof source !== "string" || source.length === 0) return undefined;
	return sanitizeItemMarkup(await convertMath(source)) || undefined;
}

/** The figure as an image, through the sanitizer so its `src` is held to the markup's rules. */
function figure({ src, alt }: { src: string; alt?: string }): string | undefined {
	const image = `<img src="${attribute(src)}" alt="${attribute(alt ?? "")}">`;
	return sanitizeItemMarkup(image, { wrapOverwideContent: false }) || undefined;
}

function attribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
