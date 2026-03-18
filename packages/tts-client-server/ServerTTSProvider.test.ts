import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ServerTTSProvider } from "./src/ServerTTSProvider";

class MockAudio {
	src = "";
	currentTime = 0;
	playbackRate = 1;
	volume = 1;
	paused = true;
	ended = false;
	onplay: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onpause: (() => void) | null = null;

	constructor(src: string) {
		this.src = src;
	}

	play(): Promise<void> {
		this.paused = false;
		this.onplay?.();
		setTimeout(() => {
			if (!this.paused) {
				this.ended = true;
				this.onended?.();
			}
		}, 0);
		return Promise.resolve();
	}

	pause(): void {
		this.paused = true;
		this.onpause?.();
	}
}

const createJSONResponse = (data: unknown, status = 200): Response =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

describe("ServerTTSProvider", () => {
	const originalFetch = globalThis.fetch;
	const originalAudio = (globalThis as Record<string, unknown>).Audio;
	const originalCreateObjectURL = URL.createObjectURL;
	const originalRevokeObjectURL = URL.revokeObjectURL;

	beforeEach(() => {
		(globalThis as Record<string, unknown>).Audio = MockAudio;
		URL.createObjectURL = vi.fn(() => "blob:mock-audio");
		URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalAudio) {
			(globalThis as Record<string, unknown>).Audio = originalAudio;
		} else {
			delete (globalThis as Record<string, unknown>).Audio;
		}
		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
		vi.clearAllMocks();
	});

	test("uses PIE transport defaults with /synthesize endpoint", async () => {
		const fetchMock = vi.fn(async () =>
			createJSONResponse({
				audio: btoa("audio-bytes"),
				contentType: "audio/mpeg",
				speechMarks: [
					{ time: 0, type: "word", start: 0, end: 5, value: "hello" },
				],
				metadata: {
					providerId: "polly",
					voice: "Joanna",
					duration: 1,
					charCount: 5,
					cached: false,
				},
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "/api/tts",
			provider: "polly",
		} as any);
		await impl.speak("hello");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/tts/synthesize");
		const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(options.body));
		expect(body.provider).toBe("polly");
		expect(body.includeSpeechMarks).toBe(true);
	});

	test("supports custom transport with root POST and JSONL marks", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "https://tts.custom.example/v1") {
				return createJSONResponse({
					audioContent: "https://cdn.custom.example/audio.mp3",
					word: "https://cdn.custom.example/marks.jsonl",
				});
			}
			if (url === "https://cdn.custom.example/marks.jsonl") {
				return new Response(
					'{"time":0,"type":"word","start":0,"end":4,"value":"Read"}\n',
					{ status: 200, headers: { "Content-Type": "text/plain" } },
				);
			}
			if (url === "https://cdn.custom.example/audio.mp3") {
				expect(init?.headers).toMatchObject({
					Authorization: "Bearer token-123",
				});
				return new Response(new Blob(["mp3-bytes"]), { status: 200 });
			}
			return new Response("not-found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "https://tts.custom.example/v1",
			transportMode: "custom",
			endpointMode: "rootPost",
			authToken: "token-123",
			includeAuthOnAssetFetch: true,
			language: "en-US",
			rate: 1.5,
			providerOptions: { cache: true },
		} as any);
		await impl.speak("Read this text");

		expect(fetchMock).toHaveBeenCalledTimes(3);
		const synthCall = fetchMock.mock.calls[0];
		expect(String(synthCall?.[0])).toBe("https://tts.custom.example/v1");
		const synthBody = JSON.parse(String((synthCall?.[1] as RequestInit).body));
		expect(synthBody.speedRate).toBe("fast");
		expect(synthBody.lang_id).toBe("en-US");
		expect(synthBody.cache).toBe(true);
	});

	test("aborts in-flight synthesis when stopped", async () => {
		let aborted = false;
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
				new Promise((_resolve, reject) => {
					if (init?.signal?.aborted) {
						aborted = true;
						reject(new DOMException("Aborted", "AbortError"));
						return;
					}
					init?.signal?.addEventListener("abort", () => {
						aborted = true;
						reject(new DOMException("Aborted", "AbortError"));
					});
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "/api/tts",
		} as any);
		const speakPromise = impl.speak("long running synthesis");
		impl.stop();
		await expect(speakPromise).rejects.toThrow();
		expect(aborted).toBe(true);
	});
});
