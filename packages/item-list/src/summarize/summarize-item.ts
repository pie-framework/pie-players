import type {
	ElementSummary,
	SummarizeFn,
	SummaryOptions,
	SummaryPart,
} from "@pie-element/shared-types";
import type {
	ItemConfig,
	PieContent,
	PieModel,
} from "@pie-players/pie-players-shared/types";
import { bundledSummaries } from "./bundled.js";
import { displayName, packageName } from "./label.js";
import { withoutAnswers } from "./answers.js";
import { hasContent, promptOf, readItemMarkup } from "./markup.js";

export { withoutAnswers };

/** An item described as data, for a list row that loads no element code. */
export interface ItemSummary {
	/** Versions the contract; a summary with another value is recomputed. */
	schema: 1;
	/** Item markup outside every element tag, as HTML. */
	stem?: string;
	/** The item's elements, in document order. */
	entries: ItemSummaryEntry[];
}

export interface ItemSummaryEntry {
	/** The model `id`, which is the element's `id` in markup. */
	id: string;
	/** Package name, without version. */
	pkg: string;
	/** The fallback rung that produced `summary`. */
	source: "summary" | "prompt" | "label";
	/** Display name derived from the package: "Multiple choice". */
	label: string;
	summary: ElementSummary;
}

/**
 * The summarizer for an element, or `null` to fall back to its prompt. `pkg` carries the version
 * from the item's `elements` map.
 */
export type SummaryResolver = (
	tagName: string,
	pkg: string,
) => Promise<SummarizeFn | null>;

export interface SummarizeItemOptions extends SummaryOptions {
	/**
	 * Default `bundledSummaries`. A resolver that returns `null` sends every element to the prompt
	 * or label rung.
	 */
	resolve?: SummaryResolver;
}

/** Packages whose summarizer has failed, so each warns once. */
const warned = new Set<string>();

/**
 * Summarizes `config` element by element, each from the first rung that yields content: the
 * resolved summarizer, the model's prompt, then the element's display name. Label entries are
 * dropped when any other entry has content.
 */
export async function summarizeItem(
	config: ItemConfig,
	options: SummarizeItemOptions,
): Promise<ItemSummary> {
	const content: PieContent = "pie" in config ? config.pie : config;
	const elements = content.elements ?? {};
	const models = content.models ?? [];
	const byId = new Map<string, PieModel>();
	for (const model of models) {
		if (model && typeof model.id === "string" && !byId.has(model.id)) {
			byId.set(model.id, model);
		}
	}

	let stem: string | undefined;
	let ordered: { tagName: string; model: PieModel }[];
	// Markup of element tags alone has no content of its own, yet still orders the elements.
	if (typeof content.markup === "string" && content.markup.trim().length > 0) {
		const tags = new Set<string>();
		for (const tag of Object.keys(elements)) tags.add(tag.toLowerCase());
		for (const model of models) {
			if (typeof model?.element === "string") tags.add(model.element.toLowerCase());
		}
		const markup = readItemMarkup(content.markup, tags);
		if (hasContent(markup.outside)) stem = markup.outside;
		const seen = new Set<string>();
		ordered = [];
		for (const { tagName, id } of markup.elements) {
			const model = byId.get(id);
			// A model with no tag is not rendered by delivery either, so it is skipped.
			if (!model || seen.has(id)) continue;
			seen.add(id);
			ordered.push({ tagName, model });
		}
	} else {
		ordered = [...byId.values()].map((model) => ({
			tagName: String(model.element ?? "").toLowerCase(),
			model,
		}));
	}

	const entries = await Promise.all(
		ordered.map(({ tagName, model }) =>
			summarizeElement(tagName, model, elementSpec(elements, tagName, model), options),
		),
	);
	const withContent = entries.filter((entry) => entry.source !== "label");
	return {
		schema: 1,
		...(stem === undefined ? {} : { stem }),
		entries: withContent.length > 0 ? withContent : entries,
	};
}

function elementSpec(
	elements: Record<string, string>,
	tagName: string,
	model: PieModel,
): string {
	for (const [tag, spec] of Object.entries(elements)) {
		if (tag.toLowerCase() === tagName) return spec;
	}
	return elements[model.element] ?? model.element ?? tagName;
}

async function summarizeElement(
	tagName: string,
	model: PieModel,
	spec: string,
	options: SummarizeItemOptions,
): Promise<ItemSummaryEntry> {
	const pkg = packageName(spec);
	const entry = { id: model.id, pkg, label: displayName(pkg) };
	const summary = await resolvedSummary(tagName, spec, pkg, model, options);
	if (summary) return { ...entry, source: "summary", summary };
	const prompt = promptSummary(model);
	if (prompt) return { ...entry, source: "prompt", summary: prompt };
	return { ...entry, source: "label", summary: {} };
}

async function resolvedSummary(
	tagName: string,
	spec: string,
	pkg: string,
	model: PieModel,
	options: SummarizeItemOptions,
): Promise<ElementSummary | null> {
	const resolve = options.resolve ?? bundledSummaries;
	const role = options.role === "instructor" ? "instructor" : "student";
	try {
		const summarize = await resolve(tagName, spec);
		if (!summarize) return null;
		const summary = summarize(model, { role });
		if (!isNonEmpty(summary)) return null;
		return role === "student" ? withoutAnswers(summary) : summary;
	} catch (error) {
		if (!warned.has(pkg)) {
			warned.add(pkg);
			console.warn(
				`[pie-item-list] The summarizer for ${pkg} failed; its prompt shows instead.`,
				error,
			);
		}
		return null;
	}
}

function promptSummary(model: Record<string, unknown>): ElementSummary | null {
	const prompt = promptOf(model);
	if (prompt) return { prompt };
	// Multi-part elements, such as EBSR's `partA` and `partB`, keep their prompts one level down.
	const parts: SummaryPart[] = [];
	for (const [key, child] of Object.entries(model)) {
		if (!child || typeof child !== "object" || Array.isArray(child)) continue;
		const childPrompt = promptOf(child as Record<string, unknown>);
		if (childPrompt) parts.push({ id: key, prompt: childPrompt });
	}
	return parts.length > 0 ? { parts } : null;
}

function isNonEmpty(summary: unknown): summary is ElementSummary {
	if (!summary || typeof summary !== "object") return false;
	const { prompt, parts, options, answer, figure, media } = summary as ElementSummary;
	return (
		hasContent(prompt) ||
		(Array.isArray(parts) && parts.length > 0) ||
		(Array.isArray(options) && options.length > 0) ||
		hasContent(answer) ||
		typeof figure?.src === "string" ||
		(Array.isArray(media) && media.length > 0)
	);
}
