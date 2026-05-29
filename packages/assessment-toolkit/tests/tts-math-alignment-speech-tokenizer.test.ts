import { describe, expect, test } from "bun:test";

import {
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
} from "../src/services/tts/math-alignment/speech-tokenizer";

describe("math alignment speech tokenizer", () => {
	test("maps raw SSML offsets to normalized spoken tokens", () => {
		const speechText =
			'<speak><break time="250ms"/>Hello <emphasis>world</emphasis></speak>';

		const tokenization = tokenizeSpeechSource({ speechText });

		expect(tokenization.spokenText).toBe("Hello world");
		expect(tokenization.boundaryOffsetSpace).toBe("raw-ssml");
		expect(tokenization.tokens.map((token) => token.normalized)).toEqual([
			"hello",
			"world",
		]);
		expect(
			resolveBoundaryToSpeechToken({
				tokenization,
				position: speechText.indexOf("world"),
				length: "world".length,
				boundaryWord: "world",
			}),
		).toMatchObject({
			token: expect.objectContaining({ normalized: "world" }),
			confidence: 1,
		});
	});

	test("uses semantic SSML substitutions only when modeled", () => {
		const speechText =
			'<speak>The request comes from <say-as interpret-as="characters">PTA</say-as> and <sub alias="Doctor">Dr.</sub> Lee.</speak>';

		const tokenization = tokenizeSpeechSource({ speechText });

		expect(tokenization.spokenText).toBe(
			"The request comes from PTA and Doctor Lee.",
		);
		expect(tokenization.unsupportedSemantic).toBe(false);
		expect(tokenization.tokens.map((token) => token.normalized)).toContain("pta");
		expect(tokenization.tokens.map((token) => token.normalized)).toContain(
			"doctor",
		);
	});

	test("rejects control-tag provider marks and unsupported semantic SSML", () => {
		const tokenization = tokenizeSpeechSource({
			speechText: '<speak>Listen <audio src="tone.mp3"/> now.</speak>',
		});

		expect(tokenization.unsupportedSemantic).toBe(true);
		expect(
			resolveBoundaryToSpeechToken({
				tokenization,
				position: tokenization.speechText.indexOf("<audio"),
				length: '<audio src="tone.mp3"/>'.length,
				boundaryWord: '<audio src="tone.mp3"/>',
			}),
		).toBeNull();
	});
});
