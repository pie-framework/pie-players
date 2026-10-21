/**
 * `<pie-item-summary>` mounted in happy-dom: what a host sees for a config, a precomputed summary
 * and each role. DOMPurify does not sanitize under happy-dom, so what the sanitizer strips is
 * asserted in a real browser by `e2e/pie-item-summary.spec.ts`.
 */

import "./support/dom.js";
import { afterEach, describe, expect, test } from "bun:test";
import type { ElementSummary } from "@pie-element/shared-types";
import { createPieI18n } from "@pie-players/pie-players-shared/i18n";
import type { PieContent } from "@pie-players/pie-players-shared/types";
import type { ItemSummary, PieItemSummaryElement } from "../src/pie-item-list.js";

await import("../src/components/PieItemSummary.svelte");

async function settle(rounds = 20): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

interface Mounted {
	element: HTMLElement & PieItemSummaryElement;
	loads: unknown[];
}

async function mount(props: Partial<PieItemSummaryElement>): Promise<Mounted> {
	const element = document.createElement("pie-item-summary") as HTMLElement &
		PieItemSummaryElement;
	const loads: unknown[] = [];
	element.addEventListener("load-complete", (event) => {
		loads.push((event as CustomEvent).detail);
	});
	Object.assign(element, props);
	document.body.append(element);
	await settle();
	return { element, loads };
}

const graded: ElementSummary = {
	prompt: "<p>Pick one</p>",
	options: [
		{ id: "a", label: "<b>Four</b>", correct: true },
		{ id: "b", label: "Five" },
	],
	answer: "<p>Four</p>",
};

const config: PieContent = {
	id: "item",
	elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
	models: [{ id: "1", element: "multiple-choice", prompt: "<p>Model prompt</p>" }],
	markup: '<p>What is \\(2 + 2\\)?</p><multiple-choice id="1"></multiple-choice>',
};

const precomputed: ItemSummary = {
	schema: 1,
	entries: [
		{
			id: "1",
			pkg: "@pie-element/multiple-choice",
			source: "summary",
			label: "Multiple choice",
			summary: graded,
		},
	],
};

afterEach(() => {
	document.body.innerHTML = "";
});

