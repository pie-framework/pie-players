import type { SpeedRateBucket } from "@pie-players/pie-tts";
import type {
	TextToSpeechToolProviderConfig,
	ToolProviderConfig,
} from "./tools-config-normalizer.js";
import {
	normalizeSREMathSpeechOptions,
	type SREMathSpeechOptions,
} from "./tts/math-speech.js";
import type { ToolkitTTSConfig } from "./tts/provider-options.js";

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
	controlsRow: {
		reserveSpace: boolean;
		expandWhenToolActive: boolean;
	};
	headerOverlay: {
		expandWhenToolActive: boolean;
	};
}

export interface TTSSpeedOptionConfig {
	rate: number;
	label?: string;
	ariaLabel?: string;
	default?: boolean;
}

export type TTSSpeedOption = number | TTSSpeedOptionConfig;

export interface NormalizedTTSSpeedOption {
	rate: number;
	label: string;
	ariaLabel: string;
	isDefault: boolean;
}

export interface TTSRuntimeSettings {
	/** `browser` speaks through the Web Speech API; `server` through a TTS server. */
	backend?: "browser" | "server";
	/** The service behind a `server` backend. */
	serverProvider?: "polly" | "google" | "custom";
	engine?: "standard" | "neural";
	sampleRate?: number;
	format?: "mp3" | "ogg" | "pcm";
	speechMarksMode?: "word" | "word+sentence";
	defaultVoice?: string;
	rate?: number;
	pitch?: number;
	apiEndpoint?: string;
	/**
	 * The host's locale, used for a read whose content names no language: it
	 * drives text normalization and segmentation, is sent as `language` on the
	 * `pie` transport and as `lang_id` on the `custom` transport when nothing
	 * names a language, and a server given no voice picks one for it. The
	 * content language a read resolves (markup `lang`, the tool's `language`,
	 * the toolkit's `content-language`, then `lang_id`) wins over it.
	 * `docs/architecture/internationalization.md#tts-language` is the contract.
	 */
	language?: string;
	transportMode?: "pie" | "custom";
	endpointMode?: "synthesizePath" | "rootPost";
	/**
	 * The probe the server provider runs before it reports ready: `voices` reads
	 * the voices route, `endpoint` sends OPTIONS to the synthesis route, `none`
	 * probes nothing. Defaults to `voices` on a `server` backend.
	 */
	endpointValidationMode?: "voices" | "endpoint" | "none";
	includeAuthOnAssetFetch?: boolean;
	/** Origins trusted with the `Authorization` header on asset fetches. */
	assetOrigins?: string[];
	/** Fetch `credentials` mode for requests to the TTS server. */
	credentials?: "omit" | "same-origin" | "include";
	/** Headers sent with every request to the TTS server. */
	headers?: Record<string, string>;
	/** Server-side caching, sent on the `custom` transport. */
	cache?: boolean;
	/**
	 * Speed bucket sent on the `custom` transport; derived from `rate` when
	 * unset.
	 */
	speedRate?: SpeedRateBucket;
	/**
	 * The custom transport's locale, sent on every read in place of the content
	 * language. Where markup and the tool name no language it is also the read's
	 * content language, so text processing and catalog lookups follow it. Leave
	 * it unset to let content language reach the service.
	 */
	lang_id?: string;
	/**
	 * Optional inline TTS speed buttons.
	 * - Omitted/non-array: default speed buttons are shown.
	 * - Empty array: hide speed buttons.
	 * - Arrays that sanitize to no valid values: default speed buttons are shown.
	 * - Object entries can customize button text while preserving numeric rates.
	 */
	speedOptions?: TTSSpeedOption[];
	/**
	 * Show a rendered speed group even when there is only one visible option.
	 * Defaults to false because a one-option radio group has no meaningful choice.
	 */
	showSingleSpeedOption?: boolean;
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
	/**
	 * Options passed through to the provider. The fields derived from the
	 * settings above, such as `locale` and the Polly engine, win over these.
	 * The `custom` transport reads the three typed keys; the settings of the
	 * same names win over them.
	 */
	providerOptions?: {
		speedRate?: SpeedRateBucket;
		lang_id?: string;
		cache?: boolean;
		[option: string]: unknown;
	};
}

