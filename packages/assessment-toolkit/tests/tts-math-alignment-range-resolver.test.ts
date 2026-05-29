import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { tokenizeMathML } from "../src/services/tts/math-alignment/mathml-tokenizer";
import { resolveHighlightTargetForBoundary } from "../src/services/tts/math-alignment/range-resolver";
import { alignSpeechToMath } from "../src/services/tts/math-alignment/sequence-aligner";
import {
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
} from "../src/services/tts/math-alignment/speech-tokenizer";

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

const createAlignment = (visibleHtml: string, speechText: string) => {
	const host = document.createElement("div");
	host.innerHTML = visibleHtml;
	const math = host.querySelector("math");
	if (!math) throw new Error("Test markup did not include MathML");
	const speech = tokenizeSpeechSource({ speechText });
	return {
		speech,
		alignment: alignSpeechToMath({
			math: tokenizeMathML(math),
			speech,
		}),
	};
};

describe("math alignment range resolver", () => {
	test("resolves a confident speech boundary to the matched MathML element", () => {
		const { speech, alignment } = createAlignment(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>',
			"2 times 7",
		);
		const boundary = resolveBoundaryToSpeechToken({
			tokenization: speech,
			position: speech.spokenText.indexOf("times"),
			length: "times".length,
			boundaryWord: "times",
		});

		const target = resolveHighlightTargetForBoundary({ alignment, boundary });

		expect(target).toMatchObject({
			type: "element-range",
			quality: "element-range",
		});
		expect((target as { element: Element }).element.localName).toBe("mo");
	});

	test("falls back to the full expression for unknown or low-confidence boundaries", () => {
		const { speech, alignment } = createAlignment(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"><mtable><mtr><mtd><mn>516</mn></mtd></mtr><mtr><mtd><mo>-</mo><mn>277</mn></mtd></mtr></mtable></math>',
			"five hundred sixteen minus two hundred seventy-seven",
		);
		const boundary = resolveBoundaryToSpeechToken({
			tokenization: speech,
			position: speech.spokenText.indexOf("minus"),
			length: "minus".length,
			boundaryWord: "minus",
		});

		const target = resolveHighlightTargetForBoundary({ alignment, boundary });

		expect(target).toMatchObject({
			type: "element-range",
			quality: "region-fallback",
		});
		expect((target as { element: Element }).element.localName).toBe("math");
	});
});