describe("<pie-item-summary>", () => {
	test("renders a resolved summary for an instructor, then announces it", async () => {
		const { element, loads } = await mount({
			config,
			resolve: async () => () => graded,
		});
		const prompt = element.querySelector(".pie-item-summary__prompt");
		expect(prompt?.textContent).toContain("Pick one");
		const options = [...element.querySelectorAll(".pie-item-summary__option")];
		expect(options.map((option) => option.textContent?.trim())).toEqual([
			"✓ Correct answer Four",
			"Five",
		]);
		expect(element.querySelector(".pie-item-summary__answer-label")?.textContent).toBe("Answer");
		expect(loads).toEqual([{ view: "summary" }]);
	});

	test("renders the stem's math as MathML", async () => {
		const { element } = await mount({ config });
		const stem = element.querySelector(".pie-item-summary__stem");
		expect(stem?.querySelector("math")).not.toBeNull();
		expect(stem?.textContent).not.toContain("\\(");
		expect(element.querySelector(".pie-item-summary__entry")?.getAttribute("data-source")).toBe(
			"summary",
		);
	});

	test("withholds answers from a precomputed summary for a student", async () => {
		const { element } = await mount({
			summary: precomputed,
			env: { mode: "view", role: "student" },
		});
		expect(element.querySelectorAll(".pie-item-summary__option")).toHaveLength(2);
		expect(element.querySelector(".pie-item-summary__marker")).toBeNull();
		expect(element.querySelector(".pie-item-summary__answer")).toBeNull();
	});

	test("recomputes from the config when the summary has another schema", async () => {
		const { element } = await mount({
			config,
			summary: { ...precomputed, schema: 2 } as unknown as ItemSummary,
		});
		expect(element.querySelector(".pie-item-summary__entry .pie-item-summary__prompt")?.textContent).toBe(
			"Model prompt",
		);
	});

	test("recomputes from the config when a schema-1 summary is malformed", async () => {
		const { element } = await mount({
			config,
			summary: {
				schema: 1,
				entries: [{ ...precomputed.entries[0], summary: { options: [{ id: "a" }] } }],
			} as unknown as ItemSummary,
		});
		expect(element.querySelector(".pie-item-summary__entry .pie-item-summary__prompt")?.textContent).toBe(
			"Model prompt",
		);
	});

	test("does not re-render or re-announce for a new env with the same role", async () => {
		let calls = 0;
		const { element, loads } = await mount({
			config,
			env: { mode: "view", role: "instructor" },
			resolve: async () => {
				calls += 1;
				return () => graded;
			},
		});
		element.env = { mode: "view", role: "instructor" };
		await settle();
		expect(calls).toBe(1);
		expect(loads).toEqual([{ view: "summary" }]);

		element.env = { mode: "view", role: "student" };
		await settle();
		expect(calls).toBe(2);
		expect(loads).toEqual([{ view: "summary" }, { view: "summary" }]);
		expect(element.querySelector(".pie-item-summary__answer")).toBeNull();
	});

	test("does not re-summarize for an equal config object, and does for a changed one", async () => {
		let calls = 0;
		const { element, loads } = await mount({
			config,
			resolve: async () => {
				calls += 1;
				return () => graded;
			},
		});
		element.config = structuredClone(config);
		await settle();
		expect(calls).toBe(1);
		expect(loads).toEqual([{ view: "summary" }]);

		element.config = { ...config, markup: "<p>Changed</p><multiple-choice id=\"1\"></multiple-choice>" };
		await settle();
		expect(calls).toBe(2);
		expect(element.querySelector(".pie-item-summary__stem")?.textContent).toBe("Changed");
	});

	test("lists grouped options under their group, in order of first appearance", async () => {
		const { element } = await mount({
			config,
			resolve: async () => () => ({
				options: [
					{ id: "a", label: "Cat", group: "<b>Mammals</b>", correct: true },
					{ id: "b", label: "Trout", group: "Fish" },
					{ id: "c", label: "Dog", group: "<b>Mammals</b>" },
				],
			}),
		});
		const groups = [...element.querySelectorAll(".pie-item-summary__group")];
		expect(groups.map((group) => group.querySelector(".pie-item-summary__group-label")?.textContent)).toEqual([
			"Mammals",
			"Fish",
		]);
		expect(
			groups.map((group) =>
				[...group.querySelectorAll(".pie-item-summary__option-label")].map((label) => label.textContent),
			),
		).toEqual([["Cat", "Dog"], ["Trout"]]);
	});

	test("labels its text through a supplied provider, keeping its owner's locale", async () => {
		const i18n = createPieI18n();
		await i18n.setLocale("nl-NL");
		const { element } = await mount({ summary: precomputed, i18n });
		expect(i18n.getLocale()).toBe("nl-NL");
		expect(element.querySelector(".pie-item-summary__answer-label")?.textContent).toBe("Antwoord");
	});

	test("labels its own text in the requested locale", async () => {
		const { element } = await mount({ summary: precomputed, locale: "nl-NL" });
		expect(element.querySelector(".pie-item-summary__answer-label")?.textContent).toBe(
			"Antwoord",
		);
	});

	test("withholds answers for any role but instructor, and shows them without an env", async () => {
		const { element } = await mount({ summary: precomputed });
		expect(element.querySelector(".pie-item-summary__answer")).not.toBeNull();
		for (const env of [{ mode: "view", role: "scorer" }, { mode: "view" }]) {
			element.env = env as unknown as PieItemSummaryElement["env"];
			await settle();
			expect(element.querySelector(".pie-item-summary__marker")).toBeNull();
			expect(element.querySelector(".pie-item-summary__answer")).toBeNull();
		}
	});

	test("renders entries and options that repeat an id", async () => {
		const repeated: ItemSummary = {
			schema: 1,
			entries: [
				precomputed.entries[0],
				{ ...precomputed.entries[0], summary: { options: [{ id: "a", label: "Six" }, { id: "a", label: "Seven" }] } },
			],
		};
		const { element } = await mount({ summary: repeated });
		expect(element.querySelectorAll(".pie-item-summary__entry")).toHaveLength(2);
		expect(
			[...element.querySelectorAll(".pie-item-summary__option-label")].map((label) => label.textContent),
		).toEqual(["Four", "Five", "Six", "Seven"]);
	});

	test("drops the previous summary when the next one fails to render", async () => {
		const original = console.error;
		console.error = () => {};
		try {
			const { element } = await mount({ summary: precomputed });
			expect(element.querySelector(".pie-item-summary__prompt")).not.toBeNull();
			element.summary = undefined;
			element.config = {
				get elements(): never {
					throw new Error("broken");
				},
			} as unknown as PieContent;
			await settle();
			expect(element.querySelector(".pie-item-summary__prompt")).toBeNull();
		} finally {
			console.error = original;
		}
	});
});
