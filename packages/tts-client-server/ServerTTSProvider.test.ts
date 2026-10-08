import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ServerTTSProvider } from "./src/ServerTTSProvider";

class MockAudio {
	static instances: MockAudio[] = [];
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
		MockAudio.instances.push(this);
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
		MockAudio.instances = [];
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

	test("preserves speech mark word values in boundary callbacks", async () => {
		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({ apiEndpoint: "/api/tts" } as any);
		const timings = (impl as any).parseSpeechMarks([
			{ time: 0, type: "word", start: 42, end: 43, value: "X" },
		]);

		expect(timings).toEqual([
			{ time: 0, wordIndex: 0, charIndex: 42, length: 1, word: "X" },
		]);
	});

	test("reports playback start from the active audio element", async () => {
		globalThis.fetch = vi.fn(async () =>
			createJSONResponse({
				audio: btoa("audio-bytes"),
				contentType: "audio/mpeg",
				speechMarks: [],
				metadata: {
					providerId: "polly",
					voice: "Joanna",
					duration: 1,
					charCount: 5,
					cached: false,
				},
			}),
		) as unknown as typeof fetch;
		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({ apiEndpoint: "/api/tts" } as any);
		const starts: string[] = [];
		impl.onPlaybackStart = () => starts.push("start");

		await impl.speak("hello");

		expect(starts).toEqual(["start"]);
	});

	test("does not media-rescale initially synthesized server audio", async () => {
		const fetchMock = vi.fn(async () =>
			createJSONResponse({
				audio: btoa("audio-bytes"),
				contentType: "audio/mpeg",
				speechMarks: [
					{ time: 1000, type: "word", start: 0, end: 5, value: "hello" },
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
			rate: 0.8,
		} as any);

		await impl.speak("hello");

		expect(MockAudio.instances[0]?.playbackRate).toBe(1);
	});

	test("supports custom transport with root POST and JSONL marks", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
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
			},
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "https://tts.custom.example/v1",
			transportMode: "custom",
			endpointMode: "rootPost",
			authToken: "token-123",
			includeAuthOnAssetFetch: true,
			assetOrigins: [
				"https://tts.custom.example",
				"https://cdn.custom.example",
			],
			language: "en-US",
			rate: 1.5,
			providerOptions: { cache: true },
		} as any);
		await impl.speak("Read this text");

