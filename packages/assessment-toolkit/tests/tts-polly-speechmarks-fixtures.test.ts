import { describe, expect, test } from "bun:test";

import rawSsmlFixture from "./fixtures/math-alignment/polly-raw-ssml-speechmarks.json";
import {
	resolveBoundaryToSpeechToken,
	tokenizeSpeechSource,
} from "../src/services/tts/math-alignment/speech-tokenizer";

describe("Polly speech-mark fixtures", () => {
	test("normalizes captured raw SSML word marks into spoken-token offsets", () => {
		const tokenization = tokenizeSpeechSource({
			speechText: rawSsmlFixture.speechText,
		});

		expect(tokenization.spokenText).toBe(rawSsmlFixture.spokenText);
		for (const mark of rawSsmlFixture.marks) {
			const boundary = resolveBoundaryToSpeechToken({
				tokenization,
				position: mark.start,
				length: mark.end - mark.start,
				boundaryWord: mark.value,
			});

			expect(boundary).toMatchObject({
				token: expect.objectContaining({
					text: mark.value,
					normalized: mark.value.toLowerCase(),
				}),
				confidence: 1,
			});
		}
	});
});
