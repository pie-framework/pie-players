import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ServerTTSProvider } from "@pie-players/tts-client-server";

import {
	buildRuntimeTTSConfig,
	resolveTTSRuntimeSettings,
} from "../src/services/tts-runtime-config";

const API_ENDPOINT = "https://tts.example.test/synthesize";
const MARKS_URL = "https://cdn.example.test/marks.jsonl";
const AUDIO_URL = "https://cdn.example.test/audio.mp3";

type RecordedRequest = { url: string; headers: Record<string, string> };

class PlayingAudio {
	onplay: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onpause: (() => void) | null = null;
	volume = 1;
	constructor(public src: string) {}
	play(): Promise<void> {
		queueMicrotask(() => {
			this.onplay?.();
			this.onended?.();
		});
		return Promise.resolve();
	}
	pause(): void {}
}

const originalFetch = globalThis.fetch;
const originalAudio = (globalThis as { Audio?: unknown }).Audio;
let requests: RecordedRequest[] = [];

beforeEach(() => {
	requests = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		requests.push({
			url,
			headers: { ...((init?.headers as Record<string, string>) || {}) },
		});
		if (url === API_ENDPOINT) {
			return Response.json({ audioContent: AUDIO_URL, word: MARKS_URL });
		}
		if (url === MARKS_URL) {
			return new Response(
				'{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}\n',
			);
		}
		if (url === AUDIO_URL) {
			return new Response(new Blob(["audio"], { type: "audio/mpeg" }));
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	(globalThis as { Audio?: unknown }).Audio = PlayingAudio;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	(globalThis as { Audio?: unknown }).Audio = originalAudio;
});

const speakWithSettings = async (settings: Record<string, unknown>) => {
	const config = buildRuntimeTTSConfig(
		resolveTTSRuntimeSettings({
			backend: "server",
			serverProvider: "custom",
			transportMode: "custom",
			endpointMode: "rootPost",
			endpointValidationMode: "none",
			apiEndpoint: API_ENDPOINT,
			includeAuthOnAssetFetch: true,
			headers: { Authorization: "Bearer host-token", "X-Tenant": "district-7" },
			...settings,
		}),
	);
	const implementation = await new ServerTTSProvider().initialize(config);
	await implementation.speak("Hello");
	return {
		synthesis: requests.find((request) => request.url === API_ENDPOINT),
		marks: requests.find((request) => request.url === MARKS_URL),
	};
};

describe("runtime TTS config reaching ServerTTSProvider", () => {
	test("sends host headers with the synthesis request", async () => {
		const { synthesis } = await speakWithSettings({});

		expect(synthesis?.headers).toMatchObject({
			Authorization: "Bearer host-token",
			"X-Tenant": "district-7",
		});
	});

	test("trusts the configured asset origins with the authorization header", async () => {
		const { marks } = await speakWithSettings({
			assetOrigins: ["https://cdn.example.test"],
		});

		expect(marks?.headers.Authorization).toBe("Bearer host-token");
	});

	test("keeps the authorization header off an asset origin outside the list", async () => {
		const { marks } = await speakWithSettings({});

		expect(marks).toBeDefined();
		expect(marks?.headers.Authorization).toBeUndefined();
	});
});
