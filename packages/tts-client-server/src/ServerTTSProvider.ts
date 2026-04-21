/**
 * ServerTTSProvider - Client-side TTS provider that calls server API
 *
 * Provides high-quality TTS by calling a server-side API that uses
 * providers like AWS Polly, Google Cloud TTS, etc.
 * Returns audio with precise word-level timing (speech marks).
 */

import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

/**
 * Configuration for ServerTTSProvider
 */
export interface ServerTTSProviderConfig extends TTSConfig {
	/** API endpoint base URL (e.g., '/api/tts' or 'https://api.example.com/tts') */
	apiEndpoint: string;

	/** Provider to use on server ('polly', 'google', 'elevenlabs', etc.) */
	provider?: string;

	/** Authentication token or API key */
	authToken?: string;

	/** Custom headers for API requests */
	headers?: Record<string, string>;

	/** Language code */
	language?: string;

	/** Polly engine selection when provider is AWS Polly */
	engine?: "standard" | "neural";

	/** Volume level 0-1 */
	volume?: number;

	/**
	 * Transport mode determines request/response translation strategy.
	 * - pie: POST {apiEndpoint}/synthesize, expects inline base64 audio + speech marks
	 * - custom: POST root endpoint, expects audioContent URL + JSONL speech mark URL
	 */
	transportMode?: "pie" | "custom";

	/**
	 * Endpoint mode for synthesis requests.
	 * - synthesizePath: append /synthesize to apiEndpoint
	 * - rootPost: POST directly to apiEndpoint
	 */
	endpointMode?: "synthesizePath" | "rootPost";

	/**
	 * Endpoint validation mode used during initialize(validateEndpoint=true).
	 * - voices: probe {apiEndpoint}/voices
	 * - endpoint: probe resolved synthesis endpoint
	 * - none: skip endpoint probe
	 */
	endpointValidationMode?: "voices" | "endpoint" | "none";

	/**
	 * Include auth headers when fetching custom-transport speech marks and audio URLs.
	 * Defaults to false for compatibility.
	 */
	includeAuthOnAssetFetch?: boolean;

	/**
	 * Origins that are trusted to receive the provider's `Authorization`
	 * header (and any `authToken`-derived credentials). When an asset URL
	 * returned by the TTS server falls outside this list, auth is scrubbed
	 * before the fetch. Malformed or non-http(s) URLs are always rejected
	 * and the fetch is skipped.
	 *
	 * Defaults to the origin of `apiEndpoint` so same-origin / same-host
	 * responses keep working without explicit configuration.
	 */
	assetOrigins?: string[];

	/**
	 * Validate API endpoint availability during initialization (slower but safer)
	 *
	 * @extension Performance vs safety tradeoff
	 * @default false (fast initialization, fail on first synthesis if unavailable)
	 * @note When true, adds 100-500ms to initialization time
	 */
	validateEndpoint?: boolean;
}

type TelemetryReporter = (
	eventName: string,
	payload?: Record<string, unknown>,
) => void | Promise<void>;

/**
 * Parse a TTS asset URL (speech marks or audio). Rejects anything that is
 * not an absolute http(s) URL; relative URLs are resolved against
 * `apiEndpoint` when it is itself absolute.
 */
