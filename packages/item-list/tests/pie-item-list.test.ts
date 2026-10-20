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
	for (const type of ["expanded-change", "player-error"]) {
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
				{ id: "a", config: item("a"), name: "Rivers", version: "2.0.0", passage },
				{ id: "b", config: item("b", "Pick two") },
			],
		});
		const [first, second] = rows(list);
		expect(first.dataset.itemId).toBe("a");
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
		expect(button?.getAttribute("aria-expanded")).toBe("false");
		expect(button?.getAttribute("aria-controls")).toBe(view?.id);
		expect(button?.getAttribute("aria-label")).toBe("Show the full item");
		expect(view?.classList.contains("pie-item-list__view--clipped")).toBe(true);

		button?.click();
		await settle();
		expect(button?.getAttribute("aria-expanded")).toBe("true");
		expect(view?.classList.contains("pie-item-list__view--clipped")).toBe(false);
		expect(summaries(first)[0].expanded).toBe(true);
		expect(summaries(second)[0].expanded).toBe(false);
		expect(first.getAttribute("aria-busy")).toBe("true");
		expect(events).toEqual([{ type: "expanded-change", detail: { id: "a", expanded: true } }]);

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
			expect(events).toEqual([
				{
					type: "player-error",
					detail: { code: "ITEM_SUMMARY_PLAYER_TIMEOUT", message: "late", recoverable: true, id: "a" },
				},
			]);
			expect(reachedDocument).toBe(1);
			expect(row.hasAttribute("aria-busy")).toBe(false);
		} finally {
			document.removeEventListener("player-error", count);
		}
	});

	test("gives a tag-name extension the entry as its `item`, keeping the element as it changes", async () => {
		const first: ItemListEntry = { id: "a", config: item("a"), data: { selected: false } };
		const { list } = await mount({ items: [first], actions: "row-actions" });
		const actions = list.querySelector("row-actions") as HTMLElement & { item?: ItemListEntry };
		expect(actions.item).toBe(first);
		expect(actions.parentElement?.classList.contains("pie-item-list__actions")).toBe(true);

		const changed: ItemListEntry = { ...first, data: { selected: true } };
		list.items = [changed];
		await settle();
		expect(list.querySelector("row-actions")).toBe(actions);
		expect(actions.item).toBe(changed);
	});

	test("runs a function extension once per entry, cleaning up before a change and on removal", async () => {
		const calls: string[] = [];
		const details = (entry: ItemListEntry, host: HTMLElement) => {
			calls.push(`render ${entry.name}`);
			host.textContent = `Selected: ${entry.name}`;
			return () => calls.push(`cleanup ${entry.name}`);
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

	test("renders `highlights` below the summary, outside its clip, only when given", async () => {
		const highlights = (entry: ItemListEntry, host: HTMLElement) => {
			const matches = entry.data as string[] | undefined;
			if (matches) host.textContent = matches.join(" … ");
		};
		const { list } = await mount({
			items: [
				{ id: "a", config: item("a"), data: ["a <em>river</em> runs"] },
				{ id: "b", config: item("b") },
			],
			highlights,
		});
		const [first, second] = rows(list);
		const shown = first.querySelector<HTMLElement>(".pie-item-list__highlights");
		expect(shown?.textContent).toBe("a <em>river</em> runs");
		expect(shown?.previousElementSibling?.classList.contains("pie-item-list__view")).toBe(true);
		expect(second.querySelector(".pie-item-list__highlights")?.childNodes).toHaveLength(0);

		const { list: plain } = await mount({ items: [{ id: "c", config: item("c") }] });
		expect(plain.querySelector(".pie-item-list__highlights")).toBeNull();
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
});
