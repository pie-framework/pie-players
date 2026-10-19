/**
 * `<pie-item-summary>` mounted in happy-dom: what a host sees for a config, a precomputed summary
 * and each role. DOMPurify does not sanitize under happy-dom, so what the sanitizer strips is
 * asserted in a real browser by `e2e/pie-item-summary.spec.ts`.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import type { ElementSummary } from "@pie-element/shared-types";
import type { PieContent } from "@pie-players/pie-players-shared/types";
import type { ItemSummary, PieItemSummaryElement } from "../src/pie-item-list.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
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

afterAll(async () => {
	if (ownsDom) await GlobalRegistrator.unregister();
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
			"prompt",
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

	test("labels its own text in the requested locale", async () => {
		const { element } = await mount({ summary: precomputed, locale: "nl-NL" });
		expect(element.querySelector(".pie-item-summary__answer-label")?.textContent).toBe(
			"Antwoord",
		);
	});
});