/** Runtime settings with defaults applied: the layout mode is always known. */
type ResolvedTTSRuntimeSettings = TTSRuntimeSettings & {
	layoutMode: TTSLayoutMode;
};

const toRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const withDefault = <T>(value: T | undefined, fallback: T): T =>
	value === undefined ? fallback : value;

/** A custom server provider speaks the custom transport, as `ServerTTSProvider` does on its own. */
const defaultTransportMode = (config: TTSRuntimeSettings): "pie" | "custom" =>
	resolveTTSBackend(config) === "server" && config.serverProvider === "custom"
		? "custom"
		: "pie";

const normalizeTTSLayoutMode = (value: unknown): TTSLayoutMode =>
	typeof value === "string" &&
	VALID_TTS_LAYOUT_MODES.has(value as TTSLayoutMode)
		? (value as TTSLayoutMode)
		: "left-aligned";

const DEFAULT_TTS_SPEED_CONTROL_OPTIONS = Object.freeze([
	{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
	{ rate: 1, label: "Normal", ariaLabel: "Normal speed", default: true },
	{ rate: 1.25, label: "Fast", ariaLabel: "Fast speed" },
] satisfies TTSSpeedOptionConfig[]);

const normalizeControlSpeedRate = (entry: unknown): number | undefined => {
	if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
		return undefined;
	}
	return Math.round(entry * 100) / 100;
};

const trimOptionalText = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
};

const formatSpeedLabel = (rate: number): string => `${rate}x`;

const formatSpeedAriaLabel = (
	label: string,
	usedDefaultLabel: boolean,
): string =>
	label.toLowerCase() === "normal"
		? "Normal speed"
		: usedDefaultLabel
			? `Speed ${label}`
			: `${label} speed`;

const normalizeSpeedAriaLabel = (
	label: string,
	ariaLabel: string | undefined,
	usedDefaultLabel: boolean,
): string => {
	if (!ariaLabel) return formatSpeedAriaLabel(label, usedDefaultLabel);
	if (ariaLabel.toLowerCase().includes(label.toLowerCase())) return ariaLabel;
	return `${label} ${ariaLabel}`;
};

export const normalizeTTSSpeedControlOptions = (
	value: unknown,
): NormalizedTTSSpeedOption[] => {
	const input = Array.isArray(value)
		? value
		: [...DEFAULT_TTS_SPEED_CONTROL_OPTIONS];
	if (input.length === 0) return [];

	const dedupedRates = new Set<number>();
	const normalized: Array<
		NormalizedTTSSpeedOption & { requestedDefault: boolean }
	> = [];

	for (const entry of input) {
		const record = toRecord(entry);
		const rate =
			typeof entry === "number"
				? normalizeControlSpeedRate(entry)
				: normalizeControlSpeedRate(record.rate);
		if (rate === undefined || dedupedRates.has(rate)) continue;
		dedupedRates.add(rate);

		const defaultLabel = rate === 1 ? "Normal" : formatSpeedLabel(rate);
		const label =
			typeof entry === "number"
				? defaultLabel
				: trimOptionalText(record.label) || defaultLabel;
		const ariaLabel =
			typeof entry === "number"
				? rate === 1
					? "Normal speed"
					: formatSpeedAriaLabel(label, true)
				: normalizeSpeedAriaLabel(
						label,
						trimOptionalText(record.ariaLabel),
						label === defaultLabel,
					);
		normalized.push({
			rate,
			label,
			ariaLabel,
			isDefault: false,
			requestedDefault:
				record.default === true ||
				(record as { isDefault?: unknown }).isDefault === true,
		});
	}

	if (!normalized.length) {
		return normalizeTTSSpeedControlOptions(DEFAULT_TTS_SPEED_CONTROL_OPTIONS);
	}

	if (!dedupedRates.has(1)) {
		const normalOption = {
			rate: 1,
			label: "Normal",
			ariaLabel: "Normal speed",
			isDefault: false,
			requestedDefault: false,
		};
		const firstFasterIndex = normalized.findIndex((option) => option.rate > 1);
		if (firstFasterIndex >= 0) {
			normalized.splice(firstFasterIndex, 0, normalOption);
		} else {
			normalized.push(normalOption);
		}
	}

	const requestedDefaultIndex = normalized.findIndex(
		(option) => option.requestedDefault,
	);
	const defaultIndex =
		requestedDefaultIndex >= 0
			? requestedDefaultIndex
			: normalized.findIndex((option) => option.rate === 1);

	return normalized.map(
		({ requestedDefault: _requestedDefault, ...option }, index) => ({
			...option,
			isDefault: index === defaultIndex,
		}),
	);
};

