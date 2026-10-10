import { describe, expect, it } from "vitest";

import { googleWithClient } from "./fake-google-client.js";

type SentRequest = {
	input: { text?: string; ssml?: string };
	voice: { name: string };
	enableTimePointing?: unknown[];
};

// Records each request; `rejectMarks` answers a timepointed one as Google does
// for a Studio voice.
const recordingClient = (rejectMarks = false) => {
	const sent: SentRequest[] = [];
	const client = {
		synthesizeSpeech: async (request: SentRequest) => {
			sent.push(request);
			if (rejectMarks && request.enableTimePointing) {
				throw new Error(
					"3 INVALID_ARGUMENT: <mark> is not currently supported for Studio voices.",
				);
			}
			return [{ audioContent: new Uint8Array([1]), timepoints: [] }];
		},
	};
	return { client, sent };
};

const initialized = async (
	client: unknown,
	voiceType?: "wavenet" | "standard" | "studio",
) => {
	const provider = googleWithClient(client);
	await provider.initialize({
		projectId: "test",
		credentials: { apiKey: "test" },
		voiceType,
	});
	return provider;
};

describe("Google Studio voices", () => {
	it("synthesize a Studio voice without marks and answer no speech marks", async () => {
		const { client, sent } = recordingClient();
		const provider = await initialized(client);

		const response = await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Studio-O",
		});

		expect(response.speechMarks).toEqual([]);
		expect(sent).toHaveLength(1);
		expect(sent[0].enableTimePointing).toBeUndefined();
		expect(sent[0].input).toEqual({ text: "Hello world" });
	});

	it("retry without marks when the voice rejects them, answering no speech marks", async () => {
		const { client, sent } = recordingClient(true);
		const provider = await initialized(client);

		const response = await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Neural2-A",
		});

		expect(response.speechMarks).toEqual([]);
		expect([...response.audio]).toEqual([1]);
		expect(sent.map((request) => Boolean(request.enableTimePointing))).toEqual([
			true,
			false,
		]);
		expect(sent[1].input).toEqual({ text: "Hello world" });
	});
});

describe("Google Studio voice pitch", () => {
	it("apply rate and drop pitch for a Studio voice", async () => {
		const { client, sent } = recordingClient();
		const provider = await initialized(client);

		await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Studio-O",
			rate: 1.5,
			pitch: 1.2,
		});
		await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Studio-O",
			pitch: 1.2,
		});

		expect(sent.map((request) => request.input)).toEqual([
			{ ssml: '<speak><prosody rate="150%">Hello world</prosody></speak>' },
			{ text: "Hello world" },
		]);
	});

	it("keep pitch for a voice that is not Studio", async () => {
		const { client, sent } = recordingClient();
		const provider = await initialized(client);

		await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Wavenet-A",
			pitch: 1.2,
			includeSpeechMarks: false,
		});

		expect(sent[0].input).toEqual({
			ssml: '<speak><prosody pitch="+20%">Hello world</prosody></speak>',
		});
	});

	it("drop pitch on the retry after Google rejects marks as a Studio voice", async () => {
		const { client, sent } = recordingClient(true);
		const provider = await initialized(client);

		await provider.synthesize({
			text: "Hello world",
			voice: "en-US-Neural2-A",
			pitch: 1.2,
		});

		expect(sent[0].input.ssml).toContain('<prosody pitch="+20%">');
		expect(sent[1].input).toEqual({ text: "Hello world" });
	});

	it("report pitch support unless the voice type is Studio", async () => {
		const { client } = recordingClient();

		const wavenet = await initialized(client);
		const studio = await initialized(client, "studio");

		expect(wavenet.getCapabilities().standard.supportsPitch).toBe(true);
		expect(studio.getCapabilities().standard.supportsPitch).toBe(false);
	});
});
