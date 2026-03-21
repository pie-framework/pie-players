import { SignJWT } from "jose";

import {
	BaseTTSProvider,
	type GetVoicesOptions,
	type ServerProviderCapabilities,
	type SpeechMark,
	type SynthesizeRequest,
	type SynthesizeResponse,
	TTSError,
	TTSErrorCode,
	type TTSServerConfig,
	type Voice,
} from "@pie-players/tts-server-core";

type SchoolCitySpeedRate = "slow" | "medium" | "fast";

type SchoolCitySynthesizeRequest = {
	text: string;
	speedRate: SchoolCitySpeedRate;
	lang_id: string;
	cache: boolean;
	voice?: string;
};

type SchoolCitySynthesizeResponse = {
	audioContent?: unknown;
	word?: unknown;
	message?: unknown;
	error?: unknown;
};

type FetchLike = typeof fetch;

export interface SchoolCityProviderConfig extends TTSServerConfig {
	baseUrl: string;
	apiKey: string;
	issuer: string;
	defaultLanguage?: string;
	defaultSpeedRate?: SchoolCitySpeedRate;
	defaultCache?: boolean;
	requestTimeoutMs?: number;
	fetchImpl?: FetchLike;
}

export interface SchoolCitySynthesizeAssetsResult {
	audioContent: string;
	word: string;
	speechMarks: SpeechMark[];
}

const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_SPEED_RATE: SchoolCitySpeedRate = "medium";
const DEFAULT_CACHE = true;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const asFiniteNumber = (value: unknown): number | null => {
	const next = Number(value);
	return Number.isFinite(next) ? next : null;
};

const sortSpeechMarks = (marks: SpeechMark[]): SpeechMark[] =>
	[...marks].sort((left, right) => {
		if (left.time !== right.time) return left.time - right.time;
		if (left.start !== right.start) return left.start - right.start;
		return left.end - right.end;
	});

const parseResponseBody = async (
	response: Response,
): Promise<Record<string, unknown>> => {
	const raw = await response.text();
	if (!raw) return {};
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return { message: raw };
	}
};

const normalizeEndpoint = (value: string): string => value.replace(/\/+$/, "");

const toSpeedRate = (
	request: SynthesizeRequest,
	fallback: SchoolCitySpeedRate,
): SchoolCitySpeedRate => {
	const providerOptions = (request.providerOptions || {}) as Record<string, unknown>;
	const explicit = providerOptions.speedRate;
	if (explicit === "slow" || explicit === "medium" || explicit === "fast") {
		return explicit;
	}
	const rate = Number(request.rate ?? 1);
	if (!Number.isFinite(rate) || rate <= 0.95) return "slow";
	if (rate >= 1.5) return "fast";
	return fallback;
};

const toLanguage = (
	request: SynthesizeRequest,
	fallback: string,
): string => {
	const providerOptions = (request.providerOptions || {}) as Record<string, unknown>;
	if (typeof providerOptions.lang_id === "string" && providerOptions.lang_id.trim()) {
		return providerOptions.lang_id.trim();
	}
	if (typeof request.language === "string" && request.language.trim()) {
		return request.language.trim();
	}
	return fallback;
};

const toCacheFlag = (
	request: SynthesizeRequest,
	fallback: boolean,
): boolean => {
	const providerOptions = (request.providerOptions || {}) as Record<string, unknown>;
	if (typeof providerOptions.cache === "boolean") {
		return providerOptions.cache;
	}
	return fallback;
};

/**
 * SC wraps incoming content in its own SSML envelope.
 * If caller provides full <speak>...</speak>, send only inner body to avoid nested roots.
 */
const normalizeTextForSchoolCity = (input: string): string => {
	const text = String(input || "").trim();
	if (!text) return text;
	const fullSpeak = /^\s*<speak[\s\S]*<\/speak>\s*$/i;
	if (!fullSpeak.test(text)) return text;
	const withoutOpen = text.replace(/^\s*<speak[^>]*>/i, "");
	return withoutOpen.replace(/<\/speak>\s*$/i, "").trim();
};

const parseWordMarksJsonl = (raw: string): SpeechMark[] => {
	const marks: SpeechMark[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed = JSON.parse(trimmed) as Record<string, unknown>;
			if (parsed.type && parsed.type !== "word") continue;
			const time = asFiniteNumber(parsed.time);
			const start = asFiniteNumber(parsed.start);
			const end = asFiniteNumber(parsed.end);
			if (time === null || start === null || end === null) continue;
			const value = typeof parsed.value === "string" ? parsed.value : "";
			marks.push({
				time,
				type: "word",
				start,
				end,
				value,
			});
		} catch {
			// Ignore malformed JSONL rows while preserving valid marks.
		}
	}
	return sortSpeechMarks(marks);
};

