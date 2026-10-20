/**
 * `@pie-players/pie-item-list/summarize`: item summaries as data. Node-safe: it registers no custom
 * element and touches no DOM, so a server can precompute what `<pie-item-summary>` renders.
 */
export type {
	ElementSummary,
	SummarizeFn,
	SummaryOption,
	SummaryOptions,
	SummaryPart,
} from "@pie-element/shared-types";
export {
	type ItemSummary,
	type ItemSummaryEntry,
	type SummarizeItemOptions,
	type SummaryResolver,
	summarizeItem,
} from "./summarize/summarize-item.js";
export { isItemSummary } from "./summarize/validate.js";
