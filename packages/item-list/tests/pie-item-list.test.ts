/**
 * `<pie-item-list>` mounted in happy-dom: its rows, the expand toggle, the extension points and the
 * events a host sees. An `IntersectionObserver` that never reports keeps expanded rows from mounting
 * a player; the player view itself is covered by `e2e/pie-item-list.spec.ts`.
 */

import "./support/dom.js";
import { afterEach, describe, expect, test } from "bun:test";
import type { PieContent } from "@pie-players/pie-players-shared/types";
import type {
	ItemListEntry,
	PieItemListElement,
	PieItemSummaryElement,
} from "../src/pie-item-list.js";

globalThis.IntersectionObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as unknown as typeof IntersectionObserver;
await import("../src/components/PieItemList.svelte");

async function settle(rounds = 20): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function item(id: string, prompt = "Pick one"): PieContent {
	return {
		id,
		elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
		models: [{ id: "1", element: "multiple-choice", prompt: `<p>${prompt}</p>` }],
		markup: '<multiple-choice id="1"></multiple-choice>',
	};
}

const passage: PieContent = {
	id: "passage",
	elements: { "pie-passage": "@pie-element/passage@5.0.0" },
	models: [{ id: "p", element: "pie-passage", passages: [{ title: "The river", text: "<p>Water.</p>" }] }],
	markup: '<pie-passage id="p"></pie-passage>',
};

interface Mounted {
	list: HTMLElement & PieItemListElement;
	events: { type: string; detail: Record<string, unknown> }[];
}

async function mount(props: Partial<PieItemListElement>): Promise<Mounted> {
	const list = document.createElement("pie-item-list") as HTMLElement & PieItemListElement;
	const events: Mounted["events"] = [];
	for (const type of ["expanded-changed", "player-error", "load-complete", "extension-error", "framework-error"]) {
		list.addEventListener(type, (event) => {
			events.push({ type, detail: (event as CustomEvent).detail });
		});
	}
	Object.assign(list, props);
	document.body.append(list);
	await settle();
	return { list, events };
}

function rows(list: HTMLElement): HTMLElement[] {
	return [...list.querySelectorAll<HTMLElement>(".pie-item-list__row")];
}

