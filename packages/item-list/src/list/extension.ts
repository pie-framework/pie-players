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
	/** Host data, passed through to the extension points untouched. */
	data?: unknown;
}

/**
 * Renders into a row's `details`, `actions` or `highlights` slot. A tag name is created once per row and receives
 * the entry as its `item` property. A function renders into `host` and may return a cleanup, which
 * runs before it renders a changed entry and when the row goes away; framework components mount
 * through it.
 */
export type ItemListExtension =
	| string
	// biome-ignore lint/suspicious/noConfusingVoidType: a render callback returns nothing or its cleanup, as a React effect does.
	| ((entry: ItemListEntry, host: HTMLElement) => void | (() => void));

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
	let cleanup: (() => void) | undefined;
	let element: (HTMLElement & { item?: ItemListEntry }) | undefined;

	function render(): void {
		try {
			if (typeof current === "string") {
				element = document.createElement(current);
				element.item = shown;
				host.append(element);
				return;
			}
			const result = current(shown, host);
			cleanup = typeof result === "function" ? result : undefined;
		} catch (error) {
			console.error("[pie-item-list] A row extension failed to render.", error);
		}
	}

	function teardown(): void {
		try {
			cleanup?.();
		} catch (error) {
			console.error("[pie-item-list] A row extension's cleanup failed.", error);
		}
		cleanup = undefined;
		element = undefined;
		host.replaceChildren();
	}

	render();
	return {
		update(nextExtension, nextEntry) {
			if (nextExtension === current && nextEntry === shown) return;
			const sameTag = typeof nextExtension === "string" && nextExtension === current;
			current = nextExtension;
			shown = nextEntry;
			if (sameTag && element) {
				element.item = nextEntry;
				return;
			}
			teardown();
			render();
		},
		destroy: teardown,
	};
}
