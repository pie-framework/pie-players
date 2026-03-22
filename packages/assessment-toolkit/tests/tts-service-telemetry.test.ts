import { afterEach, describe, expect, test } from "bun:test";
import { PlaybackState, TTSService } from "../src/services/TTSService";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

class TelemetryMockProvider implements ITTSProvider {
	readonly providerId = "mock";
	readonly providerName = "Mock";
	readonly version = "1.0.0";

	constructor(private impl: ITTSProviderImplementation) {}

	async initialize(_config: TTSConfig): Promise<ITTSProviderImplementation> {
		return this.impl;
	}

	supportsFeature(): boolean {
		return true;
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

const originalWindow = (globalThis as any).window;
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
	(globalThis as any).speechSynthesis = synth;
	(globalThis as any).window = { speechSynthesis: synth };
};

describe("TTSService telemetry", () => {
	afterEach(() => {
		(globalThis as any).window = originalWindow;
		(globalThis as any).speechSynthesis = originalSpeechSynthesis;
		(globalThis as any).SpeechSynthesisUtterance = originalUtterance;
	});

	test("emits playback start and stop events around speak lifecycle", async () => {
		const emitted: Array<{ eventName: string; payload?: Record<string, unknown> }> =
			[];
		const impl: ITTSProviderImplementation = {
			speak: async () => {},
			pause: () => {},
			resume: () => {},
			stop: () => {},
			isPlaying: () => false,
			isPaused: () => false,
		};
		const service = new TTSService();
		await service.initialize(new TelemetryMockProvider(impl), {
			providerOptions: {
				__pieTelemetry: (eventName: string, payload?: Record<string, unknown>) => {
					emitted.push({ eventName, payload });
				},
			},
		});

		await service.speak("hello world");

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
		const emitted: Array<{ eventName: string; payload?: Record<string, unknown> }> =
			[];
		const impl: ITTSProviderImplementation = {
			speak: async () => {
				throw new Error("synthesize failed");
			},
			pause: () => {},
			resume: () => {},
			stop: () => {},
			isPlaying: () => false,
			isPaused: () => false,
		};
		const service = new TTSService();
		await service.initialize(new TelemetryMockProvider(impl), {
			providerOptions: {
				__pieTelemetry: (eventName: string, payload?: Record<string, unknown>) => {
					emitted.push({ eventName, payload });
				},
			},
		});

		await expect(service.speak("hello world")).rejects.toThrow("synthesize failed");
		expect(emitted.map((entry) => entry.eventName)).toContain(
			"pie-tool-playback-error",
		);
	});

	test("falls back to browser provider on server playback outage", async () => {
		installBrowserSpeechMocks();
		const emitted: Array<{ eventName: string; payload?: Record<string, unknown> }> =
			[];
		const failingServerImpl: ITTSProviderImplementation = {
			speak: async () => {
				throw new Error("Server returned 503");
			},
			pause: () => {},
			resume: () => {},
			stop: () => {},
			isPlaying: () => false,
			isPaused: () => false,
		};
		const service = new TTSService();
		await service.initialize(new TelemetryMockProvider(failingServerImpl), {
			providerOptions: {
				__pieTelemetry: (eventName: string, payload?: Record<string, unknown>) => {
					emitted.push({ eventName, payload });
				},
			},
		});

		await expect(service.speak("fallback should succeed")).resolves.toBeUndefined();
		expect(service.getState()).toBe(PlaybackState.IDLE);
		expect(emitted.map((entry) => entry.eventName)).toContain(
			"pie-tool-runtime-fallback",
		);
		expect(
			emitted.some(
				(entry) =>
					entry.eventName === "pie-tool-runtime-fallback" &&
					entry.payload?.toProvider === "browser",
			),
		).toBe(true);
	});
});