function summaries(row: HTMLElement): (HTMLElement & PieItemSummaryElement)[] {
	return [...row.querySelectorAll<HTMLElement & PieItemSummaryElement>("pie-item-summary")];
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("<pie-item-list>", () => {
	test("renders a row per entry with its details and summary, its passage above it", async () => {
		const { list } = await mount({
			items: [
				{ id: "a", config: item("a"), name: "Rivers", version: "2.0.0", passages: [passage] },
				{ id: "b", config: item("b", "Pick two") },
			],
		});
		const [first, second] = rows(list);
		expect(first.dataset.pieItemId).toBe("a");
		expect(first.querySelector(".pie-item-list__name")?.textContent).toBe("Rivers");
		expect(first.querySelector(".pie-item-list__id")?.textContent).toBe("a");
		expect(first.querySelector(".pie-item-list__version")?.textContent).toBe("2.0.0");
		expect(first.querySelector(".pie-item-list__actions")).toBeNull();
		expect(summaries(first).map((row) => row.config?.id)).toEqual(["passage", "a"]);
		expect(second.querySelector(".pie-item-list__name")).toBeNull();
		expect(summaries(second)[0].querySelector(".pie-item-summary__prompt")?.textContent).toBe("Pick two");
	});

	test("expands a row from its button, and resets the rows when `expanded` changes", async () => {
		const { list, events } = await mount({
			items: [
				{ id: "a", config: item("a") },
				{ id: "b", config: item("b") },
			],
		});
		const [first, second] = rows(list);
		const button = first.querySelector<HTMLButtonElement>(".pie-item-list__toggle");
		const view = first.querySelector<HTMLElement>(".pie-item-list__view");
		const clipped = summaries(first)[0];
		expect(button?.getAttribute("aria-expanded")).toBe("false");
		expect(button?.getAttribute("aria-controls")).toBe(view?.id);
		expect(button?.getAttribute("aria-labelledby")).toBe(
			`${button?.id} ${first.querySelector(".pie-item-list__details")?.id}`,
		);
		expect(button?.getAttribute("aria-label")).toBe("Show the full item");
		expect(button?.getAttribute("title")).toBe("Show the full item");
		expect(clipped.classList.contains("pie-item-list__item--clipped")).toBe(true);

		button?.click();
		await settle();
		expect(button?.getAttribute("aria-expanded")).toBe("true");
		expect(clipped.classList.contains("pie-item-list__item--clipped")).toBe(false);
		expect(summaries(first)[0].expanded).toBe(true);
		expect(summaries(second)[0].expanded).toBe(false);
		expect(first.getAttribute("aria-busy")).toBe("true");
		expect(button?.getAttribute("title")).toBe("Show the summary");
		expect(events.filter((event) => event.type === "expanded-changed")).toEqual([
			{ type: "expanded-changed", detail: { id: "a", expanded: true, expandedIds: ["a"] } },
		]);

		list.expanded = true;
		await settle();
		expect(summaries(first)[0].expanded).toBe(true);
		expect(summaries(second)[0].expanded).toBe(true);
		button?.click();
		await settle();
		expect(summaries(first)[0].expanded).toBe(false);

		list.expanded = false;
		await settle();
		expect(rows(list).map((row) => summaries(row)[0].expanded)).toEqual([false, false]);
	});

	test("expands the rows `expandedIds` names, keeping the rows' toggles while its contents stay the same", async () => {
		const { list, events } = await mount({
			items: [
				{ id: "a", config: item("a") },
				{ id: "b", config: item("b") },
				{ id: "c", config: item("c") },
			],
			expandedIds: ["b", "missing"],
		});
		const expandedRows = () => rows(list).map((row) => summaries(row)[0].expanded);
		expect(expandedRows()).toEqual([false, true, false]);

		rows(list)[0].querySelector<HTMLButtonElement>(".pie-item-list__toggle")?.click();
		await settle();
		expect(expandedRows()).toEqual([true, true, false]);
		expect(events.filter((event) => event.type === "expanded-changed").at(-1)?.detail.expandedIds).toEqual(["a", "b"]);

		list.expandedIds = ["missing", "b"];
		await settle();
		expect(expandedRows()).toEqual([true, true, false]);

		list.expandedIds = ["c"];
		await settle();
		expect(expandedRows()).toEqual([false, false, true]);
	});

	test("gives every row the list's one i18n provider, which follows `locale`", async () => {
		const { list } = await mount({ items: [{ id: "a", config: item("a"), passages: [passage] }] });
		const [passageRow, itemRow] = summaries(rows(list)[0]);
		expect(passageRow.i18n).toBeTruthy();
		expect(itemRow.i18n).toBe(passageRow.i18n);
		expect(itemRow.locale ?? "").toBe("");

		list.locale = "nl-NL";
		await settle(60);
		expect(itemRow.i18n?.getLocale()).toBe("nl-NL");
		expect(rows(list)[0].querySelector(".pie-item-list__toggle")?.getAttribute("aria-label")).toBe(
			"Volledige vraag tonen",
		);
	});

	test("ends a row's busy state once its player loads", async () => {
		const { list } = await mount({ items: [{ id: "a", config: item("a") }], expanded: true });
		const [row] = rows(list);
		expect(row.getAttribute("aria-busy")).toBe("true");
		summaries(row)[0].dispatchEvent(
			new CustomEvent("load-complete", { detail: { view: "player" }, bubbles: true }),
		);
		await settle();
		expect(row.hasAttribute("aria-busy")).toBe(false);
	});

	test("re-dispatches a row's player error once, with the entry id", async () => {
		let reachedDocument = 0;
		const count = () => {
			reachedDocument += 1;
		};
		document.addEventListener("player-error", count);
		try {
			const { list, events } = await mount({ items: [{ id: "a", config: item("a") }], expanded: true });
			const [row] = rows(list);
			summaries(row)[0].dispatchEvent(
				new CustomEvent("player-error", {
					detail: { code: "ITEM_SUMMARY_PLAYER_TIMEOUT", message: "late", recoverable: true },
					bubbles: true,
					composed: true,
				}),
			);
			await settle();
			expect(events.filter((event) => event.type === "player-error")).toEqual([
				{
					type: "player-error",
					detail: {
						code: "ITEM_SUMMARY_PLAYER_TIMEOUT",
						message: "late",
						recoverable: true,
						id: "a",
						part: "item",
					},
				},
			]);
			expect(reachedDocument).toBe(1);
			expect(row.hasAttribute("aria-busy")).toBe(false);
			expect(row.querySelector(".pie-item-list__status")?.textContent).toBe(
				"The full item could not be loaded.",
			);
			expect(row.querySelector(".pie-item-list__status")?.getAttribute("role")).toBe("alert");

			row.querySelector<HTMLButtonElement>(".pie-item-list__toggle")?.click();
			await settle();
			expect(row.querySelector(".pie-item-list__status")).toBeNull();
		} finally {
			document.removeEventListener("player-error", count);
		}
	});

	test("gives a tag-name extension the entry as its `entry`, keeping the element as it changes", async () => {
		const first: ItemListEntry = { id: "a", config: item("a"), data: { selected: false } };
		const { list } = await mount({ items: [first], actions: "row-actions" });
		const actions = list.querySelector("row-actions") as HTMLElement & { entry?: ItemListEntry };
		expect(actions.entry).toBe(first);
		expect(actions.parentElement?.classList.contains("pie-item-list__actions")).toBe(true);

		const changed: ItemListEntry = { ...first, data: { selected: true } };
		list.items = [changed];
		await settle();
		expect(list.querySelector("row-actions")).toBe(actions);
		expect(actions.entry).toBe(changed);
	});

	test("runs a function extension once per entry, destroying its handle before a change and on removal", async () => {
		const calls: string[] = [];
		const details = (entry: ItemListEntry, host: HTMLElement) => {
			calls.push(`render ${entry.name}`);
			host.textContent = `Selected: ${entry.name}`;
			return {
				destroy: () => {
					calls.push(`cleanup ${entry.name}`);
				},
			};
		};
		const entry: ItemListEntry = { id: "a", config: item("a"), name: "one" };
		const { list } = await mount({ items: [entry], details });
		const [row] = rows(list);
		expect(row.querySelector(".pie-item-list__details")?.textContent).toBe("Selected: one");
		expect(row.querySelector(".pie-item-list__id")).toBeNull();

		row.querySelector<HTMLButtonElement>(".pie-item-list__toggle")?.click();
		await settle();
		list.items = [entry];
		await settle();
		expect(calls).toEqual(["render one"]);

		list.items = [{ ...entry, name: "two" }];
		await settle();
		expect(calls).toEqual(["render one", "cleanup one", "render two"]);
		expect(row.querySelector(".pie-item-list__details")?.textContent).toBe("Selected: two");

		list.items = [];
		await settle();
		expect(calls).toEqual(["render one", "cleanup one", "render two", "cleanup two"]);
	});

	test("updates a function extension's handle in place when its entry changes", async () => {
		const calls: string[] = [];
		const actions = (entry: ItemListEntry, host: HTMLElement) => {
			calls.push(`render ${entry.name}`);
			const label = document.createElement("span");
			label.textContent = String(entry.name);
			host.append(label);
			return {
				update(next: ItemListEntry) {
					calls.push(`update ${next.name}`);
					label.textContent = String(next.name);
				},
				destroy() {
					calls.push("destroy");
				},
			};
		};
		const entry: ItemListEntry = { id: "a", config: item("a"), name: "one" };
		const { list } = await mount({ items: [entry], actions });
		const label = list.querySelector(".pie-item-list__actions span");

		list.items = [{ ...entry, name: "two" }];
		await settle();
		expect(calls).toEqual(["render one", "update two"]);
		expect(list.querySelector(".pie-item-list__actions span")).toBe(label);
		expect(label?.textContent).toBe("two");

		list.items = [];
		await settle();
		expect(calls).toEqual(["render one", "update two", "destroy"]);
	});

	test("renders an entry's highlights as text and marks, each snippet once, outside the clip", async () => {
		const { list } = await mount({
			items: [
				{
					id: "a",
					config: item("a"),
					highlights: [
						{
							label: "Prompt",
							snippets: [
								'a <mark>river</mark> &amp; <b onclick="x()">its</b> banks<script>alert(1)</script>',
								"  ",
							],
						},
						{ label: "Prompt (stemmed)", snippets: ["a  <mark>river</mark> &amp; its banks"] },
						{ label: "Passage", snippets: ["<em>The</em> <mark>river</mark> runs"] },
						{ label: "Empty", snippets: [] },
					],
				},
				{ id: "b", config: item("b") },
			],
		});
		const [first, second] = rows(list);
		const block = first.querySelector<HTMLElement>(".pie-item-list__highlights");
		expect(block?.getAttribute("role")).toBe("group");
		expect(block?.getAttribute("aria-label")).toBe("Search matches");
		expect(block?.querySelector(".pie-item-list__highlights-title")?.getAttribute("aria-hidden")).toBe("true");
		expect(block?.previousElementSibling?.classList.contains("pie-item-list__view")).toBe(true);
		const labels = [...first.querySelectorAll(".pie-item-list__highlight-label")];
		expect(labels.map((label) => label.textContent)).toEqual(["Prompt", "Passage"]);
		const snippets = [...first.querySelectorAll(".pie-item-list__snippet")];
		expect(snippets.map((snippet) => snippet.innerHTML.replaceAll("<!---->", ""))).toEqual([
			"a <mark>river</mark> &amp; its banks",
			"The <mark>river</mark> runs",
		]);
		expect(first.querySelector(".pie-item-list__highlights script, .pie-item-list__highlights b")).toBeNull();
		expect(second.querySelector(".pie-item-list__highlights")).toBeNull();
	});

	test("renders the `highlights` extension in place of the built-in block", async () => {
		const highlights = (entry: ItemListEntry, host: HTMLElement) => {
			host.textContent = `${entry.highlights?.length ?? 0} fields`;
		};
		const { list } = await mount({
			items: [{ id: "a", config: item("a"), highlights: [{ snippets: ["<mark>x</mark>"] }] }],
			highlights,
		});
		const block = list.querySelector<HTMLElement>(".pie-item-list__highlights");
		expect(block?.textContent).toBe("1 fields");
		expect(block?.querySelector(".pie-item-list__snippet")).toBeNull();
	});

	test("keeps rendering the other rows when an extension throws", async () => {
		const original = console.error;
		console.error = () => {};
		try {
			const { list } = await mount({
				items: [{ id: "a", config: item("a") }],
				actions: () => {
					throw new Error("broken");
				},
			});
			expect(summaries(rows(list)[0])[0].querySelector(".pie-item-summary__prompt")?.textContent).toBe(
				"Pick one",
			);
		} finally {
			console.error = original;
		}
	});

	test("shows only the first of two entries sharing an id", async () => {
		const original = console.warn;
		const warnings: unknown[] = [];
		console.warn = (message: unknown) => warnings.push(message);
		try {
			const { list } = await mount({
				items: [
					{ id: "a", config: item("a", "First") },
					{ id: "a", config: item("a", "Second") },
				],
			});
			expect(rows(list)).toHaveLength(1);
			expect(warnings).toHaveLength(1);
		} finally {
			console.warn = original;
		}
	});

	test("lets `expandedIds` decide over `expanded`, keeping loaded rows settled across a change", async () => {
		const { list } = await mount({
			items: [
				{ id: "a", config: item("a") },
				{ id: "b", config: item("b") },
			],
			expanded: true,
			expandedIds: ["a"],
		});
		const [first, second] = rows(list);
		expect(rows(list).map((row) => summaries(row)[0].expanded)).toEqual([true, false]);
		summaries(first)[0].dispatchEvent(
			new CustomEvent("load-complete", { detail: { view: "player" }, bubbles: true }),
		);
		await settle();
		expect(first.hasAttribute("aria-busy")).toBe(false);

		list.expandedIds = ["a", "b"];
		await settle();
		expect(first.hasAttribute("aria-busy")).toBe(false);
		expect(second.getAttribute("aria-busy")).toBe("true");

		list.expandedIds = undefined;
		await settle();
		expect(rows(list).map((row) => summaries(row)[0].expanded)).toEqual([true, true]);
	});

	test("re-dispatches its own summaries' `load-complete` with the entry and part, and lets others pass", async () => {
		const actions = (_entry: ItemListEntry, host: HTMLElement) => {
			host.append(document.createElement("span"));
		};
		const { list, events } = await mount({
			items: [{ id: "a", config: item("a"), passages: [passage] }],
			actions,
		});
		events.length = 0;
		const [passageRow, itemRow] = summaries(rows(list)[0]);
		passageRow.dispatchEvent(new CustomEvent("load-complete", { detail: { view: "summary" }, bubbles: true }));
		itemRow.dispatchEvent(new CustomEvent("load-complete", { detail: { view: "player" }, bubbles: true }));
		const foreign = { code: "OTHER", message: "not ours", recoverable: false };
		list.querySelector(".pie-item-list__actions span")?.dispatchEvent(
			new CustomEvent("player-error", { detail: foreign, bubbles: true }),
		);
		await settle();
		expect(events).toEqual([
			{ type: "load-complete", detail: { id: "a", part: "passage", view: "summary" } },
			{ type: "load-complete", detail: { id: "a", part: "item", view: "player" } },
			{ type: "player-error", detail: foreign },
		]);
		expect(list.querySelector(".pie-item-list__status")).toBeNull();
	});

	test("summarizes each of an entry's passages above its item, passing the loader inputs to every row", async () => {
		const loaderConfig = { trackPageActions: false };
		const second: PieContent = { ...passage, id: "passage-2" };
		const { list } = await mount({
			items: [{ id: "a", config: item("a"), passages: [passage, second] }],
			loaderConfig,
		});
		const shown = summaries(rows(list)[0]);
		expect(shown.map((row) => row.config?.id)).toEqual(["passage", "passage-2", "a"]);
		expect(shown.every((row) => (row as unknown as { loaderConfig?: unknown }).loaderConfig === loaderConfig)).toBe(
			true,
		);
	});

	test("takes an entry's `config` late: an expanded row without one shows its summary and is not busy", async () => {
		const precomputed = { schema: 1 as const, entries: [] };
		const { list, events } = await mount({ items: [{ id: "a", summary: precomputed }] });
		const [row] = rows(list);
		row.querySelector<HTMLButtonElement>(".pie-item-list__toggle")?.click();
		await settle();
		expect(events.some((event) => event.type === "expanded-changed")).toBe(true);
		expect(summaries(row)[0].expanded).toBe(true);
		expect(row.hasAttribute("aria-busy")).toBe(false);

		list.items = [{ id: "a", summary: precomputed, config: item("a") }];
		await settle();
		expect(row.getAttribute("aria-busy")).toBe("true");
	});

	test("reports a failing extension as `extension-error` with its slot and phase", async () => {
		const original = console.error;
		console.error = () => {};
		try {
			const cause = new Error("broken");
			const { list, events } = await mount({
				items: [{ id: "a", config: item("a") }],
				actions: () => {
					throw cause;
				},
			});
			expect(events.filter((event) => event.type === "extension-error").map((event) => event.detail)).toEqual([
				{ id: "a", slot: "actions", phase: "render", cause },
			]);
			expect(summaries(rows(list)[0])[0].querySelector(".pie-item-summary__prompt")?.textContent).toBe(
				"Pick one",
			);
		} finally {
			console.error = original;
		}
	});

	test("gives a tag defined after the list its entry through the element's own `entry` setter", async () => {
		const entry: ItemListEntry = { id: "a", config: item("a") };
		const { list } = await mount({ items: [entry], actions: "late-row-actions" });
		const received: unknown[] = [];
		customElements.define(
			"late-row-actions",
			class extends HTMLElement {
				set entry(value: unknown) {
					received.push(value);
				}
			},
		);
		await settle();
		expect(list.querySelector("late-row-actions")).toBeTruthy();
		expect(received).toEqual([entry]);
	});

	test("adopts a function extension's promised handle, updating it with an entry that changed meanwhile", async () => {
		const calls: string[] = [];
		let release: (() => void) | undefined;
		const actions = (entry: ItemListEntry) => {
			calls.push(`render ${entry.name}`);
			return new Promise<{ update(next: ItemListEntry): void; destroy(): void }>((resolve) => {
				release = () =>
					resolve({
						update: (next) => calls.push(`update ${next.name}`),
						destroy: () => calls.push("destroy"),
					});
			});
		};
		const entry: ItemListEntry = { id: "a", config: item("a"), name: "one" };
		const { list } = await mount({ items: [entry], actions });
		list.items = [{ ...entry, name: "two" }];
		await settle();
		expect(calls).toEqual(["render one"]);
		release?.();
		await settle();
		expect(calls).toEqual(["render one", "update two"]);
		list.items = [];
		await settle();
		expect(calls).toEqual(["render one", "update two", "destroy"]);
	});

	test("destroys a promised handle that arrives after its row went away", async () => {
		const calls: string[] = [];
		let release: (() => void) | undefined;
		const actions = () =>
			new Promise<{ destroy(): void }>((resolve) => {
				release = () => resolve({ destroy: () => calls.push("destroy") });
			});
		const { list } = await mount({ items: [{ id: "a", config: item("a") }], actions });
		list.items = [];
		await settle();
		release?.();
		await settle();
		expect(calls).toEqual(["destroy"]);
	});
});
