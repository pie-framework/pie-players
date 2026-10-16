import type { Env, ItemConfig } from "@pie-players/pie-players-shared/types";
import "./components/PieItemSummary.svelte";
import type { ItemSummary, SummaryResolver } from "./summarize/summarize-item.js";

// Types only: `summarizeItem` is imported from `./summarize`, which loads no component.
export type {
	ElementSummary,
	ItemSummary,
	ItemSummaryEntry,
	SummarizeFn,
	SummarizeItemOptions,
	SummaryOption,
	SummaryOptions,
	SummaryPart,
	SummaryResolver,
} from "./summarize.js";

/** `<pie-item-summary>`: one item as a list row, rendered without loading its elements. */
export interface PieItemSummaryElement extends HTMLElement {
	config?: ItemConfig;
	/** Default `{ mode: "view", role: "instructor" }`; `role` gates answers. */
	env?: Env;
	/** A precomputed summary, used when its `schema` is 1. */
	summary?: ItemSummary;
	/** Without one, every element shows its prompt or display name. */
	resolve?: SummaryResolver;
	locale?: string;
}

declare global {
	interface HTMLElementTagNameMap {
		"pie-item-summary": PieItemSummaryElement;
	}
}
