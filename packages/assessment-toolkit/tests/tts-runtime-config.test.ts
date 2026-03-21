import { describe, expect, test } from "bun:test";
import {
	buildRuntimeTTSConfig,
	resolveRuntimeProvider,
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
	resolveTransportMode,
} from "../src/services/tts-runtime-config";
import { ttsToolRegistration } from "../src/tools/registrations/tts";

describe("tts-runtime-config defaults", () => {
	test("applies minimal Polly defaults for server-backed setup", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);
		const backend = resolveTTSBackend(settings);
		const provider = resolveRuntimeProvider(settings, backend);
		const transportMode = resolveTransportMode(settings, provider);
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(backend).toBe("polly");
		expect(provider).toBe("polly");
		expect(transportMode).toBe("pie");

		expect(runtimeConfig).toMatchObject({
			voice: "Joanna",
			rate: 1,
			apiEndpoint: "/api/tts",
			provider: "polly",
			language: "en-US",
			transportMode: "pie",
			endpointValidationMode: "voices",
			validateEndpoint: true,
			includeAuthOnAssetFetch: false,
		});
		expect(runtimeConfig.providerOptions).toMatchObject({
			locale: "en-US",
			engine: "neural",
			format: "mp3",
			speechMarkTypes: ["word", "sentence"],
		});
	});

	test("applies minimal Google defaults including apiEndpoint", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "google",
		} as any);
		const backend = resolveTTSBackend(settings);
		const provider = resolveRuntimeProvider(settings, backend);
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(backend).toBe("google");
		expect(provider).toBe("google");
		expect(settings.apiEndpoint).toBe("/api/tts");

		expect(runtimeConfig).toMatchObject({
			voice: "en-US-Wavenet-A",
			rate: 1,
			apiEndpoint: "/api/tts",
			provider: "google",
			language: "en-US",
			transportMode: "pie",
			endpointValidationMode: "voices",
			validateEndpoint: true,
			includeAuthOnAssetFetch: false,
		});
		expect(runtimeConfig.providerOptions).toMatchObject({
			locale: "en-US",
		});
	});

	test("preserves explicit overrides over defaults", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "polly",
			apiEndpoint: "https://example.com/custom-tts",
			defaultVoice: "Matthew",
			rate: 1.25,
			language: "es-ES",
			engine: "standard",
			format: "ogg",
			speechMarksMode: "word",
			transportMode: "custom",
			endpointValidationMode: "none",
			validateEndpoint: false,
			includeAuthOnAssetFetch: true,
		} as any);
		const backend = resolveTTSBackend(settings);
		const provider = resolveRuntimeProvider(settings, backend);
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(provider).toBe("polly");
		expect(runtimeConfig).toMatchObject({
			voice: "Matthew",
			rate: 1.25,
			apiEndpoint: "https://example.com/custom-tts",
			provider: "polly",
			language: "es-ES",
			transportMode: "custom",
			endpointValidationMode: "none",
			validateEndpoint: false,
			includeAuthOnAssetFetch: true,
		});
		expect(runtimeConfig.providerOptions).toMatchObject({
			locale: "es-ES",
			engine: "standard",
			format: "ogg",
			speechMarkTypes: ["word"],
		});
	});
});

describe("tts registration auth fetcher behavior", () => {
	test("does not require authFetcher for init config resolution", () => {
		const initConfig = ttsToolRegistration.provider?.getInitConfig?.({
			enabled: true,
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);
		const authFetcher = ttsToolRegistration.provider?.getAuthFetcher?.({
			enabled: true,
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);

		expect(initConfig).toBeDefined();
		expect(authFetcher).toBeUndefined();
	});
});
