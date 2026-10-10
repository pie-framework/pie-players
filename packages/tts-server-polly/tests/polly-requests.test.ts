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
