import type { PieItemPlayerLoaderOptions } from "@pie-players/pie-item-player";
import type { Env, ItemConfig } from "@pie-players/pie-players-shared/types";
import "./components/PieItemSummary.svelte";
import "./components/PieItemList.svelte";
import type { ItemListEntry, ItemListExtension } from "./list/extension.js";
import type { ItemSummary, SummaryResolver } from "./summarize/summarize-item.js";

export type { ItemListEntry, ItemListExtension } from "./list/extension.js";

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

/** `<pie-item-list>`: `<pie-item-summary>` rows with details, actions and an expand button each. */
export interface PieItemListElement extends HTMLElement {
	items?: ItemListEntry[];
	/** Passed to every row. */
	env?: Env;
	/** Passed to every row. */
	resolve?: SummaryResolver;
	locale?: string;
	/** Expands every row; a change resets the rows' own toggles. */
	expanded?: boolean;
	/** Passed to every row's player. */
	strategy?: "iife" | "esm" | "preloaded";
	/** Passed to every row's player, so the rows share one element load. */
	loaderOptions?: PieItemPlayerLoaderOptions;
	/** The row's leading column. Default: the entry's `name`, `id` and `version`. */
	details?: ItemListExtension;
	/** The row's top-end corner. Default: empty. */
	actions?: ItemListExtension;
}

declare global {
	interface HTMLElementTagNameMap {
		"pie-item-list": PieItemListElement;
		"pie-item-summary": PieItemSummaryElement;
	}
}
