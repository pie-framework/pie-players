import type { TTSConfig } from "./TTSService.js";
import type { ToolProviderConfig } from "./tools-config-normalizer.js";
import {
	normalizeSREMathSpeechOptions,
	type SREMathSpeechOptions,
} from "./tts/math-speech.js";

export type TTSLayoutMode =
	| "reserved-row"
	| "expanding-row"
	| "floating-overlay"
	| "left-aligned";

const VALID_TTS_LAYOUT_MODES = new Set<TTSLayoutMode>([
	"reserved-row",
	"expanding-row",
	"floating-overlay",
	"left-aligned",
]);

export interface TTSHostToolbarLayout {
	mount: "before-buttons";
	controlsRow: {
		reserveSpace: boolean;
		expandWhenToolActive: boolean;
	};
}

export interface TTSSpeedOptionConfig {
	rate: number;
	label?: string;
	ariaLabel?: string;
}

export type TTSSpeedOption = number | TTSSpeedOptionConfig;

export interface NormalizedTTSSpeedOption {
	rate: number;
	label: string;
	ariaLabel: string;
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
	 * - Object entries can customize button text while preserving numeric rates.
	 */
	speedOptions?: TTSSpeedOption[];
	layoutMode?: TTSLayoutMode;
	/**
	 * Per-token highlighting of math expressions.
	 * - `true` / omitted (default): when the spoken math aligns confidently to the
	 *   rendered MathML, the formula is highlighted glyph by glyph; otherwise it
	 *   safely falls back to a whole-formula block.
	 * - `false`: every formula is highlighted as a single block (the fallback),
	 *   never broken into per-token highlights. Prose word tracking is unaffected.
	 */
	mathTokenHighlighting?: boolean;
	/**
	 * Speech Rule Engine options for generated MathML speech. Hosts can use these
	 * to tune SRE itself (for example ClearSpeak ImpliedTimes/Paren preferences)
	 * instead of relying on toolkit-specific speech rewrites.
	 */
	mathSpeech?: SREMathSpeechOptions;
}

const toRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const isServerBackend = (
	backend: TTSRuntimeSettings["backend"],
): backend is "polly" | "google" | "server" =>
	backend === "polly" || backend === "google" || backend === "server";

const withDefault = <T>(value: T | undefined, fallback: T): T =>
	value === undefined ? fallback : value;

export const normalizeTTSLayoutMode = (
	value: unknown,
	fallback: TTSLayoutMode = "left-aligned",
): TTSLayoutMode =>
	typeof value === "string" &&
	VALID_TTS_LAYOUT_MODES.has(value as TTSLayoutMode)
		? (value as TTSLayoutMode)
		: fallback;

/** Default inline TTS speed button multipliers (excluding 1.0×). */
export const DEFAULT_TTS_SPEED_OPTIONS = Object.freeze([0.8, 1.25]);

const normalizeSpeedRate = (entry: unknown): number | undefined => {
	if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
		return undefined;
	}
	const rounded = Math.round(entry * 100) / 100;
	return rounded === 1 ? undefined : rounded;
};

const trimOptionalText = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
};

const formatSpeedLabel = (rate: number): string => `${rate}x`;

const formatSpeedAriaLabel = (label: string, usedDefaultLabel: boolean): string =>
	usedDefaultLabel ? `Speed ${label}` : `${label} speed`;

const normalizeSpeedAriaLabel = (
	label: string,
	ariaLabel: string | undefined,
	usedDefaultLabel: boolean,
): string => {
	if (!ariaLabel) return formatSpeedAriaLabel(label, usedDefaultLabel);
	if (ariaLabel.toLowerCase().includes(label.toLowerCase())) return ariaLabel;
	return `${label} ${ariaLabel}`;
};

const normalizeTTSSpeedOptionConfig = (
	entry: unknown,
): TTSSpeedOption | undefined => {
	if (typeof entry === "number") return normalizeSpeedRate(entry);
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
	const record = entry as Record<string, unknown>;
	const rate = normalizeSpeedRate(record.rate);
	if (rate === undefined) return undefined;
	const label = trimOptionalText(record.label);
	const ariaLabel = trimOptionalText(record.ariaLabel);
	return {
		rate,
		...(label ? { label } : {}),
		...(ariaLabel ? { ariaLabel } : {}),
	};
};

export const normalizeTTSSpeedOptionConfigs = (
	value: unknown,
): TTSSpeedOption[] => {
	if (!Array.isArray(value)) return [...DEFAULT_TTS_SPEED_OPTIONS];
	if (value.length === 0) return [];
	const dedupedRates = new Set<number>();
	const normalized: TTSSpeedOption[] = [];
	for (const entry of value) {
		const option = normalizeTTSSpeedOptionConfig(entry);
		if (option === undefined) continue;
		const rate = typeof option === "number" ? option : option.rate;
		if (dedupedRates.has(rate)) continue;
		dedupedRates.add(rate);
		normalized.push(option);
	}
	return normalized.length ? normalized : [...DEFAULT_TTS_SPEED_OPTIONS];
};

