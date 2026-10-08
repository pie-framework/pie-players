import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import { ToolRegistry } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { ttsToolRegistration } from "../src/registrations/tts.js";

const API_ENDPOINT = "https://tts.example.test/synthesize";
const MARKS_URL = "https://tts.example.test/assets/marks.jsonl";
const AUDIO_URL = "https://tts.example.test/assets/audio.mp3";

type RecordedRequest = {
	url: string;
	method: string;
	headers: Record<string, string>;
};

class PlayingAudio {
	onplay: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onpause: (() => void) | null = null;
	volume = 1;
	playbackRate = 1;
	currentTime = 0;
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

class SilentUtterance {
	onstart: ((event: Event) => void) | null = null;
	onend: ((event: Event) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	constructor(public text: string) {}
}

const silentSpeechSynthesis = {
	getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
	speak: (utterance: SilentUtterance) => {
		utterance.onstart?.(new Event("start"));
		setTimeout(() => utterance.onend?.(new Event("end")), 0);
	},
	cancel: () => {},
	pause: () => {},
	resume: () => {},
};

const globals = globalThis as Record<string, unknown>;
let originals: Record<
	"fetch" | "Audio" | "speechSynthesis" | "SpeechSynthesisUtterance",
	unknown
>;
let requests: RecordedRequest[] = [];

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
	originals = {
		fetch: globalThis.fetch,
		Audio: globals.Audio,
		speechSynthesis: globals.speechSynthesis,
		SpeechSynthesisUtterance: globals.SpeechSynthesisUtterance,
	};
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

beforeEach(() => {
	requests = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		requests.push({
			url,
			method: init?.method ?? "GET",
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
	globals.Audio = PlayingAudio;
	globals.speechSynthesis = silentSpeechSynthesis;
	globals.SpeechSynthesisUtterance = SilentUtterance;
});

afterEach(() => {
	globalThis.fetch = originals.fetch as typeof fetch;
	for (const key of [
		"Audio",
		"speechSynthesis",
		"SpeechSynthesisUtterance",
	] as const) {
		if (originals[key] === undefined) {
			delete globals[key];
		} else {
			globals[key] = originals[key];
		}
	}
});

const createCoordinator = (
	authFetcher: () => Promise<Record<string, unknown>>,
) => {
	const toolRegistry = new ToolRegistry();
	toolRegistry.register(ttsToolRegistration);
	const coordinator = new ToolkitCoordinator({
		assessmentId: "tts-auth-fetcher-test",
		toolConfigStrictness: "error",
		toolRegistry,
		tools: {
			providers: {
				textToSpeech: {
					enabled: true,
					backend: "server",
					transportMode: "custom",
					endpointMode: "rootPost",
					endpointValidationMode: "none",
					apiEndpoint: API_ENDPOINT,
					includeAuthOnAssetFetch: true,
					provider: { runtime: { authFetcher } },
				},
			},
			placement: { item: ["textToSpeech"], passage: ["textToSpeech"] },
		},
	});
	const telemetry: Array<{
		eventName: string;
		payload?: Record<string, unknown>;
	}> = [];
	coordinator.subscribeTelemetry(({ eventName, payload }) => {
		telemetry.push({ eventName, payload });
	});
	return { coordinator, telemetry };
};

const speakThroughCoordinator = async (
	authFetcher: () => Promise<Record<string, unknown>>,
) => {
	const { coordinator, telemetry } = createCoordinator(authFetcher);
	await coordinator.waitUntilReady();
	const content = document.createElement("p");
	content.textContent = "Hello";
	document.body.append(content);
	await coordinator.ttsService.speak(content);
	return {
		synthesis: requests.find((request) => request.url === API_ENDPOINT),
		marks: requests.find((request) => request.url === MARKS_URL),
		audio: requests.find((request) => request.url === AUDIO_URL),
		telemetry,
	};
};

describe("TTS credentials from provider.runtime.authFetcher", () => {
	test("sends returned headers with the synthesize, speech-marks and audio requests", async () => {
		const { synthesis, marks, audio } = await speakThroughCoordinator(
			async () => ({ headers: { Authorization: "Bearer t" } }),
		);

		expect(synthesis?.method).toBe("POST");
		expect(synthesis?.headers.Authorization).toBe("Bearer t");
		expect(marks?.headers).toEqual({ Authorization: "Bearer t" });
		expect(audio?.headers).toEqual({ Authorization: "Bearer t" });
	});

	test("sends a returned authToken with the synthesize, speech-marks and audio requests", async () => {
		const { synthesis, marks, audio } = await speakThroughCoordinator(
			async () => ({ authToken: "t" }),
		);

		expect(synthesis?.headers.Authorization).toBe("Bearer t");
		expect(marks?.headers).toEqual({ Authorization: "Bearer t" });
		expect(audio?.headers).toEqual({ Authorization: "Bearer t" });
	});

	test("fetches credentials before the first request", async () => {
		let requestsWhenFetched = -1;
		await speakThroughCoordinator(async () => {
			requestsWhenFetched = requests.length;
			return { authToken: "t" };
		});

		expect(requestsWhenFetched).toBe(0);
		expect(requests.length).toBe(3);
	});

	test("reports a failed fetch through the init-error telemetry and falls back to browser speech", async () => {
		const { coordinator, telemetry } = createCoordinator(async () => {
			throw new Error("credential service unavailable");
		});
		await coordinator.waitUntilReady();

		expect(requests).toEqual([]);
		expect(telemetry).toContainEqual(
			expect.objectContaining({
				eventName: "pie-tool-backend-call-error",
				payload: expect.objectContaining({
					operation: "auth-fetch",
					errorType: "ProviderAuthFetchError",
				}),
			}),
		);
		expect(telemetry).toContainEqual(
			expect.objectContaining({
				eventName: "pie-tool-init-error",
				payload: expect.objectContaining({
					toolId: "textToSpeech",
					errorType: "TTSRegistryInitError",
				}),
			}),
		);
		expect(telemetry).toContainEqual(
			expect.objectContaining({
				eventName: "pie-toolkit-tts-init-success",
				payload: expect.objectContaining({ provider: "browser-fallback" }),
			}),
		);
	});
});