export const formatTTSSpeedOptionsAsText = (values: number[]): string =>
	values.join(", ");

const DEFAULT_TTS_SPEED_CONTROL_RATES = Object.freeze([0.8, 1, 1.25]);

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
	if (!candidates.length) return [...DEFAULT_TTS_SPEED_CONTROL_RATES];
	const dedupedRates = new Set<number>();
	const normalized: number[] = [];
	for (const candidate of candidates) {
		const rate = normalizeControlSpeedRate(candidate);
		if (rate === undefined || dedupedRates.has(rate)) continue;
		dedupedRates.add(rate);
		normalized.push(rate);
	}
	return normalized.length ? normalized : [...DEFAULT_TTS_SPEED_CONTROL_RATES];
};

const applyRuntimeDefaults = (
	config: TTSRuntimeSettings,
): ResolvedTTSRuntimeSettings => {
	const withLayoutDefaults: ResolvedTTSRuntimeSettings = {
		...config,
		layoutMode: normalizeTTSLayoutMode(config.layoutMode),
	};
	if (config.backend !== "server") return withLayoutDefaults;

	const withServerDefaults: ResolvedTTSRuntimeSettings = {
		...withLayoutDefaults,
		apiEndpoint: withDefault(withLayoutDefaults.apiEndpoint, "/api/tts"),
		transportMode: withDefault(
			withLayoutDefaults.transportMode,
			defaultTransportMode(config),
		),
		endpointValidationMode: withDefault(
			withLayoutDefaults.endpointValidationMode,
			"voices",
		),
		includeAuthOnAssetFetch: withDefault(
			withLayoutDefaults.includeAuthOnAssetFetch,
			false,
		),
		rate: withDefault(withLayoutDefaults.rate, 1.0),
		language: withDefault(withLayoutDefaults.language, "en-US"),
	};

	if (config.serverProvider === "polly") {
		return {
			...withServerDefaults,
			engine: withDefault(withServerDefaults.engine, "neural"),
			format: withDefault(withServerDefaults.format, "mp3"),
			speechMarksMode: withDefault(
				withServerDefaults.speechMarksMode,
				"word+sentence",
			),
		};
	}

	return withServerDefaults;
};

/**
 * The runtime settings of a `textToSpeech` provider entry: its top-level keys
 * with defaults applied, an unknown `layoutMode` resolved to `left-aligned`.
 * `enabled` and the runtime `provider` object belong to the tool registration
 * and are dropped.
 */
export const resolveTTSRuntimeSettings = (
	config:
		| TextToSpeechToolProviderConfig
		| ToolProviderConfig
		| TTSRuntimeSettings
		| undefined,
): TTSRuntimeSettings & { layoutMode: TTSLayoutMode } => {
	const {
		enabled: _enabled,
		provider: _provider,
		...settings
	} = toRecord(config);
	return applyRuntimeDefaults(settings as TTSRuntimeSettings);
};

