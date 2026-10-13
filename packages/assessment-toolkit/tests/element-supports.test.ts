import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { elementSupports } from "../src/services/tool-context";
import type { ToolContext } from "../src/services/tool-context";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

function itemContext(config: Record<string, unknown>): ToolContext {
	return {
		level: "item",
		assessment: {} as any,
		itemRef: {} as any,
		item: { config } as any,
	};
}

function define(tag: string, pieSupports?: unknown): void {
	class Element extends HTMLElement {}
	if (pieSupports !== undefined) {
		Object.defineProperty(Element, "pieSupports", { value: pieSupports });
	}
	customElements.define(tag, Element);
}

describe("elementSupports", () => {
	test("reads the terms an element's class declares", () => {
		define("supports-declaring-choice", ["answer-masking"]);

		expect(
			elementSupports(
				itemContext({
					models: [{ id: "q1", element: "supports-declaring-choice" }],
				}),
			),
		).toEqual([
			{
				elementId: "q1",
				tag: "supports-declaring-choice",
				packageSpec: undefined,
				supports: ["answer-masking"],
				pendingTags: [],
			},
		]);
	});

	test("an element that declares nothing has no supports, and an empty list is a declaration", () => {
		define("supports-silent-element");
		define("supports-declares-none", []);

		const [silent, none] = elementSupports(
			itemContext({
				models: [
					{ id: "q1", element: "supports-silent-element" },
					{ id: "q2", element: "supports-declares-none" },
				],
			}),
		);
		expect(silent?.supports).toBeUndefined();
		expect(silent?.pendingTags).toEqual([]);
		expect(none?.supports).toEqual([]);
	});

	test("keeps only string terms", () => {
		define("supports-mixed-terms", ["answer-masking", 3, null]);

		expect(
			elementSupports(
				itemContext({ models: [{ element: "supports-mixed-terms" }] }),
			)[0]?.supports,
		).toEqual(["answer-masking"]);
	});

	test("a declaration that throws reads as none declared", () => {
		class Throwing extends HTMLElement {
			static get pieSupports(): string[] {
				throw new Error("boom");
			}
		}
		customElements.define("supports-throwing", Throwing);

		expect(
			elementSupports(
				itemContext({ models: [{ element: "supports-throwing" }] }),
			)[0]?.supports,
		).toBeUndefined();
	});

	test("reads the class under the versioned tag the player defines", () => {
		define("supports-versioned--version-2-1-0", ["answer-masking"]);

		const [entry] = elementSupports(
			itemContext({
				elements: { "supports-versioned": "@acme/supports-versioned@2.1.0" },
				models: [{ id: "q1", element: "supports-versioned" }],
			}),
		);
		expect(entry?.packageSpec).toBe("@acme/supports-versioned@2.1.0");
		expect(entry?.supports).toEqual(["answer-masking"]);
	});

	test("an undefined element is pending on every tag it can be defined under", () => {
		const [entry] = elementSupports(
			itemContext({
				elements: { "supports-late": "@acme/supports-late@1.0.0" },
				models: [{ id: "q1", element: "supports-late" }],
			}),
		);
		expect(entry?.supports).toBeUndefined();
		expect(entry?.pendingTags).toEqual([
			"supports-late--version-1-0-0",
			"supports-late",
		]);

		define("supports-late--version-1-0-0", ["answer-masking"]);
		const [defined] = elementSupports(
			itemContext({
				elements: { "supports-late": "@acme/supports-late@1.0.0" },
				models: [{ id: "q1", element: "supports-late" }],
			}),
		);
		expect(defined?.supports).toEqual(["answer-masking"]);
		expect(defined?.pendingTags).toEqual([]);
	});

	test("an element context reads only its own element", () => {
		define("supports-own-a", ["answer-masking"]);
		define("supports-own-b", []);
		const item = {
			config: {
				models: [
					{ id: "a", element: "supports-own-a" },
					{ id: "b", element: "supports-own-b" },
				],
			},
		} as any;

		const entries = elementSupports({
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item,
			elementId: "b",
		} as ToolContext);
		expect(entries.map((entry) => entry.elementId)).toEqual(["b"]);
		expect(entries[0]?.supports).toEqual([]);
	});

	test("skips models that name no element, and reads object-keyed models", () => {
		define("supports-keyed", ["answer-masking"]);

		const entries = elementSupports(
			itemContext({
				models: {
					q1: { id: "q1", element: "supports-keyed" },
					q2: { id: "q2", choices: [{ value: "a" }] },
				},
			}),
		);
		expect(entries.map((entry) => entry.elementId)).toEqual(["q1"]);
	});

	test("contexts above item level have no elements", () => {
		expect(
			elementSupports({ level: "section", assessment: {} as any } as ToolContext),
		).toEqual([]);
	});
});
