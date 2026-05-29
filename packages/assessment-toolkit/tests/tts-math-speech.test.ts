import { describe, expect, test } from "bun:test";

import { resolveMathSpeechFromChunks } from "../src/services/tts/math-speech";
import type { MathAwareSpeechChunk } from "../src/services/tts/math-aware-text-processing";

const chunks: MathAwareSpeechChunk[] = [
	{ type: "text", text: "Solve" },
	{
		type: "math",
		mathml: "<math><msup><mi>x</mi><mn>2</mn></msup></math>",
		fallbackText: "x 2",
	},
	{ type: "text", text: "now." },
];

describe("TTS math speech generation", () => {
	test("loads SRE lazily and converts MathML chunks to natural language", async () => {
		const setupCalls: Record<string, unknown>[] = [];
		let loadCalls = 0;

		const result = await resolveMathSpeechFromChunks(chunks, {
			language: "en-US",
			loadSre: async () => {
				loadCalls += 1;
				return {
					setupEngine: async (options: Record<string, unknown>) => {
						setupCalls.push(options);
					},
					engineReady: async () => {},
					toSpeech: (mathml: string) =>
						mathml.includes("<msup>") ? "x squared" : "unknown math",
				};
			},
		});

		expect(loadCalls).toBe(1);
		expect(setupCalls[0]).toMatchObject({
			locale: "en",
			domain: "clearspeak",
			modality: "speech",
			markup: "none",
		});
		expect(result).toEqual({
			speechText: "Solve X squared now.",
			usedMathSpeech: true,
			usedFallback: false,
		});
	});

	test("normalizes isolated math variables to letter pronunciation", async () => {
		const result = await resolveMathSpeechFromChunks(
			[
				{
					type: "math",
					mathml:
						"<math><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></math>",
					fallbackText: "b 2 - 4 a c",
				},
			],
			{
				language: "en-US",
				loadSre: async () => ({
					setupEngine: async () => {},
					engineReady: async () => {},
					toSpeech: () => "b squared minus 4 a c",
				}),
			},
		);

		expect(result.speechText).toBe("B squared minus 4 A C");
	});

	test("does not load SRE when there are no math chunks", async () => {
		const result = await resolveMathSpeechFromChunks(
			[{ type: "text", text: "Plain text only." }],
			{
				loadSre: async () => {
					throw new Error("SRE should not load");
				},
			},
		);

		expect(result).toEqual({
			speechText: "Plain text only.",
			usedMathSpeech: false,
			usedFallback: false,
		});
	});

	test("falls back to visible math text when SRE conversion fails", async () => {
		const result = await resolveMathSpeechFromChunks(chunks, {
			language: "en-US",
			loadSre: async () => ({
				setupEngine: async () => {},
				engineReady: async () => {},
				toSpeech: () => {
					throw new Error("SRE conversion failed");
				},
			}),
		});

		expect(result).toEqual({
			speechText: "Solve x 2 now.",
			usedMathSpeech: false,
			usedFallback: true,
		});
	});
});
