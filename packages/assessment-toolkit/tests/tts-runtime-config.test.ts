import { describe, expect, test } from "bun:test";
import {
	buildRuntimeTTSConfig,
	DEFAULT_TTS_SPEED_OPTIONS,
	formatTTSSpeedOptionsAsText,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedOptions,
	parseTTSSpeedOptionsFromText,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
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

	test("prefers explicit google backend over stale custom provider markers", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "google",
			serverProvider: "custom",
			provider: "custom",
		} as any);
		const backend = resolveTTSBackend(settings);
		const provider = resolveRuntimeProvider(settings, backend);
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(backend).toBe("google");
		expect(provider).toBe("google");
		expect(runtimeConfig.provider).toBe("google");
		expect(runtimeConfig.transportMode).toBe("pie");
	});

	test("prefers explicit polly backend over stale custom provider markers", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "polly",
			serverProvider: "custom",
			provider: "custom",
		} as any);
		const backend = resolveTTSBackend(settings);
		const provider = resolveRuntimeProvider(settings, backend);
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(backend).toBe("polly");
		expect(provider).toBe("polly");
		expect(runtimeConfig.provider).toBe("polly");
		expect(runtimeConfig.transportMode).toBe("pie");
	});

	test("defaults layout mode to expanding-row", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "browser",
		} as any);
		expect(resolveTTSLayoutMode(settings)).toBe("expanding-row");
		expect(resolveTTSHostToolbarLayout(settings)).toEqual({
			mount: "before-buttons",
			controlsRow: {
				reserveSpace: false,
				expandWhenToolActive: true,
			},
		});
	});

	test("maps floating and left-aligned layouts to toolbar overlay mount", () => {
		const floating = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "browser",
			layoutMode: "floating-overlay",
		} as any);
		const left = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "browser",
			layoutMode: "left-aligned",
		} as any);
		expect(resolveTTSHostToolbarLayout(floating)).toEqual({
			mount: "before-buttons",
			controlsRow: {
				reserveSpace: false,
				expandWhenToolActive: false,
			},
		});
		expect(resolveTTSHostToolbarLayout(left)).toEqual({
			mount: "before-buttons",
			controlsRow: {
				reserveSpace: false,
				expandWhenToolActive: false,
			},
		});
	});

	test("normalizes invalid layout modes to expanding-row", () => {
		expect(normalizeTTSLayoutMode("not-a-layout")).toBe("expanding-row");
		expect(
			resolveTTSLayoutMode({ layoutMode: "not-a-layout" as any } as any),
		).toBe("expanding-row");
	});

	test("settings.layoutMode overrides top-level layoutMode when both are provided", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			layoutMode: "reserved-row",
			settings: {
				layoutMode: "floating-overlay",
			},
		} as any);
		expect(resolveTTSLayoutMode(settings)).toBe("floating-overlay");
	});
});

describe("normalizeTTSSpeedOptions", () => {
	test("defaults when omitted or non-array", () => {
		expect(normalizeTTSSpeedOptions(undefined)).toEqual([...DEFAULT_TTS_SPEED_OPTIONS]);
		expect(normalizeTTSSpeedOptions("nope")).toEqual([...DEFAULT_TTS_SPEED_OPTIONS]);
	});

	test("returns empty array for explicit empty input", () => {
		expect(normalizeTTSSpeedOptions([])).toEqual([]);
	});

	test("dedupes and excludes 1.0, preserving order", () => {
		expect(normalizeTTSSpeedOptions([2, 1, 1.5, 2, 0.8])).toEqual([2, 1.5, 0.8]);
	});

	test("falls back to defaults when only invalid or 1.0 remain", () => {
		expect(normalizeTTSSpeedOptions([1, "x", -1])).toEqual([...DEFAULT_TTS_SPEED_OPTIONS]);
	});
});

describe("parseTTSSpeedOptionsFromText / formatTTSSpeedOptionsAsText", () => {
	test("parses comma and semicolon separated values", () => {
		expect(parseTTSSpeedOptionsFromText("0.8, 1.25")).toEqual([0.8, 1.25]);
		expect(parseTTSSpeedOptionsFromText("1.5; 2")).toEqual([1.5, 2]);
	});

	test("empty string means hide speed buttons", () => {
		expect(parseTTSSpeedOptionsFromText("   ")).toEqual([]);
	});

	test("non-empty text with no parseable numbers falls back to defaults", () => {
		expect(parseTTSSpeedOptionsFromText("foo, bar")).toEqual([...DEFAULT_TTS_SPEED_OPTIONS]);
		expect(parseTTSSpeedOptionsFromText(",")).toEqual([...DEFAULT_TTS_SPEED_OPTIONS]);
	});

	test("formats round-trip", () => {
		expect(formatTTSSpeedOptionsAsText([0.8, 1.25])).toBe("0.8, 1.25");
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
