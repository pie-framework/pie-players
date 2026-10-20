import type {
	ElementSummary,
	SummarizeFn,
	SummaryOption,
} from "@pie-element/shared-types";
import { withoutAnswers } from "../summarize/answers.js";
import { hasContent } from "../summarize/markup.js";

export { hasContent, promptOf } from "../summarize/markup.js";

/**
 * Helpers for the bundled summarizers. Each summarizer reads the authored model defensively, since
 * item content predates the current element types, and states answers only in `answer` and
 * `correct`, never inline in `prompt`, so `withoutAnswers` alone makes any summary student-safe.
 */

export type Model = Record<string, unknown>;

/** `summarize` gated by role: the instructor summary, stripped of answers for anyone else. */
export function summarizer(describe: (model: Model) => ElementSummary): SummarizeFn {
	return (model, { role }) => {
		const summary = compact(describe(isRecord(model) ? model : {}));
		return role === "instructor" ? summary : withoutAnswers(summary);
	};
}

/** `summary` without undefined fields or empty lists, so it serializes as it reads. */
function compact(summary: ElementSummary): ElementSummary {
	const kept: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(summary)) {
		if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
		kept[key] = key === "parts" ? (value as Model[]).map(compactPart) : value;
	}
	return kept as ElementSummary;
}

function compactPart(part: Model): Model {
	return Object.fromEntries(
		Object.entries(part).filter(
			([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
		),
	);
}

export function isRecord(value: unknown): value is Model {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function records(value: unknown): Model[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function text(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function idOf(value: unknown, fallback: string | number): string {
	return typeof value === "string" || typeof value === "number" ? String(value) : String(fallback);
}

/** The model's prompt for elements that show it whatever `promptEnabled` says. */
export function shownPrompt(model: Model): string | undefined {
	return hasContent(model.prompt) ? model.prompt : undefined;
}

/** HTML fragments joined in order, skipping empty ones; `undefined` when none has content. */
export function joinHtml(...fragments: (string | undefined)[]): string | undefined {
	const present = fragments.filter((fragment): fragment is string => hasContent(fragment));
	return present.length > 0 ? present.join("") : undefined;
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** The marker a cloze blank leaves in its markup: `[1]` for the first blank, by display number. */
export function blankMarker(index: number): string {
	return `<span class="pie-item-summary__blank">[${index + 1}]</span>`;
}

/** Group label for the options of one blank, matching its marker. */
export function blankGroup(index: number): string {
	return `[${index + 1}]`;
}

/** Answers per blank as an ordered list whose numbers match the blank markers. */
export function blankAnswers(answers: Map<number, string[]>): string | undefined {
	if (answers.size === 0) return undefined;
	const last = Math.max(...answers.keys());
	const items: string[] = [];
	for (let index = 0; index <= last; index += 1) {
		const accepted = answers.get(index) ?? [];
		items.push(`<li value="${index + 1}">${accepted.join(" / ")}</li>`);
	}
	return `<ol>${items.join("")}</ol>`;
}

/** An ordered list of HTML items, or `undefined` when there are none. */
export function orderedList(items: string[]): string | undefined {
	return items.length > 0 ? `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>` : undefined;
}

/** A two-column table of label and value rows. */
export function table(rows: [string, string][]): string | undefined {
	if (rows.length === 0) return undefined;
	return `<table><tbody>${rows
		.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`)
		.join("")}</tbody></table>`;
}

/** Inline TeX, delimited the way delivery and the row's converter read it. */
export function tex(source: string): string {
	return `\\(${source}\\)`;
}

/** Numbers as TeX shows them: integers bare, others rounded to four places. */
export function num(value: unknown): string {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return String(value);
	return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

export function option(id: string, label: string, correct?: boolean, group?: string): SummaryOption {
	return {
		id,
		label,
		...(correct ? { correct: true } : {}),
		...(group ? { group } : {}),
	};
}

/**
 * Cloze markup with each blank as its marker: `{{N}}` in `markup`, or, for content saved without
 * it, the `slateMarkup` spans whose `data-type` is `slateType`. Blank indices are zero-based.
 */
export function clozeMarkup(model: Model, slateType: string): string | undefined {
	const markup = text(model.markup);
	if (markup) return markup.replace(/\{\{(\d+)\}\}/g, (_, index) => blankMarker(Number(index)));
	const slate = text(model.slateMarkup);
	if (!slate) return undefined;
	const span = new RegExp(`<span\\b[^>]*data-type="${slateType}"[^>]*>(?:\\s*</span>)?`, "g");
	return slate.replace(span, (tag) => {
		const index = /data-index="(\d+)"/.exec(tag);
		return index ? blankMarker(Number(index[1])) : "";
	});
}

/** Entries of a record keyed by blank index, in index order. */
export function byIndex(value: unknown): [number, unknown][] {
	if (!isRecord(value) && !Array.isArray(value)) return [];
	return Object.entries(value)
		.map(([key, entry]): [number, unknown] => [Number(key), entry])
		.filter(([index]) => Number.isInteger(index) && index >= 0)
		.sort(([a], [b]) => a - b);
}

const TAGS = /<[^>]*>/g;
const BLOCK_END = /<\/(?:p|div|h[1-6]|li|ul|ol|blockquote|pre|table|figure|section)\s*>/gi;

/** Leading blocks of `html` holding about `limit` characters of text, then an ellipsis. */
export function excerpt(html: string, limit = 400): string {
	if (html.replace(TAGS, "").length <= limit) return html;
	for (const match of html.matchAll(BLOCK_END)) {
		const end = match.index + match[0].length;
		if (html.slice(0, end).replace(TAGS, "").length >= limit) {
			return end < html.length ? `${html.slice(0, end)}<p>…</p>` : html;
		}
	}
	return html;
}
