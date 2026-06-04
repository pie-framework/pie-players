import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { tokenizeMathML } from "../src/services/tts/math-alignment/mathml-tokenizer";

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

const mathFrom = (markup: string): Element => {
	const host = document.createElement("div");
	host.innerHTML = markup;
	const math = host.querySelector("math");
	if (!math) throw new Error("Test markup did not include MathML");
	return math;
};

describe("MathML alignment tokenizer", () => {
	test("returns semantic tokens with DOM provenance and expression fallback", () => {
		const math = mathFrom(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mfrac><mn>15</mn><mn>8</mn></mfrac>
				<mo>&#215;</mo>
				<mfrac><mn>5</mn><mn>3</mn></mfrac>
			</math>
		`);

		const result = tokenizeMathML(math);

		expect(result.expressionTarget).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
		expect(result.tokens.map((token) => token.normalized)).toEqual([
			"15",
			"/",
			"8",
			"×",
			"5",
			"/",
			"3",
		]);
		expect(
			result.tokens.find((token) => token.normalized === "/"),
		).toMatchObject({
			kind: "structure",
			role: "fraction",
			spokenAliases: expect.arrayContaining(["over", "divided by"]),
			target: {
				type: "element-range",
				quality: "element-range",
			},
		});
		expect(result.tokens.every((token) => token.sourceElement)).toBe(true);
	});

	test("downgrades stacked arithmetic to row-level targets instead of fake words", () => {
		const math = mathFrom(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mtable columnalign="right">
					<mtr><mtd><mn>516</mn></mtd></mtr>
					<mtr><mtd><mo>&#8722;</mo><mn>277</mn></mtd></mtr>
				</mtable>
			</math>
		`);

		const result = tokenizeMathML(math);

		expect(result.tokens.map((token) => token.normalized)).toEqual([
			"516",
			"-",
			"277",
		]);
		expect(result.layoutTargets).toContainEqual(
			expect.objectContaining({
				kind: "layout",
				role: "table-row",
				normalized: "row-2",
				target: expect.objectContaining({
					type: "element-range",
					quality: "region-fallback",
				}),
			}),
		);
	});

	test("normalizes mfenced and geometry operators with aliases", () => {
		const math = mathFrom(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mo>&#8736;</mo><mi>K</mi><mi>G</mi><mi>S</mi>
				<mo>=</mo>
				<mfenced open="|" close="|"><mrow><mo>-</mo><mn>5</mn></mrow></mfenced>
			</math>
		`);

		const result = tokenizeMathML(math);

		expect(result.tokens.map((token) => token.normalized)).toContain("∠");
		expect(result.tokens.map((token) => token.normalized)).toContain("|");
		expect(
			result.tokens.find((token) => token.normalized === "∠"),
		).toMatchObject({
			spokenAliases: expect.arrayContaining(["angle"]),
		});
		expect(
			result.tokens.find((token) => token.normalized === "|"),
		).toMatchObject({
			spokenAliases: expect.arrayContaining(["absolute value"]),
		});
	});
});
