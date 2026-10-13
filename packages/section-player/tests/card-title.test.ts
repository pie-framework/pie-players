import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveCardTitle } from "../src/components/shared/card-title.js";
import type {
	SectionPlayerCardTitleContext,
	SectionPlayerCardTitleFormatter,
} from "../src/contracts/card-title-formatters.js";

const itemContext: SectionPlayerCardTitleContext = {
	kind: "item",
	item: { id: "item-1" } as any,
	itemIndex: 0,
	itemCount: 2,
	canonicalItemId: "item-1",
	defaultTitle: "Question 1",
};

const passageContext: SectionPlayerCardTitleContext = {
	kind: "passage",
	passage: { id: "passage-1" } as any,
	defaultTitle: "Passage",
};

const formatterReturning =
	(value: unknown): SectionPlayerCardTitleFormatter =>
	() =>
		value as ReturnType<SectionPlayerCardTitleFormatter>;

describe("resolveCardTitle", () => {
	test("shows the default title without a formatter", () => {
		expect(resolveCardTitle(undefined, itemContext)).toEqual({
			text: "Question 1",
			visible: true,
		});
		expect(resolveCardTitle(null, passageContext)).toEqual({
			text: "Passage",
			visible: true,
		});
	});

	test("shows a formatter's string, trimmed", () => {
		expect(
			resolveCardTitle(formatterReturning("  Item A  "), itemContext),
		).toEqual({ text: "Item A", visible: true });
	});

	test("passes the card context to the formatter", () => {
		const seen: SectionPlayerCardTitleContext[] = [];
		resolveCardTitle((context) => {
			seen.push(context);
			return null;
		}, passageContext);
		expect(seen).toEqual([passageContext]);
	});

	// Host A numbers questions through the formatter and returns "" when it
	// lacks the data, so these must keep the default title showing.
	for (const [label, value] of [
		["an empty string", ""],
		["a whitespace-only string", " \t\n "],
		["null", null],
		["undefined", undefined],
		["a number", 3],
		["an object without visible", {}],
		["{ visible: true }", { visible: true }],
		["{ visible: 'false' }", { visible: "false" }],
	] as const) {
		test(`falls back to the default title for ${label}`, () => {
			expect(resolveCardTitle(formatterReturning(value), itemContext)).toEqual(
				{ text: "Question 1", visible: true },
			);
		});
	}

	test("falls back to the default title when the formatter throws", () => {
		expect(
			resolveCardTitle(() => {
				throw new Error("no section data");
			}, itemContext),
		).toEqual({ text: "Question 1", visible: true });
	});

	test("hides the title on { visible: false }, keeping the default text", () => {
		expect(
			resolveCardTitle(formatterReturning({ visible: false }), itemContext),
		).toEqual({ text: "Question 1", visible: false });
		expect(
			resolveCardTitle(formatterReturning({ visible: false }), passageContext),
		).toEqual({ text: "Passage", visible: false });
	});
});

/**
 * Both cards render the resolved title the same way: the hidden marker sits on
 * the heading, and the rule it selects takes the heading out of the layout
 * without removing it.
 */
const CARDS = [
	"../src/components/shared/SectionItemCard.svelte",
	"../src/components/shared/SectionPassageCard.svelte",
];

describe("cards render a hidden title as a visually hidden heading", () => {
	for (const relPath of CARDS) {
		const source = readFileSync(resolve(import.meta.dir, relPath), "utf8");
		const name = relPath.split("/").pop();
		const declarations = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\s+/g, "");

		test(`${name} resolves its title through resolveCardTitle`, () => {
			expect(source).toContain("resolveCardTitle(effectiveCardTitleFormatter");
		});

		test(`${name} marks the heading when the title is hidden`, () => {
			expect(source).toContain(
				'data-pie-card-title={headerTitle.visible ? undefined : "hidden"}',
			);
			expect(source).toContain(">{headerTitle.text}</svelte:element>");
		});

		test(`${name} hides the marked heading visually`, () => {
			const selector =
				'.pie-section-player-content-card-header:is(h1,h2,h3,h4,h5,h6)[data-pie-card-title="hidden"]{';
			const start = declarations.indexOf(selector);
			expect(start).toBeGreaterThan(-1);
			const rule = declarations.slice(
				start + selector.length,
				declarations.indexOf("}", start),
			);
			expect(rule).toContain("position:absolute;");
			expect(rule).toContain("width:1px;");
			expect(rule).toContain("height:1px;");
			expect(rule).toContain("overflow:hidden;");
			expect(rule).toContain("clip:rect(0,0,0,0);");
			expect(rule).not.toContain("display:none");
			expect(rule).not.toContain("visibility:hidden");
		});
	}
});
