import type { TTSConfig } from "./TTSService.js";
import type { ToolProviderConfig } from "./tools-config-normalizer.js";

export type TTSLayoutMode =
	| "reserved-row"
	| "expanding-row"
	| "floating-overlay"
	| "left-aligned";

export interface TTSHostToolbarLayout {
	mount: "before-buttons";
	controlsRow: {
		reserveSpace: boolean;
		expandWhenToolActive: boolean;
	};
}

export interface TTSRuntimeSettings {
	backend?: "browser" | "polly" | "google" | "server";
	serverProvider?: "polly" | "google" | "custom";
	provider?: "polly" | "google" | "custom";
	engine?: "standard" | "neural";
	sampleRate?: number;
	format?: "mp3" | "ogg" | "pcm";
	speechMarksMode?: "word" | "word+sentence";
	defaultVoice?: string;
	rate?: number;
	pitch?: number;
	apiEndpoint?: string;
	language?: string;
	transportMode?: "pie" | "custom";
	endpointMode?: "synthesizePath" | "rootPost";
	endpointValidationMode?: "voices" | "endpoint" | "none";
	includeAuthOnAssetFetch?: boolean;
	validateEndpoint?: boolean;
	cache?: boolean;
	speedRate?: "slow" | "medium" | "fast";
	lang_id?: string;
	/**
	 * Optional inline TTS speed buttons.
	 * - Omitted/non-array: default speed buttons are shown.
	 * - Empty array: hide speed buttons.
	 * - Arrays that sanitize to no valid values: default speed buttons are shown.
	 */
	speedOptions?: number[];
	layoutMode?: TTSLayoutMode;
}

const toRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const isServerBackend = (
	backend: TTSRuntimeSettings["backend"],
): backend is "polly" | "google" | "server" =>
	backend === "polly" || backend === "google" || backend === "server";

const withDefault = <T>(value: T | undefined, fallback: T): T =>
	value === undefined ? fallback : value;

const applyRuntimeDefaults = (
	config: TTSRuntimeSettings,
): TTSRuntimeSettings => {
	const withLayoutDefaults: TTSRuntimeSettings = {
		...config,
		layoutMode: withDefault(config.layoutMode, "reserved-row"),
	};
	const backend = config.backend || "browser";
	if (!isServerBackend(backend)) return withLayoutDefaults;

	const withServerDefaults: TTSRuntimeSettings = {
		...withLayoutDefaults,
		apiEndpoint: withDefault(withLayoutDefaults.apiEndpoint, "/api/tts"),
		transportMode: withDefault(withLayoutDefaults.transportMode, "pie"),
		endpointValidationMode: withDefault(
			withLayoutDefaults.endpointValidationMode,
			"voices",
		),
		validateEndpoint: withDefault(withLayoutDefaults.validateEndpoint, true),
		includeAuthOnAssetFetch: withDefault(
			withLayoutDefaults.includeAuthOnAssetFetch,
			false,
		),
		rate: withDefault(withLayoutDefaults.rate, 1.0),
		language: withDefault(withLayoutDefaults.language, "en-US"),
	};

	if (backend === "polly") {
		return {
			...withServerDefaults,
			defaultVoice: withDefault(withServerDefaults.defaultVoice, "Joanna"),
			engine: withDefault(withServerDefaults.engine, "neural"),
			format: withDefault(withServerDefaults.format, "mp3"),
			speechMarksMode: withDefault(
				withServerDefaults.speechMarksMode,
				"word+sentence",
			),
		};
	}

	if (backend === "google") {
		return {
			...withServerDefaults,
			defaultVoice: withDefault(withServerDefaults.defaultVoice, "en-US-Wavenet-A"),
		};
	}

	return withServerDefaults;
};

export const resolveTTSRuntimeSettings = (
	config: ToolProviderConfig | undefined,
): TTSRuntimeSettings => {
	const configRecord = toRecord(config);
	const settingsRecord = toRecord(config?.settings);
	return applyRuntimeDefaults({
		...configRecord,
		...settingsRecord,
	} as TTSRuntimeSettings);
};

export const resolveTTSBackend = (
	config: TTSRuntimeSettings,
): NonNullable<TTSRuntimeSettings["backend"]> => config.backend || "browser";

export const resolveRuntimeProvider = (
	config: TTSRuntimeSettings,
	backend: NonNullable<TTSRuntimeSettings["backend"]>,
): TTSRuntimeSettings["serverProvider"] => {
	if (backend === "polly" || backend === "google") return backend;
	if (backend === "server") {
		return config.serverProvider || config.provider;
	}
	return config.serverProvider || config.provider;
};

export const resolveTransportMode = (
	config: TTSRuntimeSettings,
	runtimeProvider: TTSRuntimeSettings["serverProvider"],
): NonNullable<TTSRuntimeSettings["transportMode"]> =>
	config.transportMode || (runtimeProvider === "custom" ? "custom" : "pie");

export const buildRuntimeTTSConfig = (
	config: TTSRuntimeSettings,
): Partial<TTSConfig> => {
	const backend = resolveTTSBackend(config);
	const runtimeProvider = resolveRuntimeProvider(config, backend);
	const transportMode = resolveTransportMode(config, runtimeProvider);
	return {
		voice: config.defaultVoice,
		rate: config.rate,
		pitch: config.pitch,
		providerOptions: {
			...(config.language ? { locale: config.language } : {}),
			...(backend === "polly" && config.engine ? { engine: config.engine } : {}),
			...(backend === "polly" && typeof config.sampleRate === "number"
				? { sampleRate: config.sampleRate }
				: {}),
			...(backend === "polly" && config.format ? { format: config.format } : {}),
			...(backend === "polly"
				? {
						speechMarkTypes:
							config.speechMarksMode === "word+sentence"
								? ["word", "sentence"]
								: ["word"],
					}
				: {}),
			...(transportMode === "custom" && typeof config.cache === "boolean"
				? { cache: config.cache }
				: {}),
			...(transportMode === "custom" && config.speedRate
				? { speedRate: config.speedRate }
				: {}),
			...(transportMode === "custom" && config.lang_id
				? { lang_id: config.lang_id }
				: {}),
		},
		apiEndpoint: config.apiEndpoint,
		provider: runtimeProvider,
		language: config.language,
		transportMode,
		endpointMode: config.endpointMode,
		endpointValidationMode: config.endpointValidationMode,
		includeAuthOnAssetFetch: config.includeAuthOnAssetFetch,
		validateEndpoint: config.validateEndpoint,
	} as Partial<TTSConfig>;
};

export const resolveTTSLayoutMode = (
	config: TTSRuntimeSettings,
): TTSLayoutMode => config.layoutMode || "reserved-row";

export const resolveTTSHostToolbarLayout = (
	config: TTSRuntimeSettings,
): TTSHostToolbarLayout => {
	const layoutMode = resolveTTSLayoutMode(config);
	switch (layoutMode) {
		case "reserved-row":
			return {
				mount: "before-buttons",
				controlsRow: {
					reserveSpace: true,
					expandWhenToolActive: false,
				},
			};
		case "expanding-row":
			return {
				mount: "before-buttons",
				controlsRow: {
					reserveSpace: false,
					expandWhenToolActive: true,
				},
			};
		case "floating-overlay":
		case "left-aligned":
		default:
			return {
				mount: "before-buttons",
				controlsRow: {
					reserveSpace: false,
					expandWhenToolActive: false,
				},
			};
	}
};
