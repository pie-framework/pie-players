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

const initialized = async (client: unknown) => {
	const provider = googleWithClient(client);
	await provider.initialize({
		projectId: "test",
		credentials: { apiKey: "test" },
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
