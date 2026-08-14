import { afterEach, describe, expect, test } from "bun:test";
import { BrowserTTSProvider } from "../src/services/tts/browser-provider";

const originalWindow = (globalThis as any).window;
const originalSpeechSynthesis = (globalThis as any).speechSynthesis;
const originalSpeechSynthesisUtterance = (globalThis as any)
	.SpeechSynthesisUtterance;
const originalNavigator = (globalThis as any).navigator;
const originalSegmenter = (globalThis as any).Intl?.Segmenter;

const installSpeechMocks = () => {
	const synth = {
		getVoices: () => [],
		speak: () => {},
		cancel: () => {},
		pause: () => {},
		resume: () => {},
	};
	(globalThis as any).speechSynthesis = synth;
	(globalThis as any).window = { speechSynthesis: synth };
};

describe("browser provider segmentation", () => {
	afterEach(() => {
		(globalThis as any).window = originalWindow;
		(globalThis as any).speechSynthesis = originalSpeechSynthesis;
		(globalThis as any).SpeechSynthesisUtterance =
			originalSpeechSynthesisUtterance;
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: originalNavigator,
		});
		if ((globalThis as any).Intl) {
			(globalThis as any).Intl.Segmenter = originalSegmenter;
		}
	});

	test("uses Intl.Segmenter sentence boundaries when available", async () => {
		installSpeechMocks();
		(globalThis as any).Intl.Segmenter = class {
			segment(text: string) {
				return [
					{ segment: "Dr. Stone writes this sentence.", index: 0 },
					{
						segment: " Another sentence follows for chunking.",
						index: text.indexOf(" Another"),
					},
				];
			}
		};

		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		const chunks = impl.splitIntoChunks(
			"Dr. Stone writes this sentence. Another sentence follows for chunking.",
		);
		expect(chunks).toEqual([
			{
				text: "Dr. Stone writes this sentence. Another sentence follows for chunking.",
				offset: 0,
			},
		]);
	});

	test("falls back to regex word inference when Segmenter is unavailable", async () => {
		installSpeechMocks();
		(globalThis as any).Intl.Segmenter = undefined;
		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		expect(impl.inferWordLength("answerA. Chlorophyll", 0)).toBe(8);
		expect(impl.inferWordLength("answerA. Chlorophyll", 9)).toBe(11);
	});

	test("infers unicode word lengths via Intl.Segmenter word mode", async () => {
		installSpeechMocks();
		(globalThis as any).Intl.Segmenter = class {
			segment(_text: string) {
				return [
					{ segment: "dioxide", index: 0, isWordLike: true },
					{ segment: " ", index: 7, isWordLike: false },
					{ segment: "βeta", index: 8, isWordLike: true },
				];
			}
		};
		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		expect(impl.inferWordLength("dioxide βeta", 0)).toBe(7);
		expect(impl.inferWordLength("dioxide βeta", 8)).toBe(4);
	});

	test("uses simple boundary-relative word length inference", async () => {
		installSpeechMocks();
		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		expect(impl.inferWordLength("oxygen energy", 0)).toBe(6);
		expect(impl.inferWordLength("oxygen energy", 2)).toBe(4);
		expect(impl.inferWordLength("oxygen energy", 7)).toBe(6);
	});

	test("chooses a local language-matched voice when no voice is configured", async () => {
		let spokenVoiceName: string | null = null;
		const voices = [
			{
				default: true,
				lang: "en-US",
				localService: false,
				name: "Remote Default Voice",
				voiceURI: "remote-default",
			},
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Samantha",
				voiceURI: "samantha",
			},
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "local-english",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceName = utterance.voice?.name || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			text: string;
			voice: SpeechSynthesisVoice | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;

			constructor(text: string) {
				this.text = text;
			}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: { language: "en-US", languages: ["en-US"] },
		});

		const impl = await new BrowserTTSProvider().initialize({} as any);
		await impl.speak("Read this text");

		expect(spokenVoiceName).toBe("Samantha");
	});

	test("preserves an explicitly configured browser voice", async () => {
		let spokenVoiceName: string | null = null;
		const voices = [
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Samantha",
				voiceURI: "samantha",
			},
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "local-english",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceName = utterance.voice?.name || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			text: string;
			voice: SpeechSynthesisVoice | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;

			constructor(text: string) {
				this.text = text;
			}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: { language: "en-US", languages: ["en-US"] },
		});

		const impl = await new BrowserTTSProvider().initialize({
			voice: "Local English Voice",
		} as any);
		await impl.speak("Read this text");

		expect(spokenVoiceName).toBe("Local English Voice");
	});

	test("leaves fallback browser default unassigned when no recommended or local voice exists", async () => {
		let spokenVoiceName: string | null = null;
		const voices = [
			{
				default: true,
				lang: "en-US",
				localService: false,
				name: "Remote Default Voice",
				voiceURI: "remote-default",
			},
			{
				default: false,
				lang: "en-US",
				localService: false,
				name: "Remote Secondary Voice",
				voiceURI: "remote-secondary",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceName = utterance.voice?.name || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			text: string;
			voice: SpeechSynthesisVoice | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;

			constructor(text: string) {
				this.text = text;
			}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: { language: "en-US", languages: ["en-US"] },
		});

		const impl = await new BrowserTTSProvider().initialize({} as any);
		await impl.speak("Read this text");

		expect(spokenVoiceName).toBeNull();
	});

	test("leaves the browser default voice unassigned for native default playback", async () => {
		let spokenVoiceName: string | null = "not-called";
		const voices = [
			{
				default: true,
				lang: "en-US",
				localService: true,
				name: "Samantha",
				voiceURI: "samantha",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceName = utterance.voice?.name || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			text: string;
			voice: SpeechSynthesisVoice | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;

			constructor(text: string) {
				this.text = text;
			}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: { language: "en-US", languages: ["en-US"] },
		});

		const impl = await new BrowserTTSProvider().initialize({
			voice: "Samantha",
		} as any);
		await impl.speak("Read this text");

		expect(spokenVoiceName).toBeNull();
	});

	test("resolves an explicitly configured voice URI", async () => {
		let spokenVoiceName: string | null = null;
		let spokenVoiceURI: string | null = null;
		const voices = [
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "same-name-alternate",
			},
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "local-english",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceName = utterance.voice?.name || null;
				spokenVoiceURI = utterance.voice?.voiceURI || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			text: string;
			voice: SpeechSynthesisVoice | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;

			constructor(text: string) {
				this.text = text;
			}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: { language: "en-US", languages: ["en-US"] },
		});

		const impl = await new BrowserTTSProvider().initialize({
			voice: "local-english",
		} as any);
		await impl.speak("Read this text");

		expect(spokenVoiceName).toBe("Local English Voice");
		expect(spokenVoiceURI).toBe("local-english");
	});

	test("waits for voiceschanged before speaking with an explicit voice", async () => {
		let voices: SpeechSynthesisVoice[] = [];
		let spokenVoiceURI: string | null = null;
		const listeners = new Set<EventListener>();
		const synth = {
			getVoices: () => voices,
			addEventListener: (_type: string, listener: EventListener) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: EventListener) => {
				listeners.delete(listener);
			},
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenVoiceURI = utterance.voice?.voiceURI || null;
				utterance.onstart?.({} as SpeechSynthesisEvent);
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			voice: SpeechSynthesisVoice | null = null;
			constructor(readonly text: string) {}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };

		const impl = await new BrowserTTSProvider().initialize({
			voice: "local-english",
		} as any);
		const speak = impl.speak("Read this text");
		expect(listeners.size).toBe(1);
		expect(spokenVoiceURI).toBeNull();

		voices = [
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "local-english",
			},
		] as SpeechSynthesisVoice[];
		for (const listener of listeners) {
			listener({ type: "voiceschanged" } as Event);
		}
		await speak;

		expect(spokenVoiceURI).toBe("local-english");
		expect(listeners.size).toBe(0);
	});

	test("rejects an explicit voice that the browser does not expose", async () => {
		let speakCalls = 0;
		const voices = [
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Different Voice",
				voiceURI: "different-voice",
			},
		] as SpeechSynthesisVoice[];
		const synth = {
			getVoices: () => voices,
			speak: () => {
				speakCalls += 1;
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };

		const impl = await new BrowserTTSProvider().initialize({
			voice: "missing-voice",
		} as any);
		await expect(impl.speak("Read this text")).rejects.toThrow(
			'Configured browser voice "missing-voice" is unavailable',
		);
		expect(speakCalls).toBe(0);
	});

	test("cancels a pending voice inventory wait when playback is stopped", async () => {
		const listeners = new Set<EventListener>();
		const synth = {
			getVoices: () => [] as SpeechSynthesisVoice[],
			addEventListener: (_type: string, listener: EventListener) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: EventListener) => {
				listeners.delete(listener);
			},
			speak: () => {
				throw new Error("speech must not be queued after stop");
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };

		const impl = await new BrowserTTSProvider().initialize({
			voice: "local-english",
		} as any);
		const speak = impl.speak("Read this text");
		expect(listeners.size).toBe(1);

		impl.stop();
		await speak;

		expect(listeners.size).toBe(0);
	});

	test("fails when an explicit voice inventory never becomes available", async () => {
		const realSetTimeout = globalThis.setTimeout;
		const realClearTimeout = globalThis.clearTimeout;
		let nextTimerId = 1;
		const timers = new Map<number, { callback: () => void; delay: number }>();
		(globalThis as any).setTimeout = (callback: () => void, delay = 0) => {
			const timerId = nextTimerId++;
			timers.set(timerId, { callback, delay });
			return timerId;
		};
		(globalThis as any).clearTimeout = (timerId: number) => {
			timers.delete(timerId);
		};

		try {
			let speakCalls = 0;
			const listeners = new Set<EventListener>();
			const synth = {
				getVoices: () => [] as SpeechSynthesisVoice[],
				addEventListener: (_type: string, listener: EventListener) => {
					listeners.add(listener);
				},
				removeEventListener: (_type: string, listener: EventListener) => {
					listeners.delete(listener);
				},
				speak: () => {
					speakCalls += 1;
				},
				cancel: () => {},
				pause: () => {},
				resume: () => {},
			};
			(globalThis as any).speechSynthesis = synth;
			(globalThis as any).window = { speechSynthesis: synth };

			const impl = await new BrowserTTSProvider().initialize({
				voice: "local-english",
			} as any);
			const speak = impl.speak("Read this text");
			const inventoryTimer = [...timers.values()].find(
				(timer) => timer.delay === 2_000,
			);
			expect(inventoryTimer).toBeDefined();
			inventoryTimer?.callback();

			await expect(speak).rejects.toThrow(
				"browser did not publish its voice inventory within 2 seconds",
			);
			expect(speakCalls).toBe(0);
			expect(listeners.size).toBe(0);
			expect(timers.size).toBe(0);
		} finally {
			(globalThis as any).setTimeout = realSetTimeout;
			(globalThis as any).clearTimeout = realClearTimeout;
		}
	});

	test("rejects when the native engine ends without starting audio", async () => {
		const synth = {
			getVoices: () => [],
			speak: (utterance: SpeechSynthesisUtterance) => {
				utterance.onend?.({} as SpeechSynthesisEvent);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			constructor(readonly text: string) {}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };

		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		await expect(impl.speak("Read this text")).rejects.toThrow(
			"Browser speech synthesis ended before audio started",
		);

		expect(impl.isPlaying()).toBeFalse();
		expect(impl.utterance).toBeNull();
	});

	test("settles a superseded run before queueing replacement speech", async () => {
		const spokenTexts: string[] = [];
		let cancelCalls = 0;
		const synth = {
			getVoices: () => [],
			speak: (utterance: SpeechSynthesisUtterance) => {
				spokenTexts.push(utterance.text);
				utterance.onstart?.({} as SpeechSynthesisEvent);
				if (spokenTexts.length > 1) {
					utterance.onend?.({} as SpeechSynthesisEvent);
				}
			},
			cancel: () => {
				cancelCalls += 1;
			},
			pause: () => {},
			resume: () => {},
		};
		(globalThis as any).SpeechSynthesisUtterance = class {
			constructor(readonly text: string) {}
		};
		(globalThis as any).speechSynthesis = synth;
		(globalThis as any).window = { speechSynthesis: synth };

		const impl = (await new BrowserTTSProvider().initialize({} as any)) as any;
		let playbackStarts = 0;
		expect("onPlaybackStart" in impl).toBeTrue();
		impl.onPlaybackStart = () => {
			playbackStarts += 1;
		};

		const firstSpeak = impl.speak("First utterance");
		await Promise.resolve();
		expect(spokenTexts).toEqual(["First utterance"]);

		const replacementSpeak = impl.speak("Replacement utterance");
		await firstSpeak;
		await replacementSpeak;

		expect(cancelCalls).toBe(1);
		expect(spokenTexts).toEqual(["First utterance", "Replacement utterance"]);
		expect(playbackStarts).toBe(2);
	});

	test("times out and cancels a native engine that never starts", async () => {
		const realSetTimeout = globalThis.setTimeout;
		const realClearTimeout = globalThis.clearTimeout;
		let nextTimerId = 1;
		const timers = new Map<number, { callback: () => void; delay: number }>();
		(globalThis as any).setTimeout = (callback: () => void, delay = 0) => {
			const timerId = nextTimerId++;
			timers.set(timerId, { callback, delay });
			return timerId;
		};
		(globalThis as any).clearTimeout = (timerId: number) => {
			timers.delete(timerId);
		};

		try {
			let speakCalls = 0;
			let cancelCalls = 0;
			const synth = {
				getVoices: () => [],
				speak: (utterance: SpeechSynthesisUtterance) => {
					speakCalls += 1;
					if (speakCalls === 2) {
						utterance.onstart?.({} as SpeechSynthesisEvent);
						utterance.onend?.({} as SpeechSynthesisEvent);
					}
				},
				cancel: () => {
					cancelCalls += 1;
				},
				pause: () => {},
				resume: () => {},
			};
			(globalThis as any).SpeechSynthesisUtterance = class {
				constructor(readonly text: string) {}
			};
			(globalThis as any).speechSynthesis = synth;
			(globalThis as any).window = { speechSynthesis: synth };

			const impl = await new BrowserTTSProvider().initialize({} as any);
			const stalledSpeak = impl.speak("Stalled utterance");
			await Promise.resolve();
			const startTimer = [...timers.values()].find(
				(timer) => timer.delay === 5_000,
			);
			expect(startTimer).toBeDefined();
			startTimer?.callback();

			await expect(stalledSpeak).rejects.toThrow(
				"Browser speech synthesis did not start within 5 seconds",
			);
			expect(cancelCalls).toBe(1);
			expect(timers.size).toBe(0);

			await impl.speak("Recovered utterance");

			expect(speakCalls).toBe(2);
			expect(timers.size).toBe(0);
		} finally {
			(globalThis as any).setTimeout = realSetTimeout;
			(globalThis as any).clearTimeout = realClearTimeout;
		}
	});
});