const normalizeMarkTimeUnits = (marks: SpeechMark[]): SpeechMark[] => {
	if (marks.length < 2) return marks;
	const times = marks.map((mark) => mark.time).filter((time) => time >= 0);
	const maxTime = times.length ? Math.max(...times) : 0;
	const deltas: number[] = [];
	for (let index = 1; index < times.length; index += 1) {
		const delta = times[index] - times[index - 1];
		if (delta > 0 && Number.isFinite(delta)) deltas.push(delta);
	}
	const medianDelta =
		deltas.length > 0
			? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]
			: 0;
	const shapeSuggestsSeconds =
		(maxTime > 0 && maxTime < 100 && marks.length > 3) ||
		(medianDelta > 0 && medianDelta < 10);
	if (!shapeSuggestsSeconds) return marks;
	return marks.map((mark) => ({ ...mark, time: mark.time * 1000 }));
};

const estimateOffsetShift = (marks: SpeechMark[], requestText: string): number => {
	if (!marks.length || !requestText.length) return 0;
	const textLower = requestText.toLowerCase();
	const candidates: number[] = [];
	let cursor = 0;
	for (const mark of marks) {
		const token = mark.value.trim().toLowerCase();
		if (!token) continue;
		const found = textLower.indexOf(token, cursor);
		if (found < 0) continue;
		const delta = mark.start - found;
		if (delta >= 0) candidates.push(delta);
		cursor = found + token.length;
		if (candidates.length >= 8) break;
	}
	if (candidates.length > 0) {
		const ordered = [...candidates].sort((a, b) => a - b);
		return ordered[Math.floor(ordered.length / 2)];
	}
	return Math.max(0, Math.floor(marks[0].start));
};

const rebaseOffsetsToRequestText = (
	marks: SpeechMark[],
	requestText: string,
): SpeechMark[] => {
	if (!marks.length || !requestText.length) return marks;
	const textLength = requestText.length;
	const maxEnd = Math.max(...marks.map((mark) => mark.end));
	if (maxEnd <= textLength + 2) return marks;
	const shift = estimateOffsetShift(marks, requestText);
	if (shift <= 0) return marks;
	return marks.map((mark) => ({
		...mark,
		start: mark.start - shift,
		end: mark.end - shift,
	}));
};

const clampMarkRanges = (marks: SpeechMark[], requestText: string): SpeechMark[] => {
	if (!requestText.length) return marks;
	const textLength = requestText.length;
	return sortSpeechMarks(
		marks.map((mark) => {
			const start = Math.max(0, Math.min(textLength, Math.floor(mark.start)));
			const end = Math.max(start + 1, Math.min(textLength, Math.floor(mark.end)));
			return { ...mark, start, end };
		}),
	);
};

const normalizeSpeechMarks = (raw: string, requestText: string): SpeechMark[] => {
	const parsed = parseWordMarksJsonl(raw);
	const withTimes = normalizeMarkTimeUnits(parsed);
	const rebased = rebaseOffsetsToRequestText(withTimes, requestText);
	return clampMarkRanges(rebased, requestText);
};

export class SchoolCityServerProvider extends BaseTTSProvider {
	readonly providerId = "schoolcity-tts";
	readonly providerName = "SchoolCity TTS";
	readonly version = "1.0.0";

	private baseUrl = "";
	private apiKey = "";
	private issuer = "";
	private defaultLanguage = DEFAULT_LANGUAGE;
	private defaultSpeedRate = DEFAULT_SPEED_RATE;
	private defaultCache = DEFAULT_CACHE;
	private requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
	private fetchImpl: FetchLike = fetch;

