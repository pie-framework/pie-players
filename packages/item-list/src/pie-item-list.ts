import type { PieItemPlayerLoaderOptions } from "@pie-players/pie-item-player";
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

/** `<pie-item-summary>`: one item as a list row, rendered without loading its elements until expanded. */
export interface PieItemSummaryElement extends HTMLElement {
	config?: ItemConfig;
	/** Default `{ mode: "view", role: "instructor" }`; `role` gates answers. */
	env?: Env;
	/** A precomputed summary, used when its `schema` is 1. */
	summary?: ItemSummary;
	/** Default `bundledSummaries`; one returning `null` shows each element's prompt or display name. */
	resolve?: SummaryResolver;
	locale?: string;
	/** Mounts `<pie-item-player>` for the item once the row nears the viewport. */
	expanded?: boolean;
	/** The expanded player's `strategy`. Default `iife`, as on the player. */
	strategy?: "iife" | "esm" | "preloaded";
	/** The expanded player's `loaderOptions`. Rows given the same object share one element load. */
	loaderOptions?: PieItemPlayerLoaderOptions;
}

declare global {
	interface HTMLElementTagNameMap {
		"pie-item-summary": PieItemSummaryElement;
	}
}
