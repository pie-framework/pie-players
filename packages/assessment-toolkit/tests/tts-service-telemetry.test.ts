import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { PlaybackState, TTSService } from "../src/services/TTSService";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { contentWith } from "./fixtures/read-aloud-content";

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

class TelemetryMockProvider implements ITTSProvider {
	readonly providerId = "mock";
	readonly providerName = "Mock";
	readonly version = "1.0.0";

	constructor(private impl: ITTSProviderImplementation) {}

	async initialize(_config: TTSConfig): Promise<ITTSProviderImplementation> {
		return this.impl;
	}

	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: true,
		};
	}

	destroy(): void {}
}

class FailingInitializeProvider implements ITTSProvider {
	readonly providerId = "server-tts";
	readonly providerName = "Server TTS";
	readonly version = "1.0.0";

	async initialize(_config: TTSConfig): Promise<ITTSProviderImplementation> {
		throw new Error("Server TTS API not available at /api/tts/sc");
	}

	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: false,
		};
	}

	destroy(): void {}
}

const originalSpeechSynthesis = (globalThis as any).speechSynthesis;
const originalUtterance = (globalThis as any).SpeechSynthesisUtterance;

const installBrowserSpeechMocks = () => {
	class MockSpeechSynthesisUtterance {
		text = "";
		lang = "";
		rate = 1;
		pitch = 1;
		voice: SpeechSynthesisVoice | null = null;
		onstart: ((event: Event) => void) | null = null;
		onend: ((event: Event) => void) | null = null;
		onerror: ((event: Event) => void) | null = null;
		onpause: ((event: Event) => void) | null = null;
		onresume: ((event: Event) => void) | null = null;
		onboundary: ((event: Event) => void) | null = null;

		constructor(text: string) {
			this.text = text;
		}
	}

	const synth = {
		getVoices: () => [],
		speak: (utterance: {
			onstart?: ((event: Event) => void) | null;
			onend?: ((event: Event) => void) | null;
		}) => {
			utterance.onstart?.(new Event("start"));
			setTimeout(() => {
				utterance.onend?.(new Event("end"));
			}, 0);
		},
		cancel: () => {},
		pause: () => {},
		resume: () => {},
	};

	(globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
	// The registered window is `globalThis`, so this is `window.speechSynthesis`.
	(globalThis as any).speechSynthesis = synth;
};

describe("TTSService telemetry", () => {
	afterEach(() => {
		(globalThis as any).speechSynthesis = originalSpeechSynthesis;
		(globalThis as any).SpeechSynthesisUtterance = originalUtterance;
	});

	test("emits playback start and stop events around speak lifecycle", async () => {
		const emitted: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		const impl: ITTSProviderImplementation = {
			speak: async () => {},
			pause: () => {},
			resume: () => {},
			stop: () => {},
			isPlaying: () => false,
			isPaused: () => false,
			updateSettings: () => {},
		};
		const service = new TTSService();
		await service.initialize(new TelemetryMockProvider(impl), {
			providerOptions: {
				__pieTelemetry: (
					eventName: string,
					payload?: Record<string, unknown>,
				) => {
					emitted.push({ eventName, payload });
				},
			},
		});

		await service.speak(contentWith("hello world"));

		expect(emitted.map((entry) => entry.eventName)).toEqual(
			expect.arrayContaining([
				"pie-tool-playback-state-changed",
				"pie-tool-playback-start",
				"pie-tool-playback-stop",
			]),
		);
		expect(
			emitted.some(
				(entry) =>
					entry.eventName === "pie-tool-playback-start" &&
					entry.payload?.toolId === "textToSpeech",
			),
		).toBe(true);
	});

	test("emits playback-error when speak fails", async () => {
		const emitted: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		const impl: ITTSProviderImplementation = {
			speak: async () => {
				throw new Error("synthesize failed");
			},
			pause: () => {},
			resume: () => {},
			stop: () => {},
			isPlaying: () => false,
			isPaused: () => false,
			updateSettings: () => {},
		};
		const service = new TTSService();
		await service.initialize(new TelemetryMockProvider(impl), {
			providerOptions: {
				__pieTelemetry: (
					eventName: string,
					payload?: Record<string, unknown>,
				) => {
					emitted.push({ eventName, payload });
				},
			},
		});

		await expect(service.speak(contentWith("hello world"))).rejects.toThrow(
			"synthesize failed",
		);
		expect(emitted.map((entry) => entry.eventName)).toContain(
			"pie-tool-playback-error",
		);
	});

	test("initialize throws when the provider fails to start, with browser speech available", async () => {
		installBrowserSpeechMocks();
		const emitted: string[] = [];
		const service = new TTSService();
		await expect(
			service.initialize(new FailingInitializeProvider(), {
				providerOptions: {
					__pieTelemetry: (eventName: string) => {
						emitted.push(eventName);
					},
				},
			}),
		).rejects.toThrow("Server TTS API not available at /api/tts/sc");
		await expect(service.speak(contentWith("no provider"))).rejects.toThrow();
		expect(emitted.every((name) => !name.includes("fallback"))).toBe(true);
	});
});
