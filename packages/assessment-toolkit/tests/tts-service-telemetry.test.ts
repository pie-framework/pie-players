import { describe, expect, test } from "bun:test";
import { TTSService } from "../src/services/TTSService";
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

describe("TTSService telemetry", () => {
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
});
