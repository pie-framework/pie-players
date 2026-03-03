import { afterEach, describe, expect, test } from "bun:test";
import { BrowserTTSProvider } from "../src/services/tts/browser-provider";

const originalWindow = (globalThis as any).window;
const originalSpeechSynthesis = (globalThis as any).speechSynthesis;
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
});
