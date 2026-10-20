import type { ItemConfig } from "@pie-players/pie-players-shared/types";
import type { ItemSummary } from "../summarize/summarize-item.js";

/** One row of `<pie-item-list>`. */
export interface ItemListEntry {
	/** Unique within the list; keys the row and its expanded state. */
	id: string;
	config: ItemConfig;
	name?: string;
	version?: string;
	/** A passage held apart from the item, summarized above it. */
	passage?: ItemConfig;
	/** A precomputed summary of `config`. */
	summary?: ItemSummary;
	/** The host's search matches, shown below the summary, outside its clip. */
	highlights?: ItemListHighlight[];
	/** Host data, passed through to the extension points untouched. */
	data?: unknown;
}

/** One matched field of an entry, as a search engine returns it. */
export interface ItemListHighlight {
	/** The field's name as the host shows it, such as "Prompt" or "Passage". */
	label?: string;
	/** HTML fragments in which `<mark>` marks a match. Only their text and marks render. */
	snippets: string[];
}

/** What a function extension may return: a Svelte action's shape. */
export interface ItemListExtensionHandle {
	/** Takes a changed entry in place. Without it, a changed entry destroys and re-renders the extension. */
	update?(entry: ItemListEntry): void;
	/** Runs before a re-render and when the row goes away. */
	destroy?(): void;
}

/**
 * Renders into a row's `details`, `actions` or `highlights` slot. A tag name is created once per row
 * and receives the entry as its `item` property, again whenever the entry changes. A function
 * renders into `host` and may return a handle; framework components mount through it.
 */
export type ItemListExtension =
	| string
	// biome-ignore lint/suspicious/noConfusingVoidType: a render function returns nothing or its handle, as a Svelte action does.
	| ((entry: ItemListEntry, host: HTMLElement) => void | ItemListExtensionHandle);

export interface MountedExtension {
	update(extension: ItemListExtension, entry: ItemListEntry): void;
	destroy(): void;
}

/** Mounts `extension` into `host` for `entry`, re-rendering only when either changes identity. */
export function mountExtension(
	host: HTMLElement,
	extension: ItemListExtension,
	entry: ItemListEntry,
): MountedExtension {
	let current = extension;
	let shown = entry;
	let handle: ItemListExtensionHandle | undefined;
	let element: (HTMLElement & { item?: ItemListEntry }) | undefined;

	function guard(phase: string, run: () => void): void {
		try {
			run();
		} catch (error) {
			console.error(`[pie-item-list] A row extension failed to ${phase}.`, error);
		}
	}

	function render(): void {
		guard("render", () => {
			if (typeof current === "string") {
				element = document.createElement(current);
				element.item = shown;
				host.append(element);
				return;
			}
			const result = current(shown, host);
			handle = result && typeof result === "object" ? result : undefined;
		});
	}

	function teardown(): void {
		const done = handle;
		handle = undefined;
		element = undefined;
		if (done?.destroy) guard("clean up", () => done.destroy?.());
		host.replaceChildren();
	}

	render();
	return {
		update(nextExtension, nextEntry) {
			if (nextExtension === current && nextEntry === shown) return;
			const sameExtension = nextExtension === current;
			current = nextExtension;
			shown = nextEntry;
			if (sameExtension && element) {
				element.item = nextEntry;
				return;
			}
			if (sameExtension && handle?.update) {
				const live = handle;
				guard("update", () => live.update?.(nextEntry));
				return;
			}
			teardown();
			render();
		},
		destroy: teardown,
	};
}
