import { describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { TTSService } from "../src/services/TTSService";

/**
 * A speak's content language reaches the provider as `contentLanguage` only when
 * the speak names one, so the browser voice otherwise follows the browser's
 * language. Text processing reads en-US when nothing names it.
 */

const startService = async () => {
	const settings: Array<Record<string, unknown>> = [];
	const impl: ITTSProviderImplementation & {
		updateSettings: (next: Partial<TTSConfig>) => void;
	} = {
		async speak() {},
		pause() {},
		resume() {},
		stop() {},
		isPlaying: () => false,
		isPaused: () => false,
		updateSettings(next) {
			settings.push({ ...(next.providerOptions as Record<string, unknown>) });
		},
	};
	const provider: ITTSProvider = {
		providerId: "mock",
		providerName: "Mock Provider",
		version: "1.0.0",
		initialize: async () => impl,
		supportsFeature: () => true,
		getCapabilities: () =>
			({
				supportsPause: true,
				supportsResume: true,
				supportsWordBoundary: false,
				supportsVoiceSelection: false,
				supportsRateControl: false,
				supportsPitchControl: false,
			}) as TTSProviderCapabilities,
		destroy() {},
	};
	const service = new TTSService();
	await service.initialize(provider);
	return { service, settings };
};

describe("TTSService content language", () => {
	test("a named language reaches the provider as its content language", async () => {
		const { service, settings } = await startService();

		await service.speak("hola", { language: "es-MX" });

		expect(settings.at(-1)).toMatchObject({
			contentLanguage: "es-MX",
			locale: "es-MX",
		});
	});

	test("an unnamed language leaves the voice to the browser and reads en-US", async () => {
		const { service, settings } = await startService();

		await service.speak("hello", { language: "es-MX" });
		await service.speak("hello");

		const last = settings.at(-1);
		expect(last?.contentLanguage).toBeUndefined();
		expect("contentLanguage" in (last ?? {})).toBe(true);
		expect(last).toMatchObject({
			locale: "en-US",
			textNormalization: { locale: "en-US" },
			segmenter: { locale: "en-US" },
		});
	});
});
