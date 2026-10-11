import { TTSError, TTSErrorCode } from "@pie-players/tts-server-core";
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

		const rejected = provider.synthesize({ text: "Hello", pitch: 5 });
		await expect(rejected).rejects.toBeInstanceOf(TTSError);
		await expect(rejected).rejects.toMatchObject({
			code: TTSErrorCode.INVALID_REQUEST,
			message: "Pitch must be between 0 and 2",
			providerId: "aws-polly",
		});
		expect(sent).toEqual([]);
	});
});

describe("Polly rate", () => {
	it("sends rates up to 2 as they are and caps faster ones at 200%", async () => {
		const { client, sent } = textRecordingClient();
		const provider = await withEngine(client, "neural");

		for (const rate of [0.25, 2, 2.5, 4]) {
			await provider.synthesize({
				text: "Hello",
				rate,
				includeSpeechMarks: false,
			});
		}

		expect(sent.map((request) => request.Text)).toEqual([
			'<speak><prosody rate="25%">Hello</prosody></speak>',
			'<speak><prosody rate="200%">Hello</prosody></speak>',
			'<speak><prosody rate="200%">Hello</prosody></speak>',
			'<speak><prosody rate="200%">Hello</prosody></speak>',
		]);
	});

	it("rejects a rate outside 0.25 to 4 before calling Polly", async () => {
		const { client, sent } = textRecordingClient();
		const provider = await withEngine(client, "neural");

		const rejected = provider.synthesize({ text: "Hello", rate: 4.5 });
		await expect(rejected).rejects.toBeInstanceOf(TTSError);
		await expect(rejected).rejects.toMatchObject({
			code: TTSErrorCode.INVALID_REQUEST,
			message: "Rate must be between 0.25 and 4.0",
			providerId: "aws-polly",
		});
		expect(sent).toEqual([]);
	});
});

// Records the output format and sample rate of each request.
const sampleRateRecordingClient = () => {
	const sent: { OutputFormat: string; SampleRate?: string }[] = [];
	const client = {
		send: async (command: {
			input: { OutputFormat: string; SampleRate?: string };
		}) => {
			const { OutputFormat, SampleRate } = command.input;
			sent.push({ OutputFormat, SampleRate });
			return OutputFormat === "json"
				? {}
				: { AudioStream: new Uint8Array([1]), ContentType: "audio/pcm" };
		},
	};
	return { client, sent };
};

describe("Polly sample rate", () => {
	it("defaults pcm to 16000 Hz and sends an explicit rate as it is", async () => {
		const { client, sent } = sampleRateRecordingClient();
		const provider = await initialized(client);

		await provider.synthesize({
			text: "Hello",
			format: "pcm",
			includeSpeechMarks: false,
		});
		await provider.synthesize({
			text: "Hello",
			format: "pcm",
			sampleRate: 8000,
			includeSpeechMarks: false,
		});

		expect(sent).toEqual([
			{ OutputFormat: "pcm", SampleRate: "16000" },
			{ OutputFormat: "pcm", SampleRate: "8000" },
		]);
	});

	it("defaults mp3 to 24000 Hz and sends the speech marks request no sample rate", async () => {
		const { client, sent } = sampleRateRecordingClient();
		const provider = await initialized(client);

		await provider.synthesize({ text: "Hello" });

		expect(sent).toHaveLength(2);
		expect(sent).toContainEqual({ OutputFormat: "mp3", SampleRate: "24000" });
		expect(sent).toContainEqual({ OutputFormat: "json", SampleRate: undefined });
	});
});