	async initialize(config: SchoolCityProviderConfig): Promise<void> {
		if (!config.baseUrl?.trim()) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				"SchoolCity baseUrl is required",
				undefined,
				this.providerId,
			);
		}
		if (!config.apiKey?.trim()) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				"SchoolCity apiKey is required",
				undefined,
				this.providerId,
			);
		}
		if (!config.issuer?.trim()) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				"SchoolCity issuer is required",
				undefined,
				this.providerId,
			);
		}

		this.config = config;
		this.baseUrl = normalizeEndpoint(config.baseUrl);
		this.apiKey = config.apiKey;
		this.issuer = config.issuer;
		this.defaultLanguage = config.defaultLanguage || DEFAULT_LANGUAGE;
		this.defaultSpeedRate = config.defaultSpeedRate || DEFAULT_SPEED_RATE;
		this.defaultCache = config.defaultCache ?? DEFAULT_CACHE;
		this.requestTimeoutMs = config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
		this.fetchImpl = config.fetchImpl || fetch;
		this.initialized = true;
	}

	private async toBearerToken(): Promise<string> {
		const secret = new TextEncoder().encode(this.apiKey);
		return new SignJWT({})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuer(this.issuer)
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(secret);
	}

	private buildSchoolCityRequest(
		request: SynthesizeRequest,
	): SchoolCitySynthesizeRequest {
		const text = normalizeTextForSchoolCity(request.text);
		const speedRate = toSpeedRate(request, this.defaultSpeedRate);
		const lang_id = toLanguage(request, this.defaultLanguage);
		const cache = toCacheFlag(request, this.defaultCache);
		const payload: SchoolCitySynthesizeRequest = { text, speedRate, lang_id, cache };
		if (request.voice) payload.voice = request.voice;
		return payload;
	}

	private withTimeout(): { signal: AbortSignal; clear: () => void } {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
		return {
			signal: controller.signal,
			clear: () => clearTimeout(timeout),
		};
	}

	public async synthesizeWithAssets(
		request: SynthesizeRequest,
	): Promise<SchoolCitySynthesizeAssetsResult> {
		this.ensureInitialized();
		this.validateRequest(request, this.getCapabilities());
		const payload = this.buildSchoolCityRequest(request);
		const token = await this.toBearerToken();
		const timeout = this.withTimeout();
		try {
			const response = await this.fetchImpl(this.baseUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(payload),
				signal: timeout.signal,
			});
			const body = (await parseResponseBody(response)) as SchoolCitySynthesizeResponse;
			if (!response.ok) {
				throw new TTSError(
					TTSErrorCode.PROVIDER_ERROR,
					typeof body.message === "string"
						? body.message
						: `SchoolCity synthesis failed (${response.status})`,
					{ status: response.status, body },
					this.providerId,
				);
			}
			const audioContent = typeof body.audioContent === "string" ? body.audioContent : "";
			const word = typeof body.word === "string" ? body.word : "";
			if (!audioContent || !word) {
				throw new TTSError(
					TTSErrorCode.PROVIDER_ERROR,
					"SchoolCity response missing audioContent or word URL",
					{ body },
					this.providerId,
				);
			}

			let speechMarks: SpeechMark[] = [];
			if (request.includeSpeechMarks !== false) {
				const marksResponse = await this.fetchImpl(word, { signal: timeout.signal });
				if (!marksResponse.ok) {
					throw new TTSError(
						TTSErrorCode.PROVIDER_ERROR,
						`SchoolCity marks fetch failed (${marksResponse.status})`,
						{ word, status: marksResponse.status },
						this.providerId,
					);
				}
				const marksRaw = await marksResponse.text();
				speechMarks = normalizeSpeechMarks(marksRaw, payload.text);
			}

			return {
				audioContent,
				word,
				speechMarks,
			};
		} catch (error) {
			if (error instanceof TTSError) throw error;
			const message =
				error instanceof Error ? error.message : "Unknown SchoolCity synthesis error";
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				`SchoolCity synthesis failed: ${message}`,
				{ error },
				this.providerId,
			);
		} finally {
			timeout.clear();
		}
	}

	async synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse> {
		const startedAt = Date.now();
		const { audioContent, speechMarks } = await this.synthesizeWithAssets(request);
		const audioResponse = await this.fetchImpl(audioContent);
		if (!audioResponse.ok) {
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				`Failed to fetch SchoolCity audio asset (${audioResponse.status})`,
				{ audioContent, status: audioResponse.status },
				this.providerId,
			);
		}
		const arrayBuffer = await audioResponse.arrayBuffer();
		const audio = Buffer.from(arrayBuffer);
		return {
			audio,
			contentType: audioResponse.headers.get("content-type") || "audio/mpeg",
			speechMarks,
			metadata: {
				providerId: this.providerId,
				voice: request.voice || "default",
				duration: (Date.now() - startedAt) / 1000,
				charCount: request.text.length,
				cached: false,
				timestamp: new Date().toISOString(),
			},
		};
	}

	async getVoices(_options?: GetVoicesOptions): Promise<Voice[]> {
		this.ensureInitialized();
		return [];
	}

	getCapabilities(): ServerProviderCapabilities {
		return {
			standard: {
				supportsSSML: true,
				supportsPitch: false,
				supportsRate: true,
				supportsVolume: false,
				supportsMultipleVoices: true,
				maxTextLength: 3000,
			},
			extensions: {
				supportsSpeechMarks: true,
				supportedFormats: ["mp3"],
				supportsSampleRate: false,
				providerSpecific: {
					requestModel: "asset-urls",
					requiresSignedJwt: true,
				},
			},
		};
	}
}