function parseAssetUrl(
	rawUrl: string,
	config: ServerTTSProviderConfig,
): URL | null {
	if (typeof rawUrl !== "string" || rawUrl.length === 0) {
		return null;
	}
	try {
		const base =
			typeof config.apiEndpoint === "string" && /^https?:\/\//i.test(config.apiEndpoint)
				? config.apiEndpoint
				: undefined;
		const parsed = base ? new URL(rawUrl, base) : new URL(rawUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Decide whether a parsed asset URL is allowed to receive the provider's
 * `Authorization` header. Defaults to the origin of `apiEndpoint` when
 * `assetOrigins` is not configured.
 */
function isOriginTrustedForAuth(
	url: URL,
	config: ServerTTSProviderConfig,
): boolean {
	const configured = Array.isArray(config.assetOrigins)
		? config.assetOrigins
				.filter((value): value is string => typeof value === "string" && value.length > 0)
				.map((value) => {
					try {
						return new URL(value).origin;
					} catch {
						return value;
					}
				})
		: [];
	if (configured.length === 0) {
		if (
			typeof config.apiEndpoint === "string" &&
			/^https?:\/\//i.test(config.apiEndpoint)
		) {
			try {
				return new URL(config.apiEndpoint).origin === url.origin;
			} catch {
				return false;
			}
		}
		// Relative apiEndpoint (e.g. "/api/tts") implies same-origin usage;
		// only same-origin assets should carry auth.
		return (
			typeof window !== "undefined" &&
			typeof window.location?.origin === "string" &&
			window.location.origin === url.origin
		);
	}
	return configured.includes(url.origin);
}

/**
 * Strip auth-carrying headers when the target origin is not trusted.
 */
function scrubAuthHeaders(
	headers: Record<string, string>,
): Record<string, string> {
	const cleaned: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const lower = key.toLowerCase();
		if (
			lower === "authorization" ||
			lower === "proxy-authorization" ||
			lower === "cookie" ||
			lower.startsWith("x-auth-")
		) {
			continue;
		}
		cleaned[key] = value;
	}
	return cleaned;
}

const getTelemetryReporter = (
	config: ServerTTSProviderConfig,
): TelemetryReporter | undefined => {
	const providerOptions =
		config.providerOptions && typeof config.providerOptions === "object"
			? (config.providerOptions as Record<string, unknown>)
			: {};
	const reporter = providerOptions.__pieTelemetry;
	return typeof reporter === "function"
		? (reporter as TelemetryReporter)
		: undefined;
};

/**
 * Word timing from speech marks
 */
interface WordTiming {
	time: number; // Milliseconds from audio start
	wordIndex: number;
	charIndex: number; // Character position in text
	length: number; // Word length in characters
}

/**
 * Server API response for synthesis
 */
interface SynthesizeAPIResponse {
	audio: string; // Base64 encoded audio
	contentType: string;
	speechMarks: Array<{
		time: number;
		type: string;
		start: number;
		end: number;
		value: string;
	}>;
	metadata: {
		providerId: string;
		voice: string;
		duration: number;
		charCount: number;
		cached: boolean;
	};
}

interface CustomTransportResponse {
	audioContent: string;
	word?: string;
	speechMarks?: Array<{
		time?: number;
		type?: string;
		start?: number;
		end?: number;
		value?: string;
	}>;
}

type NormalizedAudioSource =
	| {
			kind: "base64";
			data: string;
			contentType: string;
	  }
	| {
			kind: "url";
			url: string;
	  };

interface NormalizedSynthesisResult {
	audio: NormalizedAudioSource;
	speechMarks: Array<{
		time: number;
		type: string;
		start: number;
		end: number;
		value: string;
	}>;
}

interface TransportAdapter {
	id: "pie" | "custom";
	resolveSynthesisUrl: (config: ServerTTSProviderConfig) => string;
	buildRequestBody: (text: string, config: ServerTTSProviderConfig) => unknown;
	parseResponse: (
		response: Response,
		config: ServerTTSProviderConfig,
		headers: Record<string, string>,
		signal: AbortSignal,
	) => Promise<NormalizedSynthesisResult>;
}

const MAX_TEXT_LENGTH_BY_MODE: Record<TransportAdapter["id"], number> = {
	pie: 3000,
	custom: 3000,
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const resolveVoicesValidationUrl = (
	config: ServerTTSProviderConfig,
): string => {
	const base = trimTrailingSlash(config.apiEndpoint);
	const provider = (config.provider || "").toLowerCase();
	if (provider === "polly" || provider === "google") {
		return `${base}/${provider}/voices`;
	}
	return `${base}/voices`;
};

const resolveTransportMode = (
	config: ServerTTSProviderConfig,
): TransportAdapter["id"] => {
	if (config.transportMode === "custom") return "custom";
	if (config.transportMode === "pie") return "pie";
	return config.provider === "custom" ? "custom" : "pie";
};

const resolveEndpointMode = (
	config: ServerTTSProviderConfig,
	mode: TransportAdapter["id"],
): NonNullable<ServerTTSProviderConfig["endpointMode"]> => {
	if (config.endpointMode) return config.endpointMode;
	return mode === "custom" ? "rootPost" : "synthesizePath";
};

const resolveValidationMode = (
	config: ServerTTSProviderConfig,
	mode: TransportAdapter["id"],
): NonNullable<ServerTTSProviderConfig["endpointValidationMode"]> => {
	if (config.endpointValidationMode) return config.endpointValidationMode;
	return mode === "custom" ? "none" : "voices";
};

const resolveSpeedRate = (config: ServerTTSProviderConfig): string => {
	const providerOptions = (config.providerOptions || {}) as Record<string, unknown>;
	if (typeof providerOptions.speedRate === "string") {
		return providerOptions.speedRate;
	}
	const rate = Number(config.rate ?? 1);
	if (!Number.isFinite(rate) || rate <= 0.95) return "slow";
	if (rate >= 1.5) return "fast";
	return "medium";
};

const parseJSONLSpeechMarks = (raw: string): NormalizedSynthesisResult["speechMarks"] => {
	const marks: NormalizedSynthesisResult["speechMarks"] = [];
	let fallbackIndex = 0;
	const lines = raw
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line) as Record<string, unknown>;
			const type = typeof parsed.type === "string" ? parsed.type : "word";
			const time =
				typeof parsed.time === "number" && Number.isFinite(parsed.time)
					? parsed.time
					: 0;
			const value = typeof parsed.value === "string" ? parsed.value : "";
			const explicitStart =
				typeof parsed.start === "number" && Number.isFinite(parsed.start)
					? parsed.start
					: null;
			const explicitEnd =
				typeof parsed.end === "number" && Number.isFinite(parsed.end)
					? parsed.end
					: null;
			const start = explicitStart ?? fallbackIndex;
			const computedEnd =
				explicitEnd ??
				(start + Math.max(1, value.length || String(parsed.value || "").length));
			fallbackIndex = Math.max(computedEnd + 1, fallbackIndex);
			marks.push({
				time,
				type,
				start,
				end: computedEnd,
				value,
			});
		} catch {
			// Ignore malformed lines and keep parsing valid marks.
		}
	}
	return marks;
};

