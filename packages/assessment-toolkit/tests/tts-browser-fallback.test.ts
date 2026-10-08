import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";
import {
	BrowserTTSProvider,
	browserFallbackConfig,
} from "../src/services/tts/browser-provider.js";

/**
 * Browser speech standing in for another provider, and browser speech of an
 * SSML document. A vendor voice such as Polly's "Joanna" resolves to no browser
 * voice, and the Web Speech API reads SSML tags aloud.
 */

type Boundary = { name: string; charIndex: number; charLength: number };

class FakeUtterance {
	text: string;
	voice: SpeechSynthesisVoice | null = null;
	lang = "";
	rate = 1;
	pitch = 1;
	onstart: (() => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	onpause: (() => void) | null = null;
	onresume: (() => void) | null = null;
	onboundary: ((event: Boundary) => void) | null = null;
	constructor(text: string) {
		this.text = text;
	}
}

const globals = globalThis as Record<string, unknown>;
const saved = {
	window: globals.window,
	speechSynthesis: globals.speechSynthesis,
	SpeechSynthesisUtterance: globals.SpeechSynthesisUtterance,
};

let spoken: FakeUtterance[] = [];
let boundariesFor: (utterance: FakeUtterance) => Boundary[] = () => [];
let logSpy: ReturnType<typeof spyOn>;
let warnSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	spoken = [];
	boundariesFor = () => [];
	const synth = {
		getVoices: () => [
			{
				name: "Test Voice",
				voiceURI: "test-voice",
				lang: "en-US",
				default: true,
				localService: true,
			},
		],
		speak: (utterance: FakeUtterance) => {
			spoken.push(utterance);
			utterance.onstart?.();
			for (const boundary of boundariesFor(utterance)) {
				utterance.onboundary?.(boundary);
			}
			utterance.onend?.();
		},
		cancel: () => {},
		pause: () => {},
		resume: () => {},
	};
	globals.speechSynthesis = synth;
	globals.window = { setTimeout, clearTimeout, speechSynthesis: synth };
	globals.SpeechSynthesisUtterance = FakeUtterance;
	logSpy = spyOn(console, "log").mockImplementation(() => {});
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	logSpy.mockRestore();
	warnSpy.mockRestore();
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete globals[key];
		else globals[key] = value;
	}
});

const wordAt = (text: string, word: string): Boundary => ({
	name: "word",
	charIndex: text.indexOf(word),
	charLength: word.length,
});

describe("browserFallbackConfig", () => {
	test("keeps portable settings and drops the voice and vendor options", () => {
		const telemetry = () => {};
		expect(
			browserFallbackConfig({
				voice: "Joanna",
				rate: 1.2,
				pitch: 0.9,
				mathTokenHighlighting: false,
				providerOptions: {
					engine: "neural",
					speechMarkTypes: ["word"],
					lang_id: "en",
					highlightMode: "word",
					locale: "en-US",
					mathSpeech: { domain: "clearspeak" },
					__pieTelemetry: telemetry,
				},
			}),
		).toEqual({
			rate: 1.2,
			pitch: 0.9,
			mathTokenHighlighting: false,
			providerOptions: {
				highlightMode: "word",
				locale: "en-US",
				mathSpeech: { domain: "clearspeak" },
				__pieTelemetry: telemetry,
			},
		});
	});
});

describe("browser speech replacing another provider", () => {
	test("a Polly backend with no tts provider speaks without the Polly voice", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "polly-browser-fallback",
			eagerInit: false,
			toolRegistry: new ToolRegistry(),
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "polly",
						apiEndpoint: "/api/tts",
					},
				},
				placement: { item: ["textToSpeech"] },
			},
		});
		await coordinator.ensureTTSReady();

		await coordinator.ttsService.speak("Hello there");

		expect(spoken.map((utterance) => utterance.text)).toEqual(["Hello there"]);
	});
});

describe("browser speech of an SSML document", () => {
	const ssml =
		'<speak xml:lang="en-US">Question one.<break time="300ms"/>Pick a word.</speak>';

	test("voices the spoken text and reports boundaries in the document", async () => {
		boundariesFor = (utterance) => [wordAt(utterance.text, "Pick")];
		const impl = await new BrowserTTSProvider().initialize({
			providerOptions: { highlightMode: "word" },
		});
		const boundaries: unknown[] = [];
		impl.onWordBoundary = (word, position, length) => {
			boundaries.push({ word, position, length });
		};

		await impl.speak(ssml);

		expect(spoken.map((utterance) => utterance.text)).toEqual([
			"Question one. Pick a word.",
		]);
		expect(boundaries).toEqual([
			{ word: "Pick", position: ssml.indexOf("Pick"), length: 4 },
		]);
	});

	test("places a segment's boundaries after its start offset", async () => {
		boundariesFor = (utterance) => [wordAt(utterance.text, "word")];
		const impl = await new BrowserTTSProvider().initialize({
			providerOptions: { highlightMode: "word" },
		});
		const positions: number[] = [];
		impl.onWordBoundary = (_word, position) => {
			positions.push(position);
		};

		await impl.speakSegments?.([{ text: ssml, startOffset: 40 }]);

		expect(spoken.map((utterance) => utterance.text)).toEqual([
			"Question one. Pick a word.",
		]);
		expect(positions).toEqual([40 + ssml.indexOf("word")]);
	});

	test("passes text that only contains angle brackets through", async () => {
		const impl = await new BrowserTTSProvider().initialize({});

		await impl.speak("3 < 5 and 7 > 2");

		expect(spoken.map((utterance) => utterance.text)).toEqual([
			"3 < 5 and 7 > 2",
		]);
	});
});
