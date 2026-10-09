import { describe, expect, test } from "bun:test";
import {
	buildRuntimeTTSConfig,
	formatTTSSpeedOptionsAsText,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
	parseTTSSpeedOptionsFromText,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSRuntimeSettings,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { ttsToolRegistration } from "../src/registrations/tts.js";

describe("tts-runtime-config defaults", () => {
	test("applies minimal Polly defaults for a Polly server backend", () => {
		const settings = resolveTTSRuntimeSettings({
			enabled: true,
			backend: "server",
			serverProvider: "polly",
			apiEndpoint: "/api/tts",
		});
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(runtimeConfig).toMatchObject({
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

	test("passes host providerOptions through, under the derived fields", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				backend: "server",
				serverProvider: "polly",
				language: "es-ES",
				providerOptions: { highlightMode: "word", locale: "fr-FR" },
			} as any),
		);
		expect(runtimeConfig.providerOptions).toMatchObject({
			highlightMode: "word",
			locale: "es-ES",
			engine: "neural",
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
				mathSpeech: {
					domain: "clearspeak",
					style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
				},
			}),
		);

		expect(runtimeConfig.providerOptions).toMatchObject({
			mathSpeech: {
				domain: "clearspeak",
				style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
			},
		});
	});

	test("forwards normalized math speech engineOptions", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				mathSpeech: {
					domain: " clearspeak ",
					style: " Paren_Silent ",
					engineOptions: { subiso: "us" },
				},
			}),
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
			backend: "server",
			serverProvider: "google",
		});
		const runtimeConfig = buildRuntimeTTSConfig(settings);

		expect(settings.apiEndpoint).toBe("/api/tts");

		expect(runtimeConfig).toMatchObject({
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
			backend: "server",
			serverProvider: "polly",
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
		});
		const runtimeConfig = buildRuntimeTTSConfig(settings);

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

	test("a browser backend carries no server provider or Polly options", () => {
		const runtimeConfig = buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings({
				enabled: true,
				backend: "browser",
				serverProvider: "polly",
				engine: "neural",
			}),
		);

		expect(runtimeConfig.provider).toBeUndefined();
		expect(runtimeConfig.transportMode).toBe("pie");
		expect(runtimeConfig.providerOptions).not.toHaveProperty("engine");
		expect(runtimeConfig.providerOptions).not.toHaveProperty("speechMarkTypes");
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
			headerOverlay: {
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
			headerOverlay: {
				expandWhenToolActive: false,
			},
		});
		expect(resolveTTSHostToolbarLayout(left)).toEqual({
			mount: "before-buttons",
			controlsRow: {
				reserveSpace: false,
				expandWhenToolActive: false,
			},
			headerOverlay: {
				expandWhenToolActive: true,
			},
		});
	});

	test("normalizes invalid layout modes to left-aligned", () => {
		expect(normalizeTTSLayoutMode("not-a-layout")).toBe("left-aligned");
		expect(
			resolveTTSLayoutMode({ layoutMode: "not-a-layout" as any } as any),
		).toBe("left-aligned");
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

	test("adds Normal to host rates that omit it", () => {
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
				{
					rate: 1,
					label: " Normal ",
					ariaLabel: " Normal speed ",
					default: true,
				},
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
			{
				rate: 0.8,
				label: "Slow",
				ariaLabel: "Slow Reduced pace",
				isDefault: false,
			},
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
		expect(
			normalizeTTSSpeedControlOptions([{ rate: 1, label: "Normal" }]),
		).toEqual([
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
		expect(parseTTSSpeedOptionsFromText("foo, bar")).toEqual([0.8, 1, 1.25]);
		expect(parseTTSSpeedOptionsFromText(",")).toEqual([0.8, 1, 1.25]);
	});

	test("formats round-trip", () => {
		expect(formatTTSSpeedOptionsAsText([0.8, 1, 1.25])).toBe("0.8, 1, 1.25");
	});
});

describe("runtime provider object in the provider slot", () => {
	const authFetcher = async () => ({ authToken: "token" });
	const objectProviderConfig = {
		enabled: true,
		backend: "server",
		apiEndpoint: "/api/tts",
		provider: { id: "host-tts", runtime: { authFetcher } },
	};

	test("resolves no provider id without serverProvider", () => {
		const settings = resolveTTSRuntimeSettings(objectProviderConfig);
		const runtimeConfig = buildRuntimeTTSConfig(settings);
		const initConfig =
			ttsToolRegistration.provider?.getInitConfig?.(objectProviderConfig);

		expect(settings).not.toHaveProperty("provider");
		expect(runtimeConfig.provider).toBeUndefined();
		expect(initConfig?.provider).toBeUndefined();
		expect(
			ttsToolRegistration.provider?.getAuthFetcher?.(objectProviderConfig),
		).toBe(authFetcher);
	});

	test("resolves serverProvider as the provider id", () => {
		const config = {
			...objectProviderConfig,
			serverProvider: "custom" as const,
		};
		const settings = resolveTTSRuntimeSettings(config);
		const runtimeConfig = buildRuntimeTTSConfig(settings);
		const initConfig = ttsToolRegistration.provider?.getInitConfig?.(config);

		expect(settings).not.toHaveProperty("provider");
		expect(runtimeConfig.provider).toBe("custom");
		expect(initConfig?.provider).toBe("custom");
		expect(ttsToolRegistration.provider?.getAuthFetcher?.(config)).toBe(
			authFetcher,
		);
	});
});

describe("tts registration auth fetcher behavior", () => {
	test("does not require authFetcher for init config resolution", () => {
		const initConfig = ttsToolRegistration.provider?.getInitConfig?.({
			enabled: true,
			backend: "server",
			serverProvider: "polly",
			apiEndpoint: "/api/tts",
		});
		const authFetcher = ttsToolRegistration.provider?.getAuthFetcher?.({
			enabled: true,
			backend: "server",
			serverProvider: "polly",
			apiEndpoint: "/api/tts",
		});

		expect(initConfig).toBeDefined();
		expect(authFetcher).toBeUndefined();
	});
});
