import { afterEach, describe, expect, test } from "bun:test";
import { BrowserTTSProvider } from "../src/services/tts/browser-provider";

const originalWindow = (globalThis as any).window;
const originalSpeechSynthesis = (globalThis as any).speechSynthesis;
const originalSpeechSynthesisUtterance = (globalThis as any).SpeechSynthesisUtterance;
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
});
