import { describe, expect, test } from "bun:test";
import {
	buildRuntimeTTSConfig,
	DEFAULT_TTS_SPEED_OPTIONS,
	formatTTSSpeedOptionsAsText,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
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

	test("forwards mathTokenHighlighting only when explicitly set", () => {
		expect(
			buildRuntimeTTSConfig(
				resolveTTSRuntimeSettings({ enabled: true } as any),
			),
		).not.toHaveProperty("mathTokenHighlighting");

		expect(
			buildRuntimeTTSConfig(
				resolveTTSRuntimeSettings({
					enabled: true,
					mathTokenHighlighting: false,
				} as any),
			),
		).toMatchObject({ mathTokenHighlighting: false });

		expect(
			buildRuntimeTTSConfig(
				resolveTTSRuntimeSettings({
					enabled: true,
					mathTokenHighlighting: true,
				} as any),
			),
		).toMatchObject({ mathTokenHighlighting: true });
	});

	test("forwards math speech SRE style through providerOptions", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				settings: {
					mathSpeech: {
						domain: "clearspeak",
						style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
					},
				},
			} as any),
		);

		expect(runtimeConfig.providerOptions).toMatchObject({
			mathSpeech: {
				domain: "clearspeak",
				style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
			},
		});
	});

	test("settings.mathSpeech overrides top-level mathSpeech", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				mathSpeech: { domain: "mathspeak", style: "brief" },
				settings: {
					mathSpeech: {
						domain: "clearspeak",
						style: "Paren_Silent",
					},
				},
			} as any),
		);

		expect(runtimeConfig.providerOptions).toMatchObject({
			mathSpeech: {
				domain: "clearspeak",
				style: "Paren_Silent",
			},
		});
	});

	test("forwards normalized math speech engineOptions", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				settings: {
					mathSpeech: {
						domain: " clearspeak ",
						style: " Paren_Silent ",
						engineOptions: { subiso: "us" },
					},
				},
			} as any),
		);

		expect(runtimeConfig.providerOptions).toMatchObject({
			mathSpeech: {
				domain: "clearspeak",
				style: "Paren_Silent",
				engineOptions: { subiso: "us" },
			},
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

	test("defaults layout mode to left-aligned", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "browser",
		} as any);
		expect(resolveTTSLayoutMode(settings)).toBe("left-aligned");
		expect(resolveTTSHostToolbarLayout(settings)).toEqual({
			mount: "before-buttons",
			controlsRow: {
				reserveSpace: false,
				expandWhenToolActive: false,
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

	test("normalizes invalid layout modes to left-aligned", () => {
		expect(normalizeTTSLayoutMode("not-a-layout")).toBe("left-aligned");
		expect(
			resolveTTSLayoutMode({ layoutMode: "not-a-layout" as any } as any),
		).toBe("left-aligned");
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
		expect(normalizeTTSSpeedOptions(undefined)).toEqual([
			...DEFAULT_TTS_SPEED_OPTIONS,
		]);
		expect(normalizeTTSSpeedOptions("nope")).toEqual([
			...DEFAULT_TTS_SPEED_OPTIONS,
		]);
	});

	test("returns empty array for explicit empty input", () => {
		expect(normalizeTTSSpeedOptions([])).toEqual([]);
	});

	test("dedupes and excludes 1.0, preserving order", () => {
		expect(normalizeTTSSpeedOptions([2, 1, 1.5, 2, 0.8])).toEqual([
			2, 1.5, 0.8,
		]);
	});

	test("falls back to defaults when only invalid or 1.0 remain", () => {
		expect(normalizeTTSSpeedOptions([1, "x", -1])).toEqual([
			...DEFAULT_TTS_SPEED_OPTIONS,
		]);
	});

	test("extracts rates from object-form options for public numeric compatibility", () => {
		expect(
			normalizeTTSSpeedOptions([
				{ rate: 0.8, label: "Slow" },
				{ rate: 1.5, label: "Fast" },
				{ rate: 1.5, label: "Duplicate fast" },
			]),
		).toEqual([0.8, 1.5]);
	});
});

describe("normalizeTTSSpeedControlOptions", () => {
	test("uses visible Normal in the built-in rendered defaults", () => {
		expect(normalizeTTSSpeedControlOptions(undefined)).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed", isDefault: false },
			{
				rate: 1,
				label: "Normal",
				ariaLabel: "Normal speed",
				isDefault: true,
			},
			{ rate: 1.25, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("keeps numeric compatibility helpers separate from rendered radio options", () => {
		expect(normalizeTTSSpeedOptions([0.8, 1, 1.25])).toEqual([0.8, 1.25]);
		expect(normalizeTTSSpeedControlOptions([0.8, 1.25])).toEqual([
			{ rate: 0.8, label: "0.8x", ariaLabel: "Speed 0.8x", isDefault: false },
			{
				rate: 1,
				label: "Normal",
				ariaLabel: "Normal speed",
				isDefault: true,
			},
			{
				rate: 1.25,
				label: "1.25x",
				ariaLabel: "Speed 1.25x",
				isDefault: false,
			},
		]);
	});

	test("preserves host display order and explicit default metadata", () => {
		expect(
			normalizeTTSSpeedControlOptions([
				{ rate: 0.8, label: " Slow ", ariaLabel: " Slow speed " },
				{ rate: 1, label: " Normal ", ariaLabel: " Normal speed ", default: true },
				{ rate: 1.5, label: "Fast" },
				{ rate: 1.5, label: "Duplicate fast" },
				{ rate: Number.NaN, label: "Bad" },
			]),
		).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed", isDefault: false },
			{ rate: 1, label: "Normal", ariaLabel: "Normal speed", isDefault: true },
			{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("keeps visible labels in custom accessible names", () => {
		expect(
			normalizeTTSSpeedControlOptions([
				{ rate: 0.8, label: "Slow", ariaLabel: "Reduced pace" },
				{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed" },
			]),
		).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow Reduced pace", isDefault: false },
			{
				rate: 1,
				label: "Normal",
				ariaLabel: "Normal speed",
				isDefault: true,
			},
			{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("honors a single visible option while marking it as selected", () => {
		expect(normalizeTTSSpeedControlOptions([{ rate: 1, label: "Normal" }])).toEqual([
			{ rate: 1, label: "Normal", ariaLabel: "Normal speed", isDefault: true },
		]);
	});
});

describe("parseTTSSpeedOptionsFromText / formatTTSSpeedOptionsAsText", () => {
	test("parses comma and semicolon separated values", () => {
		expect(parseTTSSpeedOptionsFromText("0.8, 1, 1.25")).toEqual([
			0.8, 1, 1.25,
		]);
		expect(parseTTSSpeedOptionsFromText("1.5; 2")).toEqual([1.5, 2]);
	});

	test("empty string means hide speed buttons", () => {
		expect(parseTTSSpeedOptionsFromText("   ")).toEqual([]);
	});

	test("non-empty text with no parseable numbers falls back to defaults", () => {
		expect(parseTTSSpeedOptionsFromText("foo, bar")).toEqual([
			0.8, 1, 1.25,
		]);
		expect(parseTTSSpeedOptionsFromText(",")).toEqual([
			0.8, 1, 1.25,
		]);
	});

	test("formats round-trip", () => {
		expect(formatTTSSpeedOptionsAsText([0.8, 1, 1.25])).toBe("0.8, 1, 1.25");
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