const parseInlineSpeechMarks = (
	input: CustomTransportResponse["speechMarks"],
): NormalizedSynthesisResult["speechMarks"] => {
	if (!Array.isArray(input)) return [];
	const marks: NormalizedSynthesisResult["speechMarks"] = [];
	let fallbackIndex = 0;
	for (const entry of input) {
		if (!entry || typeof entry !== "object") continue;
		const type = typeof entry.type === "string" ? entry.type : "word";
		const time =
			typeof entry.time === "number" && Number.isFinite(entry.time)
				? entry.time
				: 0;
		const value = typeof entry.value === "string" ? entry.value : "";
		const explicitStart =
			typeof entry.start === "number" && Number.isFinite(entry.start)
				? entry.start
				: null;
		const explicitEnd =
			typeof entry.end === "number" && Number.isFinite(entry.end)
				? entry.end
				: null;
		const start = explicitStart ?? fallbackIndex;
		const end =
			explicitEnd ?? (start + Math.max(1, value.length || 1));
		fallbackIndex = Math.max(fallbackIndex, end + 1);
		marks.push({ time, type, start, end, value });
	}
	return marks.sort((left, right) => {
		if (left.time !== right.time) return left.time - right.time;
		if (left.start !== right.start) return left.start - right.start;
		return left.end - right.end;
	});
};

const pieAdapter: TransportAdapter = {
	id: "pie",
	resolveSynthesisUrl: (config) => {
		const endpointMode = resolveEndpointMode(config, "pie");
		const base = trimTrailingSlash(config.apiEndpoint);
		return endpointMode === "rootPost" ? base : `${base}/synthesize`;
	},
	buildRequestBody: (text, config) => {
		const providerOptions = (config.providerOptions ||
			{}) as Record<string, unknown>;
		const engine =
			typeof config.engine === "string"
				? config.engine
				: typeof providerOptions.engine === "string"
					? providerOptions.engine
					: undefined;
		const sampleRate =
			typeof providerOptions.sampleRate === "number" &&
			Number.isFinite(providerOptions.sampleRate)
				? providerOptions.sampleRate
				: undefined;
		const format =
			providerOptions.format === "mp3" ||
			providerOptions.format === "ogg" ||
			providerOptions.format === "pcm"
				? providerOptions.format
				: undefined;
		const speechMarkTypes = Array.isArray(providerOptions.speechMarkTypes)
			? providerOptions.speechMarkTypes.filter(
					(entry): entry is "word" | "sentence" | "ssml" =>
						entry === "word" || entry === "sentence" || entry === "ssml",
				)
			: undefined;
		return {
			text,
			provider: config.provider || "polly",
			voice: config.voice,
			language: config.language,
			rate: config.rate,
			engine,
			sampleRate,
			format,
			speechMarkTypes,
			includeSpeechMarks: true,
		};
	},
	parseResponse: async (response) => {
		const data: SynthesizeAPIResponse = await response.json();
		return {
			audio: {
				kind: "base64",
				data: data.audio,
				contentType: data.contentType,
			},
			speechMarks: Array.isArray(data.speechMarks) ? data.speechMarks : [],
		};
	},
};

