import { describe, expect, it } from "vitest";

import { pollyWithClient } from "./fake-polly-client.js";

// Records each request's output format and how many were in flight at once.
const concurrencyRecordingClient = () => {
	const formats: string[] = [];
	let inFlight = 0;
	let maxInFlight = 0;
	const client = {
		send: async (command: { input: { OutputFormat: string } }) => {
			formats.push(command.input.OutputFormat);
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 5));
			inFlight -= 1;
			return command.input.OutputFormat === "json"
				? {
						AudioStream: new TextEncoder().encode(
							JSON.stringify({
								time: 0,
								type: "word",
								start: 0,
								end: 5,
								value: "Hello",
							}),
						),
					}
				: { AudioStream: new Uint8Array([1, 2]), ContentType: "audio/mpeg" };
		},
	};
	return { client, formats, maxInFlight: () => maxInFlight };
};

const initialized = async (client: unknown) => {
	const provider = pollyWithClient(client);
	await provider.initialize({
		region: "us-east-1",
		credentials: { accessKeyId: "test", secretAccessKey: "test" },
	});
	return provider;
};

describe("Polly requests", () => {
	it("requests the audio and the speech marks in parallel", async () => {
		const recorder = concurrencyRecordingClient();
		const provider = await initialized(recorder.client);

		const response = await provider.synthesize({ text: "Hello world" });

		expect(recorder.formats.sort()).toEqual(["json", "mp3"]);
		expect(recorder.maxInFlight()).toBe(2);
		expect([...response.audio]).toEqual([1, 2]);
		expect(response.speechMarks).toMatchObject([
			{ type: "word", start: 0, end: 5, value: "Hello" },
		]);
	});

	it("requests only the audio when speech marks are not wanted", async () => {
		const recorder = concurrencyRecordingClient();
		const provider = await initialized(recorder.client);

		const response = await provider.synthesize({
			text: "Hello world",
			includeSpeechMarks: false,
		});

		expect(recorder.formats).toEqual(["mp3"]);
		expect(response.speechMarks).toEqual([]);
	});
});

// Records the text and text type of each request; answers speech marks with none.
const textRecordingClient = () => {
	const sent: { Text: string; TextType: string }[] = [];
	const client = {
		send: async (command: {
			input: { Text: string; TextType: string; OutputFormat: string };
		}) => {
			const { Text, TextType, OutputFormat } = command.input;
			sent.push({ Text, TextType });
			return OutputFormat === "json"
				? {}
				: { AudioStream: new Uint8Array([1]), ContentType: "audio/mpeg" };
		},
	};
	return { client, sent };
};

const withEngine = async (client: unknown, engine: "neural" | "standard") => {
	const provider = pollyWithClient(client);
	await provider.initialize({
		region: "us-east-1",
		credentials: { accessKeyId: "test", secretAccessKey: "test" },
		engine,
	});
	return provider;
};

describe("Polly pitch", () => {
	it("sends a standard voice the pitch multiplier as a relative percentage", async () => {
		const { client, sent } = textRecordingClient();
		const provider = await withEngine(client, "standard");

		await provider.synthesize({ text: "Hello", pitch: 1.2 });

		expect(sent).toHaveLength(2);
		for (const request of sent) {
			expect(request).toEqual({
				Text: '<speak><prosody pitch="+20%">Hello</prosody></speak>',
				TextType: "ssml",
			});
		}
		expect(provider.getCapabilities().standard.supportsPitch).toBe(true);
	});

	it("drops pitch for a neural voice and keeps rate", async () => {
		const { client, sent } = textRecordingClient();
		const provider = await withEngine(client, "neural");

		await provider.synthesize({
			text: "Hello",
			pitch: 2,
			includeSpeechMarks: false,
		});
		await provider.synthesize({
			text: "Hello",
			pitch: 0,
			rate: 1.5,
			includeSpeechMarks: false,
		});

		expect(sent).toEqual([
			{ Text: "Hello", TextType: "text" },
			{
				Text: '<speak><prosody rate="150%">Hello</prosody></speak>',
				TextType: "ssml",
			},
		]);
		expect(provider.getCapabilities().standard.supportsPitch).toBe(false);
	});

	it("rejects a pitch outside 0 to 2 before calling Polly", async () => {
		const { client, sent } = textRecordingClient();
		const provider = await withEngine(client, "standard");

		await expect(provider.synthesize({ text: "Hello", pitch: 5 })).rejects.toThrow(
			"Pitch must be between 0 and 2",
		);
		expect(sent).toEqual([]);
	});
});
