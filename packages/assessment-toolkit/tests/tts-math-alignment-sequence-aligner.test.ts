import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import smartBuildFixtures from "./fixtures/math-alignment/smartbuild-core.json";
import { alignSpeechToMath } from "../src/services/tts/math-alignment/sequence-aligner";
import { tokenizeMathML } from "../src/services/tts/math-alignment/mathml-tokenizer";
import { tokenizeSpeechSource } from "../src/services/tts/math-alignment/speech-tokenizer";

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

const align = (visibleHtml: string, speechText: string) =>
	alignSpeechToMath({
		math: tokenizeMathML(mathFrom(visibleHtml)),
		speech: tokenizeSpeechSource({ speechText }),
	});

describe("math alignment sequence aligner", () => {
	test("emits word targets only for very high-confidence monotonic matches", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>',
			"2 times 7",
		);

		expect(result.confidence).toBeGreaterThanOrEqual(0.95);
		expect(result.segments.map((segment) => segment.target.quality)).toEqual([
			"element-range",
			"element-range",
			"element-range",
		]);
		expect(result.segments.map((segment) => segment.mathTokenIds.length)).toEqual([
			1, 1, 1,
		]);
	});

	test("falls back to the expression target for low-confidence stacked arithmetic", () => {
		const fixture = smartBuildFixtures.find(
			(candidate) => candidate.id === "stacked-multiplication",
		);
		if (!fixture) throw new Error("Missing stacked multiplication fixture");

		const result = align(fixture.visibleHtml, fixture.speechText);

		expect(result.confidence).toBeLessThan(0.95);
		expect(result.segments).toEqual([]);
		expect(result.fallbackTarget).toMatchObject({
			type: "element-range",
			quality: fixture.expectedTargetQuality,
		});
	});

	test("can return a confident expression-level target without word tracking", () => {
		const fixture = smartBuildFixtures.find(
			(candidate) => candidate.id === "absolute-value",
		);
		if (!fixture) throw new Error("Missing absolute value fixture");

		const result = align(fixture.visibleHtml, fixture.speechText);

		expect(result.confidence).toBeLessThan(0.95);
		expect(result.segments).toEqual([]);
		expect(result.fallbackTarget).toMatchObject({
			type: "element-range",
			quality: fixture.expectedTargetQuality,
		});
	});

	test("matches a multi-word operator alias spoken across several tokens", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>15</mn><mn>8</mn></mfrac></math>',
			"15 divided by 8",
		);

		expect(result.confidence).toBeGreaterThanOrEqual(0.95);
		// The "/" (fraction) segment claims both "divided" and "by", so a boundary
		// on either spoken word resolves to the same fraction glyph.
		const fractionSegment = result.segments.find(
			(segment) => segment.speechTokenIds.length === 2,
		);
		expect(fractionSegment).toBeDefined();
		expect(fractionSegment?.target).toMatchObject({ quality: "element-range" });
	});

	test("matches a five-word comparison alias (≤)", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>3</mn><mo>&#8804;</mo><mn>5</mn></math>',
			"3 less than or equal to 5",
		);

		expect(result.confidence).toBeGreaterThanOrEqual(0.95);
		expect(
			result.segments.some((segment) => segment.speechTokenIds.length === 5),
		).toBe(true);
	});

	test("tracks a cubed exponent generically (not just squared)", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>3</mn></msup></math>',
			"x cubed",
		);

		expect(result.confidence).toBeGreaterThanOrEqual(0.95);
	});

	test("treats invisible function application as optional, not a required token", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>a</mi><mo>&#x2061;</mo><mi>b</mi></math>',
			"a b",
		);

		// The invisible operator is unspoken; it must not force a coarse fallback.
		expect(result.confidence).toBeGreaterThanOrEqual(0.95);
	});

	test("falls back to the expression for radicals instead of guessing per glyph", () => {
		const result = align(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mn>9</mn></msqrt></math>',
			"the square root of 9",
		);

		expect(result.confidence).toBeLessThan(0.95);
		expect(result.segments).toEqual([]);
		expect(result.fallbackTarget).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
	});
});