const customAdapter: TransportAdapter = {
	id: "custom",
	resolveSynthesisUrl: (config) => {
		const endpointMode = resolveEndpointMode(config, "custom");
		const base = trimTrailingSlash(config.apiEndpoint);
		return endpointMode === "synthesizePath" ? `${base}/synthesize` : base;
	},
	buildRequestBody: (text, config) => {
		const providerOptions = (config.providerOptions || {}) as Record<string, unknown>;
		const langId =
			typeof providerOptions.lang_id === "string"
				? providerOptions.lang_id
				: config.language || "en-US";
		const cache =
			typeof providerOptions.cache === "boolean" ? providerOptions.cache : true;
		return {
			text,
			speedRate: resolveSpeedRate(config),
			lang_id: langId,
			cache,
		};
	},
	parseResponse: async (response, config, headers, signal) => {
		const data: CustomTransportResponse = await response.json();
		const marksHeaders: Record<string, string> = {};
		if (config.includeAuthOnAssetFetch) {
			for (const [key, value] of Object.entries(headers)) {
				if (key.toLowerCase() === "authorization") {
					marksHeaders[key] = value;
				}
			}
		}
		let speechMarks: NormalizedSynthesisResult["speechMarks"] = [];
		const inlineSpeechMarks = parseInlineSpeechMarks(data.speechMarks);
		if (inlineSpeechMarks.length > 0) {
			speechMarks = inlineSpeechMarks;
		} else if (typeof data.word === "string" && data.word.length > 0) {
			const marksUrl = parseAssetUrl(data.word, config);
			if (marksUrl !== null) {
				const effectiveMarksHeaders = isOriginTrustedForAuth(marksUrl, config)
					? marksHeaders
					: scrubAuthHeaders(marksHeaders);
				const marksResponse = await fetch(marksUrl.toString(), {
					headers: effectiveMarksHeaders,
					signal,
					// Fail loud on redirects; the origin allow-list decision
					// is made pre-redirect and a silent hop could leak auth
					// to an unlisted origin.
					redirect: "error",
				});
				if (marksResponse.ok) {
					const marksRaw = await marksResponse.text();
					speechMarks = parseJSONLSpeechMarks(marksRaw);
				}
			}
		}
		const parsedAudioUrl = parseAssetUrl(data.audioContent, config);
		if (parsedAudioUrl === null) {
			throw new Error("TTS server returned an invalid audio URL");
		}
		return {
			audio: {
				kind: "url",
				url: parsedAudioUrl.toString(),
			},
			speechMarks,
		};
	},
};

const ADAPTERS: Record<TransportAdapter["id"], TransportAdapter> = {
	pie: pieAdapter,
	custom: customAdapter,
};

/**
 * Provider implementation that handles audio playback
 */
class ServerTTSProviderImpl implements ITTSProviderImplementation {
	private config: ServerTTSProviderConfig;
	private adapter: TransportAdapter;
	private currentAudio: HTMLAudioElement | null = null;
	private pausedState = false;
	private wordTimings: WordTiming[] = [];
	private highlightInterval: number | null = null;
	private intentionallyStopped = false;
	private activeSynthesisController: AbortController | null = null;
	private synthesisRunId = 0;
	private readonly telemetryReporter: TelemetryReporter | undefined;

	public onWordBoundary?: (
		word: string,
		position: number,
		length?: number,
	) => void;