		expect(fetchMock).toHaveBeenCalledTimes(3);
		const synthCall = fetchMock.mock.calls[0];
		if (!synthCall) throw new Error("expected a synthesize fetch call");
		expect(String(synthCall[0])).toBe("https://tts.custom.example/v1");
		const synthBody = JSON.parse(String((synthCall[1] as RequestInit).body));
		expect(synthBody.speedRate).toBe("fast");
		expect(synthBody.lang_id).toBe("en-US");
		expect(synthBody.cache).toBe(true);
	});

	test("sends the custom transport language as both lang_id and langId", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
			String(input) === "https://tts.custom.example/v1"
				? createJSONResponse({
						audioContent: "https://tts.custom.example/audio.mp3",
						speechMarks: [
							{ time: 0, type: "word", start: 0, end: 4, value: "Leer" },
						],
					})
				: new Response(new Blob(["mp3-bytes"]), { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "https://tts.custom.example/v1",
			transportMode: "custom",
			endpointMode: "rootPost",
			language: "en-US",
			providerOptions: { lang_id: "es-MX" },
		} as any);
		await impl.speak("Leer");

		const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const synthBody = JSON.parse(String(options.body));
		expect(synthBody.lang_id).toBe("es-MX");
		expect(synthBody.langId).toBe("es-MX");
	});

	test("sends the language a speak names on the custom transport, then the configured one again", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
			String(input) === "https://tts.custom.example/v1"
				? createJSONResponse({
						audioContent: "https://tts.custom.example/audio.mp3",
						speechMarks: [],
					})
				: new Response(new Blob(["mp3-bytes"]), { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "https://tts.custom.example/v1",
			transportMode: "custom",
			endpointMode: "rootPost",
			language: "en-US",
		} as any);
		const updateSettings = (impl as any).updateSettings.bind(impl);
		const sentLanguage = (call: number) => {
			const options = fetchMock.mock.calls[call]?.[1] as
				| RequestInit
				| undefined;
			return JSON.parse(String(options?.body)).lang_id;
		};

		updateSettings({ providerOptions: { contentLanguage: "es-MX" } });
		await impl.speak("Leer");
		expect(sentLanguage(0)).toBe("es-MX");

		updateSettings({ providerOptions: { contentLanguage: undefined } });
		await impl.speak("Read");
		expect(sentLanguage(2)).toBe("en-US");
	});

	test("keeps a host's lang_id over the language a speak names", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
			String(input) === "https://tts.custom.example/v1"
				? createJSONResponse({
						audioContent: "https://tts.custom.example/audio.mp3",
						speechMarks: [],
					})
				: new Response(new Blob(["mp3-bytes"]), { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "https://tts.custom.example/v1",
			transportMode: "custom",
			endpointMode: "rootPost",
			language: "en-US",
			providerOptions: { lang_id: "es-MX" },
		} as any);
		(impl as any).updateSettings({
			providerOptions: { contentLanguage: "en-US" },
		});
		await impl.speak("Leer");

		const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(JSON.parse(String(options?.body)).lang_id).toBe("es-MX");
	});

	test("sends the language a speak names on the pie transport", async () => {
		const fetchMock = vi.fn(async () =>
			createJSONResponse({
				audio: btoa("audio-bytes"),
				contentType: "audio/mpeg",
				speechMarks: [],
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "/api/tts",
			provider: "polly",
			language: "en-US",
		} as any);
		(impl as any).updateSettings({
			providerOptions: { contentLanguage: "es-MX" },
		});
		await impl.speak("hola");

		const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(JSON.parse(String(options?.body)).language).toBe("es-MX");
	});

	describe("custom transport asset auth", () => {
		const credentialsSeen: Record<string, RequestCredentials | undefined> = {};
		const speakAndCaptureHeaders = async (
			config: Record<string, unknown>,
		): Promise<Record<string, Record<string, string>>> => {
			const captured: Record<string, Record<string, string>> = {};
			for (const key of Object.keys(credentialsSeen)) delete credentialsSeen[key];
			const fetchMock = vi.fn(
				async (input: RequestInfo | URL, init?: RequestInit) => {
					const url = String(input);
					const headers = { ...(init?.headers as Record<string, string>) };
					credentialsSeen[new URL(url).pathname] = init?.credentials;
					if (url === "https://tts.custom.example/v1") {
						captured.synthesize = headers;
						return createJSONResponse({
							audioContent: "https://cdn.custom.example/audio.mp3",
							word: "https://cdn.custom.example/marks.jsonl",
						});
					}
					if (url === "https://cdn.custom.example/marks.jsonl") {
						captured.marks = headers;
						return new Response(
							'{"time":0,"type":"word","start":0,"end":4,"value":"Read"}\n',
							{ status: 200, headers: { "Content-Type": "text/plain" } },
						);
					}
					if (url === "https://cdn.custom.example/audio.mp3") {
						captured.audio = headers;
						return new Response(new Blob(["mp3-bytes"]), { status: 200 });
					}
					return new Response("not-found", { status: 404 });
				},
			);
			globalThis.fetch = fetchMock as unknown as typeof fetch;

			const provider = new ServerTTSProvider();
			const impl = await provider.initialize({
				apiEndpoint: "https://tts.custom.example/v1",
				transportMode: "custom",
				endpointMode: "rootPost",
				assetOrigins: [
					"https://tts.custom.example",
					"https://cdn.custom.example",
				],
				...config,
			} as any);
			await impl.speak("Read this text");
			return captured;
		};

		test("sends the Authorization header of the synthesize request with the marks and audio fetches", async () => {
			const captured = await speakAndCaptureHeaders({
				headers: { Authorization: "Bearer t", "X-Tenant": "district-7" },
				includeAuthOnAssetFetch: true,
			});

			expect(captured.synthesize).toMatchObject({
				Authorization: "Bearer t",
				"X-Tenant": "district-7",
			});
			expect(captured.marks).toEqual({ Authorization: "Bearer t" });
			expect(captured.audio).toEqual({ Authorization: "Bearer t" });
		});

		test("sends an authToken with the marks and audio fetches", async () => {
			const captured = await speakAndCaptureHeaders({
				authToken: "t",
				includeAuthOnAssetFetch: true,
			});

			expect(captured.synthesize).toMatchObject({ Authorization: "Bearer t" });
			expect(captured.marks).toEqual({ Authorization: "Bearer t" });
			expect(captured.audio).toEqual({ Authorization: "Bearer t" });
		});

		test("keeps asset fetches unauthenticated without includeAuthOnAssetFetch", async () => {
			const captured = await speakAndCaptureHeaders({
				headers: { Authorization: "Bearer t" },
				authToken: "t",
			});

			expect(captured.synthesize).toMatchObject({ Authorization: "Bearer t" });
			expect(captured.marks).toEqual({});
			expect(captured.audio).toEqual({});
		});

		test("scrubs auth from asset fetches to an origin outside assetOrigins", async () => {
			const captured = await speakAndCaptureHeaders({
				headers: { Authorization: "Bearer t" },
				includeAuthOnAssetFetch: true,
				assetOrigins: ["https://tts.custom.example"],
			});

			expect(captured.synthesize).toMatchObject({ Authorization: "Bearer t" });
			expect(captured.marks).toEqual({});
			expect(captured.audio).toEqual({});
		});

		test("applies the credentials mode to the synthesize, marks and audio fetches", async () => {
			await speakAndCaptureHeaders({ credentials: "include" });

			expect(credentialsSeen).toEqual({
				"/v1": "include",
				"/marks.jsonl": "include",
				"/audio.mp3": "include",
			});
		});

		test("sends no cookies to an asset origin outside assetOrigins", async () => {
			await speakAndCaptureHeaders({
				credentials: "include",
				assetOrigins: ["https://tts.custom.example"],
			});

			expect(credentialsSeen).toEqual({
				"/v1": "include",
				"/marks.jsonl": undefined,
				"/audio.mp3": undefined,
			});
		});

		test("leaves the credentials mode to the browser when unset", async () => {
			await speakAndCaptureHeaders({});

			expect(Object.values(credentialsSeen)).toEqual([
				undefined,
				undefined,
				undefined,
			]);
		});
	});

	test("updates custom transport speedRate for active inline speed changes", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
			assetOrigins: [
				"https://tts.custom.example",
				"https://cdn.custom.example",
			],
			providerOptions: { speedRate: "medium", cache: true },
		} as any);

		await impl.speak("Read this text");
		// 1.25 sits inside the shared 0.95-1.5 "medium" tolerance band
		// (resolveSpeedRateBucket in @pie-players/tts-server-core), so use a
		// rate clearly above it to exercise an actual bucket change.
		impl.updateSettings({ rate: 1.6 } as any);
		await impl.speak("Read this text again");

		const synthesisBodies = fetchMock.mock.calls
			.filter(([input]) => String(input) === "https://tts.custom.example/v1")
			.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
		expect(synthesisBodies.map((body) => body.speedRate)).toEqual([
			"medium",
			"fast",
		]);
	});

	test("a stopped synthesis aborts its request and resolves without reporting an error", async () => {
		let aborted = false;
		const fetchMock = vi.fn(
			async (
				_input: RequestInfo | URL,
				init?: RequestInit,
			): Promise<Response> =>
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

		const events: string[] = [];
		const provider = new ServerTTSProvider();
		const impl = await provider.initialize({
			apiEndpoint: "/api/tts",
			providerOptions: {
				__pieTelemetry: (eventName: string) => {
					events.push(eventName);
				},
			},
		} as any);
		const speakPromise = impl.speak("long running synthesis");
		impl.stop();
		await expect(speakPromise).resolves.toBeUndefined();
		expect(aborted).toBe(true);
		expect(events).toContain("pie-tool-backend-call-start");
		expect(events).not.toContain("pie-tool-backend-call-error");
	});

	describe("a pause before the audio sounds", () => {
		const synthesized = () =>
			createJSONResponse({
				audio: btoa("audio-bytes"),
				contentType: "audio/mpeg",
				speechMarks: [],
				metadata: {
					providerId: "polly",
					voice: "Joanna",
					duration: 1,
					charCount: 5,
					cached: false,
				},
			});

		test("during synthesis holds the audio until resume", async () => {
			let respond: (() => void) | null = null;
			globalThis.fetch = vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						respond = () => resolve(synthesized());
					}),
			) as unknown as typeof fetch;
			const provider = new ServerTTSProvider();
			const impl = await provider.initialize({ apiEndpoint: "/api/tts" } as any);
			const starts: string[] = [];
			impl.onPlaybackStart = () => starts.push("start");

			const speaking = impl.speak("hello");
			await vi.waitFor(() => expect(respond).not.toBeNull());
			impl.pause();
			respond?.();
			await vi.waitFor(() => expect(MockAudio.instances).toHaveLength(1));
			await new Promise((resolve) => setTimeout(resolve, 5));

			expect(MockAudio.instances[0]?.paused).toBe(true);
			expect(starts).toEqual([]);
			expect(impl.isPaused()).toBe(true);

			impl.resume();
			await speaking;
			expect(starts).toEqual(["start"]);
		});

		test("while the audio buffers does not fail the speak", async () => {
			globalThis.fetch = vi.fn(async () =>
				synthesized(),
			) as unknown as typeof fetch;
			// A browser rejects a pending play with an AbortError when the element
			// is paused before it starts.
			class BufferingAudio extends MockAudio {
				private pendingPlay: ((error?: Error) => void) | null = null;
				play(): Promise<void> {
					if (this.pendingPlay) return super.play();
					return new Promise((resolve, reject) => {
						this.pendingPlay = (error) => (error ? reject(error) : resolve());
					});
				}
				pause(): void {
					super.pause();
					this.pendingPlay?.(new DOMException("interrupted", "AbortError"));
				}
			}
			(globalThis as Record<string, unknown>).Audio = BufferingAudio;
			const provider = new ServerTTSProvider();
			const impl = await provider.initialize({ apiEndpoint: "/api/tts" } as any);

			const speaking = impl.speak("hello");
			await vi.waitFor(() => expect(MockAudio.instances).toHaveLength(1));
			impl.pause();
			await new Promise((resolve) => setTimeout(resolve, 5));
			impl.resume();

			await expect(speaking).resolves.toBeUndefined();
		});
	});

	test("validates provider-specific voices endpoint for Polly", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/tts/polly/voices") {
				return createJSONResponse({ voices: [] }, 200);
			}
			return new Response("not-found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		await provider.initialize({
			apiEndpoint: "/api/tts",
			provider: "polly",
			validateEndpoint: true,
			endpointValidationMode: "voices",
		} as any);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/tts/polly/voices");
	});

	test("validates provider-specific voices endpoint for Google", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/tts/google/voices") {
				return createJSONResponse({ voices: [] }, 200);
			}
			return new Response("not-found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		await provider.initialize({
			apiEndpoint: "/api/tts",
			provider: "google",
			validateEndpoint: true,
			endpointValidationMode: "voices",
		} as any);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/tts/google/voices");
	});

	test("falls back to the generic voices endpoint when the provider route is absent", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/tts/voices") {
				return createJSONResponse({ voices: [] }, 200);
			}
			return new Response("not-found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		await provider.initialize({
			apiEndpoint: "/api/tts",
			provider: "polly",
			validateEndpoint: true,
			endpointValidationMode: "voices",
		} as any);

		expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
			"/api/tts/polly/voices",
			"/api/tts/voices",
		]);
	});

	test("does not try the generic voices endpoint after a non-404 failure", async () => {
		const fetchMock = vi.fn(
			async () => new Response("unauthorized", { status: 401 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const provider = new ServerTTSProvider();
		await expect(
			provider.initialize({
				apiEndpoint: "/api/tts",
				provider: "google",
				validateEndpoint: true,
				endpointValidationMode: "voices",
			} as any),
		).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	describe("getCapabilities supportsSSML", () => {
		const capabilitiesFor = async (config: Record<string, unknown>) => {
			const provider = new ServerTTSProvider();
			await provider.initialize(config as any);
			return provider.getCapabilities();
		};

		test("reports SSML support for Polly on the pie transport", async () => {
			const caps = await capabilitiesFor({
				apiEndpoint: "/api/tts",
				provider: "polly",
			});
			expect(caps.supportsSSML).toBe(true);
		});

		test("reports SSML support for Google on the pie transport", async () => {
			const caps = await capabilitiesFor({
				apiEndpoint: "/api/tts",
				provider: "google",
			});
			expect(caps.supportsSSML).toBe(true);
		});

		test("defaults to SSML support (pie transport defaults to Polly)", async () => {
			const caps = await capabilitiesFor({ apiEndpoint: "/api/tts" });
			expect(caps.supportsSSML).toBe(true);
		});

		test("does not report SSML support on the custom transport", async () => {
			const caps = await capabilitiesFor({
				apiEndpoint: "/api/tts",
				provider: "custom",
				transportMode: "custom",
			});
			expect(caps.supportsSSML).toBe(false);
		});

		test("stays conservative for unknown pie providers", async () => {
			const caps = await capabilitiesFor({
				apiEndpoint: "/api/tts",
				provider: "elevenlabs",
			});
			expect(caps.supportsSSML).toBe(false);
		});
	});

	describe("word highlighting", () => {
		type Tick = () => void;

		const originalWindow = (globalThis as Record<string, unknown>).window;

		/**
		 * Captures the interval callback instead of scheduling it, so a test can
		 * decide exactly which playback positions the loop observes.
		 */
		const stubWindowTimers = (): Tick[] => {
			const ticks: Tick[] = [];
			(globalThis as Record<string, unknown>).window = {
				setInterval: (fn: Tick) => {
					ticks.push(fn);
					return ticks.length;
				},
			};
			return ticks;
		};

		afterEach(() => {
			if (originalWindow === undefined) {
				delete (globalThis as Record<string, unknown>).window;
			} else {
				(globalThis as Record<string, unknown>).window = originalWindow;
			}
		});

		const startHighlighting = async (
			timings: Array<{ time: number; charIndex: number; word: string }>,
		) => {
			const provider = new ServerTTSProvider();
			const impl = (await provider.initialize({
				apiEndpoint: "/api/tts",
			} as any)) as any;
			const audio = { currentTime: 0, playbackRate: 1 };
			impl.currentAudio = audio;
			impl.wordTimings = timings.map((t, index) => ({
				time: t.time,
				wordIndex: index,
				charIndex: t.charIndex,
				length: t.word.length,
				word: t.word,
			}));
			const boundaries: Array<{ word: string; charIndex: number }> = [];
			impl.onWordBoundary = (word: string, charIndex: number) => {
				boundaries.push({ word, charIndex });
			};
			const ticks = stubWindowTimers();
			impl.startWordHighlighting();
			return { impl, audio, boundaries, tick: () => ticks[0]?.() };
		};

		const denseTimings = [
			{ time: 0, charIndex: 0, word: "the" },
			{ time: 30, charIndex: 4, word: "quick" },
			{ time: 60, charIndex: 10, word: "brown" },
			{ time: 90, charIndex: 16, word: "fox" },
		];

		test("reports the word that is current, not one word per tick", async () => {
			const { audio, boundaries, tick } = await startHighlighting(denseTimings);

			audio.currentTime = 0.095;
			tick();

			expect(boundaries).toEqual([{ word: "fox", charIndex: 16 }]);
		});

		test("reports each word once when ticks keep pace with the timings", async () => {
			const { audio, boundaries, tick } = await startHighlighting(denseTimings);

			for (const ms of [0, 30, 60, 90]) {
				audio.currentTime = ms / 1000;
				tick();
			}

			expect(boundaries.map((b) => b.word)).toEqual([
				"the",
				"quick",
				"brown",
				"fox",
			]);
		});

		test("does not re-report the current word on a tick that crossed nothing", async () => {
			const { audio, boundaries, tick } = await startHighlighting(denseTimings);

			audio.currentTime = 0.065;
			tick();
			tick();
			audio.currentTime = 0.07;
			tick();

			expect(boundaries).toEqual([{ word: "brown", charIndex: 10 }]);
		});

		test("resumes from the spoken position instead of replaying the passage", async () => {
			const { impl, audio, boundaries, tick } =
				await startHighlighting(denseTimings);

			audio.currentTime = 0.065;
			tick();
			expect(boundaries.map((b) => b.word)).toEqual(["brown"]);

			// pause() then resume() tears the interval down and starts a new one.
			impl.stopWordHighlighting();
			const ticks: Tick[] = stubWindowTimers();
			impl.startWordHighlighting();
			ticks[0]?.();

			expect(boundaries.map((b) => b.word)).toEqual(["brown"]);
		});

		test("re-reports an earlier word after the audio seeks backwards", async () => {
			const { audio, boundaries, tick } = await startHighlighting(denseTimings);

			audio.currentTime = 0.095;
			tick();
			audio.currentTime = 0.035;
			tick();

			expect(boundaries.map((b) => b.word)).toEqual(["fox", "quick"]);
		});

		test("stays silent before the first word's time has arrived", async () => {
			const { audio, boundaries, tick } = await startHighlighting([
				{ time: 250, charIndex: 0, word: "later" },
			]);

			audio.currentTime = 0.1;
			tick();

			expect(boundaries).toEqual([]);
		});

		test("scans forward from the cursor rather than from the first timing", async () => {
			const { impl } = await startHighlighting(denseTimings);

			// Given a cursor already past a word, an earlier timing whose time has
			// also arrived must not be revisited.
			expect(impl.resolveCurrentWordIndex(95, 2)).toBe(3);
			expect(impl.resolveCurrentWordIndex(95, -1)).toBe(3);
			expect(impl.resolveCurrentWordIndex(35, 1)).toBe(1);
			// A cursor left over from a longer previous passage is discarded.
			expect(impl.resolveCurrentWordIndex(95, 9)).toBe(3);
		});

		test("keeps spoken text out of the console", async () => {
			const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
			const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
			const { audio, tick } = await startHighlighting(denseTimings);

			audio.currentTime = 0.095;
			tick();

			expect(consoleLog).not.toHaveBeenCalled();
			expect(consoleInfo).not.toHaveBeenCalled();
			consoleLog.mockRestore();
			consoleInfo.mockRestore();
		});
	});
});