/**
 * Resolves inline toolbar speed options from host config.
 * - Omitted/non-array: default speed buttons.
 * - Empty array: hide speed buttons.
 * - Arrays that sanitize to no valid values: default speed buttons.
 * - 1.0× is never shown as a discrete speed button.
 */
export const normalizeTTSSpeedOptions = (value: unknown): number[] => {
	if (!Array.isArray(value)) return [...DEFAULT_TTS_SPEED_OPTIONS];
	if (value.length === 0) return [];
	return normalizeTTSSpeedOptionConfigs(value).map((option) =>
		typeof option === "number" ? option : option.rate,
	);
};

export const normalizeTTSSpeedControlOptions = (
	value: unknown,
): NormalizedTTSSpeedOption[] =>
	normalizeTTSSpeedOptionConfigs(value).map((option) => {
		if (typeof option === "number") {
			const label = formatSpeedLabel(option);
			return {
				rate: option,
				label,
				ariaLabel: formatSpeedAriaLabel(label, true),
			};
		}
		const defaultLabel = formatSpeedLabel(option.rate);
		const label = option.label || defaultLabel;
		return {
			rate: option.rate,
			label,
			ariaLabel: normalizeSpeedAriaLabel(
				label,
				option.ariaLabel,
				label === defaultLabel,
			),
		};
	});

export const formatTTSSpeedOptionsAsText = (values: number[]): string =>
	values.join(", ");

/**
 * Parse comma/semicolon-separated multipliers from settings UI text.
 * - Empty or whitespace-only string → hide speed buttons (`[]`).
 * - Non-empty text with no parseable finite numbers → same as invalid-only array config: defaults.
 */
export const parseTTSSpeedOptionsFromText = (text: string): number[] => {
	const trimmed = text.trim();
	if (!trimmed) return [];
	const parts = trimmed
		.split(/[,;]+/)
		.map((p) => p.trim())
		.filter(Boolean);
	const candidates = parts
		.map((p) => Number.parseFloat(p))
		.filter((n) => Number.isFinite(n));
	if (!candidates.length) return [...DEFAULT_TTS_SPEED_OPTIONS];
	return normalizeTTSSpeedOptions(candidates);
};

const applyRuntimeDefaults = (
	config: TTSRuntimeSettings,
): TTSRuntimeSettings => {
	const withLayoutDefaults: TTSRuntimeSettings = {
		...config,
		layoutMode: normalizeTTSLayoutMode(config.layoutMode),
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
			defaultVoice: withDefault(
				withServerDefaults.defaultVoice,
				"en-US-Wavenet-A",
			),
		};
	}

	return withServerDefaults;
};

export const resolveTTSRuntimeSettings = (
	config: ToolProviderConfig | TTSRuntimeSettings | undefined,
): TTSRuntimeSettings => {
	const configRecord = toRecord(config);
	const settingsRecord = toRecord(configRecord.settings);
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
	const mathSpeech = normalizeSREMathSpeechOptions(config.mathSpeech);
	return {
		voice: config.defaultVoice,
		rate: config.rate,
		pitch: config.pitch,
		providerOptions: {
			...(config.language ? { locale: config.language } : {}),
			...(backend === "polly" && config.engine
				? { engine: config.engine }
				: {}),
			...(backend === "polly" && typeof config.sampleRate === "number"
				? { sampleRate: config.sampleRate }
				: {}),
			...(backend === "polly" && config.format
				? { format: config.format }
				: {}),
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
			...(mathSpeech ? { mathSpeech } : {}),
		},
		apiEndpoint: config.apiEndpoint,
		provider: runtimeProvider,
		language: config.language,
		transportMode,
		endpointMode: config.endpointMode,
		endpointValidationMode: config.endpointValidationMode,
		includeAuthOnAssetFetch: config.includeAuthOnAssetFetch,
		validateEndpoint: config.validateEndpoint,
		// Toolkit-level highlight setting carried through the config channel
		// (like apiEndpoint/transportMode); consumed by the highlight pipeline,
		// ignored by providers. Only forwarded when set so the pipeline default
		// (per-token enabled) applies otherwise.
		...(typeof config.mathTokenHighlighting === "boolean"
			? { mathTokenHighlighting: config.mathTokenHighlighting }
			: {}),
	} as Partial<TTSConfig>;
};

export const resolveTTSLayoutMode = (
	config: TTSRuntimeSettings,
): TTSLayoutMode => normalizeTTSLayoutMode(config.layoutMode);

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