	constructor(config: ServerTTSProviderConfig, adapter: TransportAdapter) {
		this.config = config;
		this.adapter = adapter;
		this.telemetryReporter = getTelemetryReporter(config);
	}

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.telemetryReporter?.(eventName, payload);
		} catch (error) {
			console.warn("[ServerTTSProvider] telemetry callback failed:", error);
		}
	}

	async speak(text: string): Promise<void> {
		// Stop any current playback
		this.stop();

		// Reset intentionally stopped flag for new playback
		this.intentionallyStopped = false;
		const runId = ++this.synthesisRunId;
		const synthesisController = new AbortController();
		this.activeSynthesisController = synthesisController;

		// Call server API to synthesize speech
		const { audioUrl, wordTimings } = await this.synthesizeSpeech(
			text,
			synthesisController.signal,
			runId,
		);
		if (runId !== this.synthesisRunId) {
			URL.revokeObjectURL(audioUrl);
			return;
		}

		// Adjust word timing for playback rate
		// Speech marks are at 1.0x speed, so we need to scale them
		const playbackRate = this.config.rate || 1.0;
		this.wordTimings = wordTimings.map((timing) => ({
			...timing,
			time: timing.time / playbackRate,
		}));

		return new Promise((resolve, reject) => {
			// Create audio element
			const audio = new Audio(audioUrl);
			this.currentAudio = audio;

			// Apply rate from config
			if (this.config.rate) {
				audio.playbackRate = Math.max(0.25, Math.min(4.0, this.config.rate));
			}

			// Apply volume from config
			if (this.config.volume !== undefined) {
				audio.volume = Math.max(0, Math.min(1, this.config.volume));
			}

			// Setup event handlers
			audio.onplay = () => {
				this.pausedState = false;

				// Start word highlighting
				if (this.onWordBoundary && this.wordTimings.length > 0) {
					this.startWordHighlighting();
				}
			};

			audio.onended = () => {
				this.stopWordHighlighting();
				URL.revokeObjectURL(audioUrl);
				this.currentAudio = null;
				this.wordTimings = [];
				resolve();
			};

			audio.onerror = (event) => {
				this.stopWordHighlighting();
				URL.revokeObjectURL(audioUrl);
				this.currentAudio = null;
				this.wordTimings = [];
				void event;
				// Only reject if this wasn't an intentional stop
				if (!this.intentionallyStopped) {
					reject(new Error("Failed to play audio from server"));
				} else {
					// Intentional stop, resolve normally
					resolve();
				}
			};

			audio.onpause = () => {
				this.stopWordHighlighting();
				this.pausedState = true;
			};

			// Start playback
			audio.play().catch(reject);
		});
	}

	/**
	 * Call server API to synthesize speech
	 */
	private async synthesizeSpeech(
		text: string,
		signal: AbortSignal,
		runId: number,
	): Promise<{ audioUrl: string; wordTimings: WordTiming[] }> {
		const synthStartedAt = Date.now();
		await this.emitTelemetry("pie-tool-backend-call-start", {
			toolId: "tts",
			backend: this.config.provider || "server",
			operation: "synthesize-speech",
		});
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...this.config.headers,
		};

		// Add authentication if provided
		if (this.config.authToken) {
			headers["Authorization"] = `Bearer ${this.config.authToken}`;
		}

		const synthUrl = this.adapter.resolveSynthesisUrl(this.config);
		const requestBody = this.adapter.buildRequestBody(text, this.config);
		const response = await (async () => {
			try {
				return await fetch(synthUrl, {
					method: "POST",
					headers,
					body: JSON.stringify(requestBody),
					signal,
				});
			} catch (error) {
				await this.emitTelemetry("pie-tool-backend-call-error", {
					toolId: "tts",
					backend: this.config.provider || "server",
					operation: "synthesize-speech",
					duration: Date.now() - synthStartedAt,
					errorType: "TTSBackendNetworkError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		})();

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage =
				errorData.message ||
				errorData.error?.message ||
				`Server returned ${response.status}`;
			await this.emitTelemetry("pie-tool-backend-call-error", {
				toolId: "tts",
				backend: this.config.provider || "server",
				operation: "synthesize-speech",
				duration: Date.now() - synthStartedAt,
				statusCode: response.status,
				errorType: "TTSBackendRequestError",
				message: errorMessage,
			});
			throw new Error(errorMessage);
		}

		const normalized = await this.adapter.parseResponse(
			response,
			this.config,
			headers,
			signal,
		);
		if (runId !== this.synthesisRunId || signal.aborted) {
			throw new Error("Synthesis superseded by a newer request");
		}

		let audioBlob: Blob;
		if (normalized.audio.kind === "base64") {
			audioBlob = this.base64ToBlob(
				normalized.audio.data,
				normalized.audio.contentType,
			);
		} else {
			const audioAssetUrl = normalized.audio.url;
			const assetFetchStartedAt = Date.now();
			await this.emitTelemetry("pie-tool-backend-call-start", {
				toolId: "tts",
				backend: this.config.provider || "server",
				operation: "fetch-synthesized-audio-asset",
			});
			const assetHeaders: Record<string, string> = {};
			if (this.config.includeAuthOnAssetFetch) {
				if (this.config.authToken) {
					assetHeaders["Authorization"] = `Bearer ${this.config.authToken}`;
				}
			}
			const parsedAssetUrl = parseAssetUrl(audioAssetUrl, this.config);
			if (parsedAssetUrl === null) {
				await this.emitTelemetry("pie-tool-backend-call-error", {
					toolId: "tts",
					backend: this.config.provider || "server",
					operation: "fetch-synthesized-audio-asset",
					duration: Date.now() - assetFetchStartedAt,
					errorType: "TTSAssetInvalidUrl",
					message: "TTS asset URL rejected (non-http(s) or malformed)",
				});
				throw new Error("TTS asset URL rejected (non-http(s) or malformed)");
			}
			const effectiveAssetHeaders = isOriginTrustedForAuth(
				parsedAssetUrl,
				this.config,
			)
				? assetHeaders
				: scrubAuthHeaders(assetHeaders);
			const audioResponse = await (async () => {
				try {
					return await fetch(parsedAssetUrl.toString(), {
						headers: effectiveAssetHeaders,
						signal,
						redirect: "error",
					});
				} catch (error) {
					await this.emitTelemetry("pie-tool-backend-call-error", {
						toolId: "tts",
						backend: this.config.provider || "server",
						operation: "fetch-synthesized-audio-asset",
						duration: Date.now() - assetFetchStartedAt,
						errorType: "TTSAssetNetworkError",
						message: error instanceof Error ? error.message : String(error),
					});
					throw error;
				}
			})();
			if (!audioResponse.ok) {
				await this.emitTelemetry("pie-tool-backend-call-error", {
					toolId: "tts",
					backend: this.config.provider || "server",
					operation: "fetch-synthesized-audio-asset",
					duration: Date.now() - assetFetchStartedAt,
					statusCode: audioResponse.status,
					errorType: "TTSAssetFetchError",
					message: `Failed to download synthesized audio (${audioResponse.status})`,
				});
				throw new Error(
					`Failed to download synthesized audio (${audioResponse.status})`,
				);
			}
			audioBlob = await audioResponse.blob();
			await this.emitTelemetry("pie-tool-backend-call-success", {
				toolId: "tts",
				backend: this.config.provider || "server",
				operation: "fetch-synthesized-audio-asset",
				duration: Date.now() - assetFetchStartedAt,
			});
		}
		const audioUrl = URL.createObjectURL(audioBlob);

		// Convert speech marks to word timings
		const wordTimings = this.parseSpeechMarks(normalized.speechMarks);
		await this.emitTelemetry("pie-tool-backend-call-success", {
			toolId: "tts",
			backend: this.config.provider || "server",
			operation: "synthesize-speech",
			duration: Date.now() - synthStartedAt,
		});

		return { audioUrl, wordTimings };
	}

	/**
	 * Convert base64 to Blob
	 */
	private base64ToBlob(base64: string, contentType: string): Blob {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);

		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray], { type: contentType });
	}

	/**
	 * Parse speech marks into word timings
	 */
	private parseSpeechMarks(
		marks: SynthesizeAPIResponse["speechMarks"],
	): WordTiming[] {
		return marks
			.filter((mark) => mark.type === "word")
			.map((mark, index) => ({
				time: mark.time,
				wordIndex: index,
				charIndex: mark.start,
				length: mark.end - mark.start,
			}));
	}

	/**
	 * Start word highlighting synchronized with audio playback
	 */
	private startWordHighlighting(): void {
		this.stopWordHighlighting();

		if (
			!this.currentAudio ||
			!this.onWordBoundary ||
			this.wordTimings.length === 0
		) {
			console.log("[ServerTTSProvider] Cannot start highlighting:", {
				hasAudio: !!this.currentAudio,
				hasCallback: !!this.onWordBoundary,
				wordTimingsCount: this.wordTimings.length,
			});
			return;
		}

		console.log(
			"[ServerTTSProvider] Starting word highlighting with",
			this.wordTimings.length,
			"word timings",
		);
		console.log(
			"[ServerTTSProvider] Playback rate:",
			this.currentAudio.playbackRate,
		);
		console.log(
			"[ServerTTSProvider] First 3 timings:",
			this.wordTimings.slice(0, 3),
		);

		let lastWordIndex = -1;

		// Poll every 50ms to check current playback time
		this.highlightInterval = window.setInterval(() => {
			if (!this.currentAudio) {
				this.stopWordHighlighting();
				return;
			}

			// Get current playback time in milliseconds
			const currentTime = this.currentAudio.currentTime * 1000;

			// Find words that should be highlighted at current time
			for (let i = 0; i < this.wordTimings.length; i++) {
				const timing = this.wordTimings[i];

				if (currentTime >= timing.time && i > lastWordIndex) {
					// Fire word boundary callback
					if (this.onWordBoundary) {
						console.log(
							"[ServerTTSProvider] Highlighting word at charIndex:",
							timing.charIndex,
							"length:",
							timing.length,
							"time:",
							timing.time,
							"currentTime:",
							currentTime,
						);
						// Pass the length as the "word" parameter so TTSService can use it
						this.onWordBoundary("", timing.charIndex, timing.length);
					}
					lastWordIndex = i;
					break;
				}
			}
		}, 50); // 50ms polling = 20 times per second
	}

	/**
	 * Stop word highlighting
	 */
	private stopWordHighlighting(): void {
		if (this.highlightInterval !== null) {
			clearInterval(this.highlightInterval);
			this.highlightInterval = null;
		}
	}

	pause(): void {
		if (this.currentAudio && !this.pausedState) {
			this.currentAudio.pause();
			this.stopWordHighlighting();
			this.pausedState = true;
		}
	}

	resume(): void {
		if (this.currentAudio && this.pausedState) {
			this.currentAudio.play();
			this.pausedState = false;

			// Resume word highlighting
			if (this.onWordBoundary && this.wordTimings.length > 0) {
				this.startWordHighlighting();
			}
		}
	}

	stop(): void {
		this.synthesisRunId += 1;
		if (this.activeSynthesisController) {
			this.activeSynthesisController.abort();
			this.activeSynthesisController = null;
		}
		this.stopWordHighlighting();

		if (this.currentAudio) {
			// Mark as intentionally stopped to prevent error handler from rejecting
			this.intentionallyStopped = true;
			this.currentAudio.pause();
			if (this.currentAudio.src) {
				URL.revokeObjectURL(this.currentAudio.src);
			}
			this.currentAudio.src = "";
			this.currentAudio = null;
		}

		this.pausedState = false;
		this.wordTimings = [];
	}

	isPlaying(): boolean {
		return this.currentAudio !== null && !this.pausedState;
	}

	isPaused(): boolean {
		return this.pausedState;
	}

	/**
	 * Update settings dynamically (rate, pitch, voice)
	 * Note: Voice changes require resynthesis, so voice updates are stored but
	 * take effect on the next speak() call. Rate can be applied to current playback.
	 */
	updateSettings(settings: Partial<ServerTTSProviderConfig>): void {
		// Update config
		if (settings.rate !== undefined) {
			this.config.rate = settings.rate;
			// Apply rate immediately to current playback if active
			if (this.currentAudio) {
				this.currentAudio.playbackRate = Math.max(
					0.25,
					Math.min(4.0, settings.rate),
				);
			}
		}
		if (settings.pitch !== undefined) {
			// Server-side pitch is baked into audio, so this only affects next speak()
			this.config.pitch = settings.pitch;
		}
		if (settings.voice !== undefined) {
			// Voice change requires resynthesis, affects next speak()
			this.config.voice = settings.voice;
		}
	}
}

