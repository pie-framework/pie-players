import { describe, expect, test } from "bun:test";
import {
	hasMathContent,
	hasReadableText,
	hasScienceContent,
	hasSpokenContent,
} from "../src/services/tool-context";
import type { ToolContext } from "../src/services/tool-context";

describe("tool-context helpers", () => {
	test("detects math content in item markup", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Solve 3 + 5 = ?</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(true);
	});

	test("does not detect math content in plain text", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Read the passage and answer.</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(false);
	});

	// Both content gates used to answer `true` for essentially every item:
	// `hasMathContent` matched any hyphen or slash, and `hasScienceContent` matched
	// any one- or two-letter capitalised word. They gate `isVisibleInContext` for
	// the calculator, ruler, graph and periodic table, so a gate that cannot say no
	// is not a gate.
	const item = (config: Record<string, unknown>): ToolContext =>
		({
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: { config } as any,
		}) as ToolContext;

	describe("math gate", () => {
		for (const markup of [
			"<div>Solve 3 + 5 = ?</div>",
			"<div>Is 5 &gt; 3? Compare 12 / 4 and 20% of 50.</div>",
			"<div>Evaluate 2^3 and compare with \u03c0.</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(true);
			});
		}

		// Prose that the old bare-operator pattern read as mathematical.
		for (const markup of [
			"<div>This is a well-known, self-evident truth.</div>",
			"<div>Choose the best answer and/or explain why.</div>",
			"<div>Read paragraph 3 and summarize the main idea.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(false);
			});
		}

		// Hyphens and slashes that still read as arithmetic once dates and ranges
		// are ruled out.
		for (const markup of [
			"<div>What is 15 - 7?</div>",
			"<div>What is 1,000 - 250?</div>",
			"<div>Find 12-5 = ?</div>",
			"<div>What is 3 - 5 = ?</div>",
			"<div>Let x = 12-5.</div>",
			"<div>Compute 12 − 5.</div>",
			"<div>Multiply 6 * 7.</div>",
			"<div>Shade 2/3 of the rectangle.</div>",
			"<div>Simplify 1/2 - 1/4.</div>",
			"<div>Divide 12 / 4.</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(true);
			});
		}

		// Dates and ranges that the old arithmetic and fraction patterns read as
		// mathematical, so reading items with a date offered a calculator.
		for (const markup of [
			"<div>The letter is dated 10/10/2026.</div>",
			"<div>The archive filed it under 2026/10/10.</div>",
			"<div>The town met on 2026-10-10 and again on 10-10-2026.</div>",
			"<div>The project ran from 1990-2000.</div>",
			"<div>Lincoln (1809 - 1865) led the nation.</div>",
			"<div>During the 2025-26 school year, the club grew.</div>",
			"<div>Read pages 12 - 15 for homework.</div>",
			"<div>Call 555-1234 for details.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(false);
			});
		}

		// A percentage counts when it is applied to a quantity.
		for (const markup of [
			"<div>What is 20% of 50?</div>",
			"<div>Find 15% of $80.</div>",
			"<div>¿Cuánto es el 20% de 50?</div>",
			"<div>A $40 jacket is on sale for 25% off. What does it cost?</div>",
			"<div>Show that 25% = 0.25.</div>",
			"<div>Is 45% > 40%?</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(true);
			});
		}

		// Statistics in prose, which the old percentage pattern read as
		// mathematical.
		for (const markup of [
			"<div>About 40% of voters stayed home.</div>",
			"<div>Nearly 70% of Earth's surface is water.</div>",
			"<div>Unemployment rose from 5% to 8% in 2009.</div>",
			"<div>Only 12% of the 300 students agreed.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasMathContent(item({ markup }))).toBe(false);
			});
		}

		// The MathML pattern was unreachable: extraction stripped tags before the
		// predicate ran, so an item whose only math signal is the element matched
		// nothing. It is now tested against the markup view.
		test("sees MathML, whose only signal is the tag", () => {
			expect(hasMathContent(item({ markup: "<p><math><mi>x</mi></math></p>" }))).toBe(
				true,
			);
		});
		test("sees MathML inside an element snippet", () => {
			expect(
				hasMathContent(item({ elements: { "pie-x": "<math><mn>2</mn></math>" } })),
			).toBe(true);
		});
		test("sees LaTeX in a model prompt", () => {
			expect(hasMathContent(item({ models: [{ prompt: "Solve \\(x+1\\)" }] }))).toBe(
				true,
			);
		});
	});

	describe("science gate", () => {
		for (const markup of [
			"<div>The periodic table lists every element.</div>",
			"<div>Water is H\u2082O and salt is NaCl.</div>",
			"<div>The formula for carbon dioxide is CO2.</div>",
			"<div>Describe photosynthesis in green plants.</div>",
		]) {
			test(`fires: ${markup.slice(5, 45)}`, () => {
				expect(hasScienceContent(item({ markup }))).toBe(true);
			});
		}

		// Every one of these contains a one- or two-letter capitalised word, which
		// the old element-symbol pattern accepted. A lone symbol is not a formula:
		// "In", "He", "As" and "At" are ordinary English.
		for (const markup of [
			"<div>It was the best of times. In the end, He knew.</div>",
			"<div>No one expected As You Like It to end that way.</div>",
			"<div>At first, In fact, So then \u2014 transitions matter.</div>",
			"<div>Hello, said the man. Nothing happened.</div>",
			"<div>Compare Mercury and Venus in the passage.</div>",
		]) {
			test(`stays quiet: ${markup.slice(5, 45)}`, () => {
				expect(hasScienceContent(item({ markup }))).toBe(false);
			});
		}
	});

	// Each Arabic item is a counterpart of an English case above and has to get the
	// same tools. The shared Arabic fixtures (PIE-1356) do not exist yet; these pairs
	// stand in for them.
	describe("Arabic counterparts", () => {
		const rlm = String.fromCharCode(0x200f);
		const counterparts = (
			gate: (context: ToolContext) => boolean,
			expected: boolean,
			pairs: [english: string, arabic: string][],
		) => {
			for (const [english, arabic] of pairs) {
				test(`${expected ? "fires" : "stays quiet"}: ${english}`, () => {
					expect(gate(item({ markup: `<div>${english}</div>` }))).toBe(expected);
					expect(gate(item({ markup: `<div dir="rtl">${arabic}</div>` }))).toBe(
						expected,
					);
				});
			}
		};

		counterparts(hasMathContent, true, [
			["Solve 3 + 5 = ?", "حل ٣ + ٥ = ؟"],
			["Solve 3 + 5 = ?", `حل ٣${rlm} + ٥ = ؟`],
			["What is 15 - 7?", "ما ناتج ١٥ - ٧؟"],
			["What is 15 - 7?", "ما ناتج ۱۵ - ۷؟"],
			["What is 1,000 - 250?", "ما ناتج ١٬٠٠٠ - ٢٥٠؟"],
			["Shade 2/3 of the rectangle.", "ظلّل ٢/٣ من المستطيل."],
			["What is 20% of 50?", "ما هو ٢٠٪ من ٥٠؟"],
			[
				"A $40 jacket is on sale for 25% off. What does it cost?",
				"سعر سترة ٤٠ ريالًا وعليها خصم ٢٥٪. كم سعرها الآن؟",
			],
			["Show that 25% = 0.25.", "بيّن أن ٢٥٪ = ٠٫٢٥."],
			["Is 45% > 40%?", "هل ٤٥٪ > ٤٠٪؟"],
		]);

		counterparts(hasMathContent, false, [
			["Read the passage and answer.", "اقرأ النص ثم أجب."],
			["The letter is dated 10/10/2026.", "كُتبت الرسالة بتاريخ ١٠/١٠/٢٠٢٦."],
			["Lincoln (1809 - 1865) led the nation.", "قاد لينكولن (١٨٠٩ - ١٨٦٥) البلاد."],
			["About 40% of voters stayed home.", "بقي نحو ٤٠٪ من الناخبين في منازلهم."],
		]);

		counterparts(hasScienceContent, true, [
			["The periodic table lists every element.", "يضم الجدول الدوري جميع العناصر."],
			["Water is H₂O and salt is NaCl.", "الماء H₂O والملح NaCl."],
			["Describe photosynthesis in green plants.", "صف عملية البناء الضوئي في النباتات الخضراء."],
			["Energy is conserved in a closed system.", "الطاقة محفوظة في النظام المغلق."],
		]);

		// بطاقة (card) and بقوة (strongly) carry the stems of energy and force.
		counterparts(hasScienceContent, false, [
			["Hello, said the man. Nothing happened.", "قال الرجل مرحبًا. لم يحدث شيء."],
			["Show your ID card at the door.", "أظهر بطاقة الهوية عند الباب."],
			["The wind blew strongly all night.", "هبّت الرياح بقوة طوال الليل."],
			["Compare Mercury and Venus in the passage.", "قارن بين عطارد والزهرة في النص."],
		]);
	});

	test("detects readable text threshold", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<p>This sentence is long enough for reading tools.</p>",
				},
			} as any,
		};

		expect(hasReadableText(context)).toBe(true);
	});

	test("counts a catalog idref as spoken content when there is no text", () => {
		const withMarkup = (markup: string): ToolContext => ({
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: { config: { markup } } as any,
		});

		expect(
			hasSpokenContent(
				withMarkup(`<img data-catalog-idref="diagram" src="cycle.png" alt="">`),
			),
		).toBe(true);
		expect(hasSpokenContent(withMarkup(`<img src="cycle.png" alt="">`))).toBe(
			false,
		);
		expect(
			hasSpokenContent(
				withMarkup("<p>This sentence is long enough for reading tools.</p>"),
			),
		).toBe(true);
	});
});
