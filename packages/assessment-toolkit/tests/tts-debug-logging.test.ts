/**
 * Read-aloud traces only while `__PIE_TTS_DEBUG__` (or `PIE_TTS_DEBUG=1`) is
 * set, and reads the flag on each line, so a page can turn tracing on after
 * the toolkit loaded.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ITTSProvider } from "@pie-players/pie-tts";
import { TTSToolProvider } from "../src/services/tool-providers/TTSToolProvider";
import { BrowserTTSProvider } from "../src/services/tts/browser-provider";

const originalWindow = (globalThis as any).window;
const originalSpeechSynthesis = (globalThis as any).speechSynthesis;
const originalUtterance = (globalThis as any).SpeechSynthesisUtterance;
const originalEnvFlag = process.env.PIE_TTS_DEBUG;
const consoleMethods = ["log", "debug", "info"] as const;
const originalConsole = consoleMethods.map((method) => console[method]);

let lines: string[];

beforeEach(() => {
	lines = [];
	delete process.env.PIE_TTS_DEBUG;
	for (const method of consoleMethods) {
		console[method] = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};
	}
	const synth = {
		getVoices: () => [],
		speak: (utterance: SpeechSynthesisUtterance) => {
			utterance.onstart?.({} as SpeechSynthesisEvent);
			utterance.onboundary?.({
				name: "word",
				charIndex: 0,
				charLength: 4,
			} as SpeechSynthesisEvent);
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
});

afterEach(() => {
	consoleMethods.forEach((method, index) => {
		console[method] = originalConsole[index];
	});
	(globalThis as any).__PIE_TTS_DEBUG__ = undefined;
	if (originalEnvFlag === undefined) delete process.env.PIE_TTS_DEBUG;
	else process.env.PIE_TTS_DEBUG = originalEnvFlag;
	(globalThis as any).window = originalWindow;
	(globalThis as any).speechSynthesis = originalSpeechSynthesis;
	(globalThis as any).SpeechSynthesisUtterance = originalUtterance;
});

const readWithBrowserProvider = async () => {
	const impl = await new BrowserTTSProvider().initialize({
		providerOptions: { highlightMode: "word" },
	} as any);
	impl.onWordBoundary = () => {};
	await impl.speak("Read this text");
};

const startAndStopToolProvider = async () => {
	const provider = new TTSToolProvider("browser");
	await provider.initialize({ backend: "browser" });
	provider.destroy();
	const server = new TTSToolProvider("server", {
		loadServerProvider: async () =>
			class {
				readonly providerId = "server-tts";
				readonly providerName = "Stub";
				readonly version = "0";
				initialize = async () => ({}) as never;
				getCapabilities = () => ({}) as never;
				destroy = () => {};
			} as unknown as new () => ITTSProvider,
	});
	await server.initialize({ backend: "server", apiEndpoint: "/api/tts" });
	server.destroy();
};

describe("read-aloud debug logging", () => {
	test("the browser provider traces word boundaries only while the flag is set", async () => {
		await readWithBrowserProvider();
		expect(lines).toEqual([]);

		(globalThis as any).__PIE_TTS_DEBUG__ = true;
		await readWithBrowserProvider();
		expect(lines.length).toBeGreaterThan(0);
		expect(
			lines.every((line) => line.startsWith("[browser-tts-provider]")),
		).toBeTrue();
	});

	test("the tool provider traces its lifecycle only while the flag is set", async () => {
		await startAndStopToolProvider();
		expect(lines).toEqual([]);

		process.env.PIE_TTS_DEBUG = "1";
		await startAndStopToolProvider();
		expect(lines.length).toBeGreaterThan(0);
		expect(
			lines.every((line) => line.startsWith("[tts-tool-provider]")),
		).toBeTrue();
	});
});