export const resolveTTSBackend = (
	config: TTSRuntimeSettings,
): NonNullable<TTSRuntimeSettings["backend"]> => config.backend || "browser";

/**
 * The provider configuration built from host settings: the contract's portable
 * fields plus the server adapter's, under the adapter's names.
 */
export type RuntimeTTSConfig = Pick<
	ToolkitTTSConfig,
	"voice" | "rate" | "pitch" | "providerOptions" | "mathTokenHighlighting"
> &
	Pick<
		TTSRuntimeSettings,
		| "apiEndpoint"
		| "language"
		| "transportMode"
		| "endpointMode"
		| "endpointValidationMode"
		| "includeAuthOnAssetFetch"
		| "assetOrigins"
		| "credentials"
		| "headers"
	> & {
		provider?: TTSRuntimeSettings["serverProvider"];
	};

export const buildRuntimeTTSConfig = (
	config: TTSRuntimeSettings,
): RuntimeTTSConfig => {
	const runtimeProvider =
		resolveTTSBackend(config) === "server" ? config.serverProvider : undefined;
	const polly = runtimeProvider === "polly";
	const transportMode = config.transportMode || defaultTransportMode(config);
	const mathSpeech = normalizeSREMathSpeechOptions(config.mathSpeech);
	const runtimeConfig: RuntimeTTSConfig = {
		voice: config.defaultVoice,
		rate: config.rate,
		pitch: config.pitch,
		providerOptions: {
			...toRecord(config.providerOptions),
			...(config.language ? { locale: config.language } : {}),
			...(polly && config.engine
				? { engine: config.engine }
				: {}),
			...(polly && typeof config.sampleRate === "number"
				? { sampleRate: config.sampleRate }
				: {}),
			...(polly && config.format
				? { format: config.format }
				: {}),
			...(polly
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
		assetOrigins: config.assetOrigins,
		credentials: config.credentials,
		headers: config.headers,
		// Toolkit-level highlight setting carried through the config channel
		// (like apiEndpoint/transportMode); consumed by the highlight pipeline,
		// ignored by providers. Only forwarded when set so the pipeline default
		// (per-token enabled) applies otherwise.
		...(typeof config.mathTokenHighlighting === "boolean"
			? { mathTokenHighlighting: config.mathTokenHighlighting }
			: {}),
	};
	// The server adapter owns these fields, `mathTokenHighlighting` aside, which
	// is the toolkit's. Picking them from its config type fails the build when a
	// forwarded field is renamed there or typed differently. The adapter is only
	// a dev dependency here, so it is named only in this body, which declaration
	// emit leaves out (ADR 0002).
	type ServerTTSProviderConfig =
		import("@pie-players/tts-client-server").ServerTTSProviderConfig;
	return runtimeConfig satisfies Partial<
		Pick<
			ServerTTSProviderConfig,
			Exclude<keyof RuntimeTTSConfig, "mathTokenHighlighting">
		>
	>;
};

/** The toolbar layout hints for the layout mode of resolved settings. */
export const resolveTTSHostToolbarLayout = (
	config: { layoutMode: TTSLayoutMode },
): TTSHostToolbarLayout => {
	switch (config.layoutMode) {
		case "reserved-row":
			return {
				controlsRow: {
					reserveSpace: true,
					expandWhenToolActive: false,
				},
				headerOverlay: {
					expandWhenToolActive: false,
				},
			};
		case "expanding-row":
			return {
				controlsRow: {
					reserveSpace: false,
					expandWhenToolActive: true,
				},
				headerOverlay: {
					expandWhenToolActive: false,
				},
			};
		case "floating-overlay":
			return {
				controlsRow: {
					reserveSpace: false,
					expandWhenToolActive: false,
				},
				headerOverlay: {
					expandWhenToolActive: false,
				},
			};
		case "left-aligned":
		default:
			return {
				controlsRow: {
					reserveSpace: false,
					expandWhenToolActive: false,
				},
				headerOverlay: {
					expandWhenToolActive: true,
				},
			};
	}
};
