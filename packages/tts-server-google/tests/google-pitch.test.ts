import { describe, expect, it } from "vitest";

import { googleWithClient } from "./fake-google-client.js";

type SentInput = { text?: string; ssml?: string };

// Records the input of each request and answers it without timepoints.
const recordingProvider = async () => {
	const sent: SentInput[] = [];
	const provider = googleWithClient({
		synthesizeSpeech: async (request: { input: SentInput }) => {
			sent.push(request.input);
			return [{ audioContent: new Uint8Array([1]), timepoints: [] }];
		},
	});
	await provider.initialize({ projectId: "test", credentials: { apiKey: "test" } });
	return { provider, sent };
};

describe("Google pitch", () => {
	it("sends the pitch multiplier as a relative percentage with speech marks", async () => {
		const { provider, sent } = await recordingProvider();

		await provider.synthesize({
			text: "Hello",
			voice: "en-US-Wavenet-A",
			pitch: 2,
		});

		expect(sent).toEqual([
			{
				ssml: '<speak><prosody pitch="+100%"><mark name="w0"/>Hello</prosody></speak>',
			},
		]);
	});

	it("sends the pitch multiplier as a relative percentage without speech marks", async () => {
		const { provider, sent } = await recordingProvider();

		await provider.synthesize({
			text: "Hello",
			voice: "en-US-Wavenet-A",
			pitch: 0,
			includeSpeechMarks: false,
		});

		expect(sent).toEqual([
			{ ssml: '<speak><prosody pitch="-100%">Hello</prosody></speak>' },
		]);
	});

	it("rejects a pitch outside 0 to 2 before calling Google", async () => {
		const { provider, sent } = await recordingProvider();

		await expect(
			provider.synthesize({ text: "Hello", voice: "en-US-Wavenet-A", pitch: -5 }),
		).rejects.toThrow("Pitch must be between 0 and 2");
		expect(sent).toEqual([]);
	});
});
