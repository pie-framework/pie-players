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
import { ServerTTSProvider } from "@pie-players/tts-client-server";
import { TTSService } from "../src/services/TTSService";
import type { HighlightCoordinatorApi } from "../src/services/interfaces";

const API_ENDPOINT = "https://tts.example.test/api/tts";
const MARKS_URL = "https://cdn.example.test/marks.jsonl";
const AUDIO_URL = "https://cdn.example.test/audio.mp3";

// Plays long enough for the provider's 50ms word ticks: every mark is at 0ms.
class TimedAudio {
	onplay: (() => void) | null = null;
	onplaying: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onpause: (() => void) | null = null;
	volume = 1;
	playbackRate = 1;
	currentTime = 0;
	constructor(public src: string) {}
	play(): Promise<void> {
		queueMicrotask(() => {
			this.currentTime = 1;
			this.onplay?.();
			this.onplaying?.();
			setTimeout(() => this.onended?.(), 120);
		});
		return Promise.resolve();
	}
	pause(): void {}
}

const firstWordMark = (text: string) => {
	const word = text.trim().split(/\s+/)[0] ?? "";
	const start = text.indexOf(word);
	return { time: 0, type: "word", start, end: start + word.length, value: word };
};

let marksFor: (text: string) => boolean = () => true;
let lastRequestText = "";
const originalFetch = globalThis.fetch;
const originalAudio = (globalThis as { Audio?: unknown }).Audio;

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

beforeEach(() => {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === `${API_ENDPOINT}/synthesize`) {
			const { text } = JSON.parse(String(init?.body));
			return Response.json({
				audio: btoa("audio"),
				contentType: "audio/mpeg",
				speechMarks: marksFor(text) ? [firstWordMark(text)] : [],
			});
		}
		if (url === API_ENDPOINT) {
			lastRequestText = JSON.parse(String(init?.body)).text;
			return Response.json(
				marksFor(lastRequestText)
					? { audioContent: AUDIO_URL, word: MARKS_URL }
					: { audioContent: AUDIO_URL },
			);
		}
		if (url === MARKS_URL) {
			return new Response(`${JSON.stringify(firstWordMark(lastRequestText))}\n`);
		}
		if (url === AUDIO_URL) {
			return new Response(new Blob(["audio"], { type: "audio/mpeg" }));
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	(globalThis as { Audio?: unknown }).Audio = TimedAudio;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	(globalThis as { Audio?: unknown }).Audio = originalAudio;
	document.body.replaceChildren();
});

const recordingCoordinator = () => {
	const words: string[] = [];
	const sentences: string[] = [];
	const coordinator = {
		highlightTTSWord: (ranges: Range[]) => {
			words.push(ranges.map(String).join(""));
		},
		highlightTTSWordElement: () => {},
		// A repaint of the sentence already highlighted is no change.
		highlightTTSSentence: (ranges: Range[]) => {
			const text = ranges.map(String).join("").trim();
			if (sentences.at(-1) !== text) sentences.push(text);
		},
		highlightTTSSentenceElements: () => {},
		clearTTS: () => {},
		clearTTSWord: () => {},
	} as unknown as HighlightCoordinatorApi;
	return { coordinator, words, sentences };
};

const readPassage = async (
	transportMode: "pie" | "custom",
	highlightMode?: "word",
) => {
	const service = new TTSService();
	await service.initialize(new ServerTTSProvider(), {
		apiEndpoint: API_ENDPOINT,
		transportMode,
		endpointMode: transportMode === "pie" ? "synthesizePath" : "rootPost",
		endpointValidationMode: "none",
		...(highlightMode ? { providerOptions: { highlightMode } } : {}),
	} as never);
	const recorder = recordingCoordinator();
	service.setHighlightCoordinator(recorder.coordinator);
	const passage = document.createElement("div");
	passage.innerHTML = "<p>First sentence here.</p><p>Second sentence here.</p>";
	document.body.append(passage);
	await service.speak(passage);
	return recorder;
};

describe.each(["pie", "custom"] as const)(
	"server highlighting on the %s transport",
	(transportMode) => {
		test("a response with speech marks highlights its words", async () => {
			marksFor = () => true;
			const { words, sentences } = await readPassage(transportMode);

			expect(words).toEqual(["First", "Second"]);
			expect(sentences).toEqual([
				"First sentence here.",
				"Second sentence here.",
			]);
		});

		test("a response without speech marks highlights each sentence", async () => {
			marksFor = () => false;
			const { words, sentences } = await readPassage(transportMode);

			expect(words).toEqual([]);
			expect(sentences).toEqual([
				"First sentence here.",
				"Second sentence here.",
			]);
		});

		test("the choice is per response", async () => {
			marksFor = (text) => text.startsWith("First");
			const { words, sentences } = await readPassage(transportMode);

			expect(words).toEqual(["First"]);
			expect(sentences).toEqual([
				"First sentence here.",
				"Second sentence here.",
			]);
		});

		test("explicit word mode falls back to sentences without speech marks", async () => {
			marksFor = () => false;
			const { words, sentences } = await readPassage(transportMode, "word");

			expect(words).toEqual([]);
			expect(sentences).toEqual([
				"First sentence here.",
				"Second sentence here.",
			]);
		});
	},
);
