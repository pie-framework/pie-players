import type { TTSConfig } from "./TTSService.js";
import type { ToolProviderConfig } from "./tools-config-normalizer.js";

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
	speedOptions?: number[];
}

const toRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const resolveTTSRuntimeSettings = (
	config: ToolProviderConfig | undefined,
): TTSRuntimeSettings => {
	const configRecord = toRecord(config);
	const settingsRecord = toRecord(config?.settings);
	return { ...configRecord, ...settingsRecord } as TTSRuntimeSettings;
};

export const resolveTTSBackend = (
	config: TTSRuntimeSettings,
): NonNullable<TTSRuntimeSettings["backend"]> => config.backend || "browser";

export const resolveRuntimeProvider = (
	config: TTSRuntimeSettings,
	backend: NonNullable<TTSRuntimeSettings["backend"]>,
): TTSRuntimeSettings["serverProvider"] =>
	config.serverProvider ||
	config.provider ||
	(backend === "polly" || backend === "google" ? backend : undefined);

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