/**
 * Server TTS Provider
 *
 * Client-side provider that calls a server API for TTS synthesis.
 * The server handles provider selection (Polly, Google, etc.) and credential management.
 */
export class ServerTTSProvider implements ITTSProvider {
	readonly providerId = "server-tts";
	readonly providerName = "Server TTS";
	readonly version = "1.0.0";

	private config: ServerTTSProviderConfig | null = null;
	private adapter: TransportAdapter | null = null;
	private telemetryReporter: TelemetryReporter | undefined;

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.telemetryReporter?.(eventName, payload);
		} catch (error) {
			console.warn("[ServerTTSProvider] telemetry callback failed:", error);
		}
	}

	/**
	 * Initialize the server TTS provider.
	 *
	 * This is designed to be fast by default (no API calls).
	 * Set validateEndpoint: true in config to test API availability during initialization.
	 *
	 * @performance Default: <10ms, With validation: 100-500ms
	 */
	async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
		const serverConfig = config as ServerTTSProviderConfig;

		if (!serverConfig.apiEndpoint) {
			throw new Error("apiEndpoint is required for ServerTTSProvider");
		}

		this.config = serverConfig;
		this.telemetryReporter = getTelemetryReporter(serverConfig);
		const transportMode = resolveTransportMode(serverConfig);
		this.adapter = ADAPTERS[transportMode];

		// Only test API availability if explicitly requested (slower but safer)
		if (serverConfig.validateEndpoint) {
			const validationStartedAt = Date.now();
			await this.emitTelemetry("pie-tool-backend-call-start", {
				toolId: "tts",
				backend: serverConfig.provider || "server",
				operation: "validate-endpoint",
			});
			const available = await this.testAPIAvailability();
			if (!available) {
				await this.emitTelemetry("pie-tool-backend-call-error", {
					toolId: "tts",
					backend: serverConfig.provider || "server",
					operation: "validate-endpoint",
					duration: Date.now() - validationStartedAt,
					errorType: "TTSEndpointValidationError",
					message: `Server TTS API not available at ${serverConfig.apiEndpoint}`,
				});
				throw new Error(
					`Server TTS API not available at ${serverConfig.apiEndpoint}`,
				);
			}
			await this.emitTelemetry("pie-tool-backend-call-success", {
				toolId: "tts",
				backend: serverConfig.provider || "server",
				operation: "validate-endpoint",
				duration: Date.now() - validationStartedAt,
			});
		}

		return new ServerTTSProviderImpl(serverConfig, this.adapter);
	}

	/**
	 * Test if API endpoint is available (with timeout).
	 *
	 * @performance 100-500ms depending on network
	 */
	private async testAPIAvailability(): Promise<boolean> {
		if (!this.config || !this.adapter) return false;

		try {
			const headers: Record<string, string> = { ...this.config.headers };

			if (this.config.authToken) {
				headers["Authorization"] = `Bearer ${this.config.authToken}`;
			}

			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

			const mode = resolveValidationMode(this.config, this.adapter.id);
			if (mode === "none") {
				clearTimeout(timeoutId);
				return true;
			}
			const validationUrl =
				mode === "voices"
					? resolveVoicesValidationUrl(this.config)
					: this.adapter.resolveSynthesisUrl(this.config);
			const method = mode === "voices" ? "GET" : "OPTIONS";
			try {
				const response = await fetch(validationUrl, {
					method,
					headers,
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
				// Some endpoints may not accept OPTIONS; treat 405 as reachable.
				return response.ok || response.status === 405;
			} catch {
				clearTimeout(timeoutId);
				return false;
			}
		} catch {
			return false;
		}
	}

	supportsFeature(feature: TTSFeature): boolean {
		switch (feature) {
			case "pause":
			case "resume":
			case "wordBoundary":
			case "voiceSelection":
			case "rateControl":
				return true;
			case "pitchControl":
				// Depends on server provider, assume no for safety
				return false;
			default:
				return false;
		}
	}

	getCapabilities(): TTSProviderCapabilities {
		const mode = this.config ? resolveTransportMode(this.config) : "pie";
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true, // ✅ Via speech marks from server
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: false, // Depends on server provider
			maxTextLength: MAX_TEXT_LENGTH_BY_MODE[mode],
		};
	}

	destroy(): void {
		this.config = null;
		this.adapter = null;
		this.telemetryReporter = undefined;
	}
}
