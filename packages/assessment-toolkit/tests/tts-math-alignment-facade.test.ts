import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	createMathAwareAlignment,
	resolveHighlightTargetForBoundary,
} from "../src/services/tts/math-alignment";

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

describe("math alignment facade", () => {
	test("creates a reusable alignment and resolves provider boundaries", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(
				'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>',
			),
			speechText: "2 times 7",
		});

		const target = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("times"),
			length: "times".length,
			boundaryWord: "times",
		});

		expect(alignment.result.confidence).toBeGreaterThanOrEqual(0.95);
		expect(target).toMatchObject({
			type: "element-range",
			quality: "element-range",
		});
		expect((target as { element: Element }).element.localName).toBe("mo");
	});

	test("returns expression fallback for low-confidence provider boundaries", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(
				'<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>15</mn><mn>8</mn></mfrac></math>',
			),
			speechText: "fifteen eighths",
		});

		const target = resolveHighlightTargetForBoundary(alignment, {
			position: 0,
			length: "fifteen".length,
			boundaryWord: "fifteen",
		});

		expect(alignment.result.segments).toEqual([]);
		expect(target).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
		expect((target as { element: Element }).element.localName).toBe("math");
	});

	test("falls back when provider boundary word contradicts the offset", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(
				'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>',
			),
			speechText: "2 times 7",
		});

		const target = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("times"),
			length: "times".length,
			boundaryWord: "7",
		});

		expect(target).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
		expect((target as { element: Element }).element.localName).toBe("math");
	});

	test("resolves compact quadratic expression components with exponent and implicit multiplication", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(`<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mrow>
					<msup><mi>x</mi><mn>2</mn></msup>
					<mo>-</mo><mn>5</mn><mo>&#x2062;</mo><mi>x</mi>
					<mo>+</mo><mn>6</mn><mo>=</mo><mn>0</mn>
				</mrow>
			</math>`),
			speechText: `<speak><prosody rate="slow">X squared, minus 5 X, plus 6, equals zero?</prosody></speak>`,
		});

		const squaredTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("squared"),
			length: "squared".length,
			boundaryWord: "squared",
		});
		const xAfterFiveTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf(
				"X",
				alignment.speech.spokenText.indexOf("5"),
			),
			length: "X".length,
			boundaryWord: "X",
		});
		const equalsTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("equals"),
			length: "equals".length,
			boundaryWord: "equals",
		});

		expect(alignment.result.confidence).toBeGreaterThanOrEqual(0.95);
		expect(squaredTarget).toMatchObject({
			type: "element-range",
			quality: "element-range",
		});
		expect((squaredTarget as { element: Element }).element.localName).toBe(
			"msup",
		);
		expect((xAfterFiveTarget as { element: Element }).element.localName).toBe(
			"mi",
		);
		expect((equalsTarget as { element: Element }).element.textContent).toBe(
			"=",
		);
	});

	test("falls back to a visible expression target for spoken implicit multiplication", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(
				'<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mn>2</mn><mo>&#x2062;</mo><mn>7</mn></mrow></math>',
			),
			speechText: "2 times 7",
		});

		const target = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("times"),
			length: "times".length,
			boundaryWord: "times",
		});

		expect(target).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
		expect((target as { element: Element }).element.localName).toBe("mrow");
	});

	test("tracks factored expressions when grouping parentheses are not spoken", () => {
		const alignment = createMathAwareAlignment({
			mathElement: mathFrom(`<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mrow>
					<mo>(</mo><mi>x</mi><mo>-</mo><mn>2</mn><mo>)</mo>
					<mo>&#x2062;</mo>
					<mo>(</mo><mi>x</mi><mo>-</mo><mn>3</mn><mo>)</mo>
				</mrow>
			</math>`),
			speechText: "X minus 2, times X minus 3",
		});

		const firstXTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("X"),
			length: "X".length,
			boundaryWord: "X",
		});
		const secondXTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf(
				"X",
				alignment.speech.spokenText.indexOf("times"),
			),
			length: "X".length,
			boundaryWord: "X",
		});
		const threeTarget = resolveHighlightTargetForBoundary(alignment, {
			position: alignment.speech.spokenText.indexOf("3"),
			length: "3".length,
			boundaryWord: "3",
		});

		expect(alignment.result.confidence).toBeGreaterThanOrEqual(0.95);
		expect(firstXTarget).toMatchObject({
			type: "element-range",
			quality: "element-range",
		});
		expect(secondXTarget).toMatchObject({
			type: "element-range",
			quality: "element-range",
		});
		expect((firstXTarget as { element: Element }).element).not.toBe(
			(secondXTarget as { element: Element }).element,
		);
		expect((threeTarget as { element: Element }).element.textContent).toBe("3");
	});
});
