import type { ItemConfig } from "@pie-players/pie-players-shared/types";
import type { ItemSummary } from "../summarize/summarize-item.js";

/** One row of `<pie-item-list>`. */
export interface ItemListEntry {
	/** Unique within the list; keys the row and its expanded state. */
	id: string;
	/**
	 * The item the expanded row plays. Optional with a `summary`: a host that fetches it on
	 * `expanded-changed` sets it on the entry, and the expanded row shows the whole summary until then.
	 */
	config?: ItemConfig;
	name?: string;
	version?: string;
	/** Passages held apart from the item, each summarized above it in order. */
	passages?: ItemConfig[];
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

/** What a function extension may return, directly or as a promise. */
export interface ItemListExtensionHandle {
	/** Takes a changed entry in place. Without it, a changed entry destroys and re-renders the extension. */
	update?(entry: ItemListEntry): void;
	/** Runs before a re-render and when the row goes away. */
	destroy?(): void;
}

/**
 * Renders into a row's `details`, `actions` or `highlights` slot. A tag name is created once per row
 * and receives the entry as its `entry` property, again whenever the entry changes. A function
 * renders into `host` and may return a handle, or a promise of one; framework components mount
 * through it.
 */
export type ItemListExtension =
	| string
	| ((
			entry: ItemListEntry,
			host: HTMLElement,
			// biome-ignore lint/suspicious/noConfusingVoidType: a render function returns nothing or its handle.
		) => void | ItemListExtensionHandle | Promise<void | ItemListExtensionHandle>);

/** The step an extension failed in, as `extension-error` reports it. */
export type ItemListExtensionPhase = "render" | "update" | "destroy";

export interface MountedExtension {
	update(extension: ItemListExtension, entry: ItemListEntry): void;
	destroy(): void;
}

/**
 * Mounts `extension` into `host` for `entry`, re-rendering only when either changes identity.
 * `report` hears every failure, which never escapes into the list.
 */
export function mountExtension(
	host: HTMLElement,
	extension: ItemListExtension,
	entry: ItemListEntry,
	report: (phase: ItemListExtensionPhase, error: unknown) => void,
): MountedExtension {
	let current = extension;
	let shown = entry;
	let handle: ItemListExtensionHandle | undefined;
	let element: (HTMLElement & { entry?: ItemListEntry }) | undefined;
	// Counts renders and teardowns, so a pending handle knows whether its render still stands.
	let mounting = 0;
	// While a render's handle is pending, an update records the entry and the handle takes it.
	let pending = false;
	// After a tag name failed to create an element, an update with the same tag does not retry it.
	let failed = false;

	function guard(phase: ItemListExtensionPhase, run: () => void): void {
		try {
			run();
		} catch (error) {
			report(phase, error);
		}
	}

	function adopt(result: unknown): void {
		handle = result && typeof result === "object" ? (result as ItemListExtensionHandle) : undefined;
	}

	function render(): void {
		failed = false;
		const run = ++mounting;
		guard("render", () => {
			if (typeof current === "string") renderTag(current);
			else renderFunction(current, run);
		});
	}

	function renderTag(tagName: string): void {
		let created: HTMLElement & { entry?: ItemListEntry };
		try {
			created = document.createElement(tagName);
		} catch (error) {
			failed = true;
			throw error;
		}
		element = created;
		created.entry = shown;
		host.append(created);
		// Set before the element upgrades, `entry` is an own property that hides the class's setter;
		// re-set after the upgrade so the element sees it.
		if (!customElements.get(tagName) && tagName.includes("-")) {
			void customElements.whenDefined(tagName).then(() => {
				if (element !== created || !Object.hasOwn(created, "entry")) return;
				const value = created.entry;
				delete created.entry;
				created.entry = value;
			});
		}
	}

	function renderFunction(extensionFn: Exclude<ItemListExtension, string>, run: number): void {
		const rendered = shown;
		const result = extensionFn(rendered, host);
		if (!(result instanceof Promise)) {
			adopt(result);
			return;
		}
		pending = true;
		result.then(
			(resolved) => {
				if (run !== mounting) {
					// Torn down while pending.
					const late = resolved && typeof resolved === "object" ? resolved : undefined;
					if (late?.destroy) guard("destroy", () => late.destroy?.());
					return;
				}
				pending = false;
				adopt(resolved);
				const live = handle;
				if (shown === rendered) return;
				if (live?.update) guard("update", () => live.update?.(shown));
				else {
					teardown();
					render();
				}
			},
			(error: unknown) => {
				if (run !== mounting) return;
				pending = false;
				report("render", error);
			},
		);
	}

	function teardown(): void {
		mounting += 1;
		pending = false;
		const done = handle;
		handle = undefined;
		element = undefined;
		if (done?.destroy) guard("destroy", () => done.destroy?.());
		host.replaceChildren();
	}

	render();
	return {
		update(nextExtension, nextEntry) {
			if (nextExtension === current && nextEntry === shown) return;
			const sameExtension = nextExtension === current;
			current = nextExtension;
			shown = nextEntry;
			if (sameExtension && (failed || pending)) return;
			if (sameExtension && element) {
				element.entry = nextEntry;
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
