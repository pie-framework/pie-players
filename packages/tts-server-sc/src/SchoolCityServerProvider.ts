import { SignJWT } from "jose";
import { getDomain } from "tldts";

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
	/**
	 * Explicit allow-list of origins that upstream-returned `audioContent`
	 * and `word` URLs may use. When provided, only exact origin matches
	 * are accepted — this is the tightest setting and recommended for
	 * production (gives an auditable, typo-resistant declaration of
	 * which CDNs the provider is permitted to reach).
	 *
	 * When omitted, the provider falls back to a zero-config default:
	 * allow `baseUrl`'s origin plus any hostname on the same registrable
	 * domain (eTLD+1) as `baseUrl`. This matches the common "service at
	 * `x.vendor.tld`, CDN at `y.vendor.tld`" deployment pattern without
	 * weakening the private-host / metadata / scheme / redirect defenses
	 * (all of which remain active regardless of this setting).
	 *
	 * To force strict single-origin behavior (no registrable-domain
	 * fallback), pass `assetOrigins: [baseUrl]`.
	 */
	assetOrigins?: string[];
	/**
	 * When true (default), asset URLs that resolve to RFC1918 / loopback /
	 * link-local / IPv6 unique-local hosts are rejected as a defense against
	 * SSRF. Set to `false` only for deployments where the SchoolCity
	 * service legitimately lives on a private network (on-prem CDN,
	 * in-cluster K8s service, VPC endpoint, air-gapped install). When you
	 * disable this guard, always also pass an explicit `assetOrigins`
	 * allow-list so a compromised upstream response cannot redirect the
	 * fetch to arbitrary internal hosts.
	 *
	 * Cloud-metadata / IMDS endpoints (169.254.169.254, fd00:ec2::254,
	 * metadata.google.internal, metadata.azure.internal,
	 * metadata.packet.net, metadata.oci.oraclecloud.com) are always
	 * blocked regardless of this flag — there is no legitimate TTS-asset
	 * use case for those, and they are the primary SSRF payoff target.
	 */
	blockPrivateAssetHosts?: boolean;
	/**
	 * Maximum number of HTTP redirects to follow when dereferencing
	 * upstream-returned asset URLs. Defaults to 2.
	 */
	maxAssetRedirects?: number;
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
const DEFAULT_MAX_ASSET_REDIRECTS = 2;

// Cloud-metadata / IMDS endpoints are ALWAYS blocked, even when
// `blockPrivateAssetHosts` is `false`. These have no legitimate TTS-asset
// use case and are the primary SSRF payoff target (they return IAM
// credentials, instance tokens, and provisioning secrets).
const CLOUD_METADATA_HOSTNAME_PATTERNS: RegExp[] = [
	/^169\.254\.169\.254$/,
	/^fd00:ec2::254$/i,
	/^metadata\.google\.internal$/i,
	/^metadata\.azure\.internal$/i,
	/^metadata\.packet\.net$/i,
	/^metadata\.oci\.oraclecloud\.com$/i,
];

// Private / internal-network patterns. Blocked by default, can be
// opted-out via `blockPrivateAssetHosts: false` for deployments where
// the TTS service legitimately runs on a private network.
const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
	/^localhost$/i,
	/^127(?:\.\d{1,3}){3}$/,
	/^0(?:\.\d{1,3}){3}$/,
	/^10(?:\.\d{1,3}){3}$/,
	/^192\.168(?:\.\d{1,3}){2}$/,
	/^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/,
	/^169\.254(?:\.\d{1,3}){2}$/,
	/^::1$/,
	/^0:0:0:0:0:0:0:1$/,
	/^fe80:/i,
	/^fc00:/i,
	/^fd[0-9a-f]{2}:/i,
];

const ipv4BareToDotted = (hostname: string): string | null => {
	// Reject obviously non-numeric inputs fast; numeric IPv4 encodings
	// (bare decimal, hex, or octal) are a classic SSRF bypass.
	if (!/^(?:0x[0-9a-f]+|0[0-7]*|\d+)$/i.test(hostname)) return null;
	let asInt: number;
	try {
		asInt = Number.parseInt(hostname, hostname.startsWith("0x") ? 16 : 10);
	} catch {
		return null;
	}
	if (!Number.isFinite(asInt) || asInt < 0 || asInt > 0xff_ff_ff_ff) return null;
	return [
		(asInt >>> 24) & 0xff,
		(asInt >>> 16) & 0xff,
		(asInt >>> 8) & 0xff,
		asInt & 0xff,
	].join(".");
};

const normalizeHostnameForSafetyCheck = (hostname: string): string => {
	let host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
	// Unmap IPv4-in-IPv6 (e.g. `::ffff:127.0.0.1` / `::ffff:7f00:1`).
	const mapped = host.match(/^::ffff:([0-9a-f.]+)$/i);
	if (mapped) {
		const inner = mapped[1];
		if (/^\d+\.\d+\.\d+\.\d+$/.test(inner)) {
			host = inner;
		}
	}
	return host;
};

const hostnameMatchesAny = (
	hostname: string,
	patterns: RegExp[],
): boolean => {
	const normalized = normalizeHostnameForSafetyCheck(hostname);
	const numericDotted = ipv4BareToDotted(normalized);
	const candidates = [normalized.toLowerCase()];
	if (numericDotted) candidates.push(numericDotted);
	return candidates.some((candidate) =>
		patterns.some((pattern) => pattern.test(candidate)),
	);
};

const hostnameIsCloudMetadata = (hostname: string): boolean =>
	hostnameMatchesAny(hostname, CLOUD_METADATA_HOSTNAME_PATTERNS);

const hostnameIsPrivate = (hostname: string): boolean =>
	hostnameMatchesAny(hostname, PRIVATE_HOSTNAME_PATTERNS);

interface ResolvedAssetPolicy {
	/** Explicit origin allow-list (empty when host did not configure one). */
	explicitOrigins: Set<string>;
	/** Origin of `baseUrl`; always permitted. */
	baseUrlOrigin: string | null;
	/**
	 * Registrable domain (eTLD+1) of `baseUrl`. Present only when
	 * `explicitOrigins` is empty and `baseUrl`'s hostname has a recognised
	 * public suffix. When present, any URL whose hostname resolves to the
	 * same registrable domain is permitted in addition to `baseUrlOrigin`.
	 */
	baseUrlRegistrableDomain: string | null;
}

const resolveAssetPolicy = (
	config: SchoolCityProviderConfig,
	baseUrl: string,
): ResolvedAssetPolicy => {
	const explicitOrigins = new Set<string>();
	if (Array.isArray(config.assetOrigins)) {
		for (const raw of config.assetOrigins) {
			if (typeof raw !== "string" || raw.length === 0) continue;
			try {
				explicitOrigins.add(new URL(raw).origin);
			} catch {
				// Ignore malformed origins; they simply won't match.
			}
		}
	}

	let baseUrlOrigin: string | null = null;
	let baseUrlHostname: string | null = null;
	if (baseUrl) {
		try {
			const parsed = new URL(baseUrl);
			baseUrlOrigin = parsed.origin;
			baseUrlHostname = parsed.hostname;
		} catch {
			// baseUrl validated at initialize(); unreachable in practice.
		}
	}

	// Only derive a registrable-domain fallback when the host did NOT pass
	// an explicit allow-list. Explicit config always wins and stays strict.
	const baseUrlRegistrableDomain =
		explicitOrigins.size === 0 && baseUrlHostname
			? getDomain(baseUrlHostname)
			: null;

	return {
		explicitOrigins,
		baseUrlOrigin,
		baseUrlRegistrableDomain,
	};
};

const describePolicy = (policy: ResolvedAssetPolicy): string[] => {
	const descriptions: string[] = [];
	for (const origin of policy.explicitOrigins) descriptions.push(origin);
	if (policy.explicitOrigins.size === 0) {
		if (policy.baseUrlOrigin) descriptions.push(policy.baseUrlOrigin);
		if (policy.baseUrlRegistrableDomain) {
			descriptions.push(`*.${policy.baseUrlRegistrableDomain}`);
		}
	}
	return descriptions;
};

const isUrlAllowedByPolicy = (
	parsed: URL,
	policy: ResolvedAssetPolicy,
): boolean => {
	if (policy.explicitOrigins.size > 0) {
		return policy.explicitOrigins.has(parsed.origin);
	}
	if (policy.baseUrlOrigin && parsed.origin === policy.baseUrlOrigin) {
		return true;
	}
	if (policy.baseUrlRegistrableDomain) {
		const parsedRegistrable = getDomain(parsed.hostname);
		if (
			parsedRegistrable !== null &&
			parsedRegistrable === policy.baseUrlRegistrableDomain
		) {
			return true;
		}
	}
	// Fall back to "baseUrl origin only" when PSL lookup yields no
	// registrable domain for baseUrl (e.g. IP literal, single-label host).
	return (
		policy.explicitOrigins.size === 0 &&
		policy.baseUrlOrigin !== null &&
		policy.baseUrlRegistrableDomain === null &&
		parsed.origin === policy.baseUrlOrigin
	);
};

const validateAssetUrl = (
	rawUrl: string,
	config: SchoolCityProviderConfig,
	baseUrl: string,
): URL => {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			"SchoolCity returned a malformed asset URL",
			{ url: rawUrl },
			"schoolcity-tts",
		);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			`SchoolCity asset URL uses unsupported protocol: ${parsed.protocol}`,
			{ url: rawUrl },
			"schoolcity-tts",
		);
	}
	// Cloud-metadata / IMDS is always blocked, even when the private-host
	// guard is intentionally disabled for internal-network deployments.
	if (hostnameIsCloudMetadata(parsed.hostname)) {
		throw new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			"SchoolCity asset URL resolves to a cloud metadata endpoint",
			{ url: rawUrl, hostname: parsed.hostname },
			"schoolcity-tts",
		);
	}
	if (config.blockPrivateAssetHosts !== false && hostnameIsPrivate(parsed.hostname)) {
		throw new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			"SchoolCity asset URL resolves to a private/internal host",
			{ url: rawUrl, hostname: parsed.hostname },
			"schoolcity-tts",
		);
	}
	const policy = resolveAssetPolicy(config, baseUrl);
	if (!isUrlAllowedByPolicy(parsed, policy)) {
		throw new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			`SchoolCity asset URL origin is not allow-listed: ${parsed.origin}`,
			{ url: rawUrl, allowed: describePolicy(policy) },
			"schoolcity-tts",
		);
	}
	return parsed;
};

const fetchAssetWithManualRedirects = async (
	initialUrl: URL,
	config: SchoolCityProviderConfig,
	baseUrl: string,
	fetchImpl: FetchLike,
	init: RequestInit,
): Promise<Response> => {
	const maxRedirects = Math.max(
		0,
		Math.floor(config.maxAssetRedirects ?? DEFAULT_MAX_ASSET_REDIRECTS),
	);
	let current = initialUrl;
	for (let hop = 0; hop <= maxRedirects; hop += 1) {
		const response = await fetchImpl(current.toString(), {
			...init,
			redirect: "manual",
		});
		const status = response.status;
		const isRedirect = status >= 300 && status < 400 && status !== 304;
		if (!isRedirect) {
			return response;
		}
		const location = response.headers.get("location");
		if (!location) {
			return response;
		}
		if (hop === maxRedirects) {
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				"SchoolCity asset redirect chain exceeded limit",
				{ limit: maxRedirects, lastUrl: current.toString() },
				"schoolcity-tts",
			);
		}
		let nextUrl: URL;
		try {
			nextUrl = new URL(location, current);
		} catch {
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				"SchoolCity asset redirect target is malformed",
				{ from: current.toString(), location },
				"schoolcity-tts",
			);
		}
		current = validateAssetUrl(nextUrl.toString(), config, baseUrl);
	}
	// Unreachable: loop either returns or throws.
	throw new TTSError(
		TTSErrorCode.PROVIDER_ERROR,
		"SchoolCity asset fetch terminated unexpectedly",
		undefined,
		"schoolcity-tts",
	);
};

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
				const marksUrl = validateAssetUrl(
					word,
					this.config as SchoolCityProviderConfig,
					this.baseUrl,
				);
				const marksResponse = await fetchAssetWithManualRedirects(
					marksUrl,
					this.config as SchoolCityProviderConfig,
					this.baseUrl,
					this.fetchImpl,
					{ signal: timeout.signal },
				);
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
		const audioUrl = validateAssetUrl(
			audioContent,
			this.config as SchoolCityProviderConfig,
			this.baseUrl,
		);
		const audioTimeout = this.withTimeout();
		let audioResponse: Response;
		try {
			audioResponse = await fetchAssetWithManualRedirects(
				audioUrl,
				this.config as SchoolCityProviderConfig,
				this.baseUrl,
				this.fetchImpl,
				{ signal: audioTimeout.signal },
			);
		} finally {
			audioTimeout.clear();
		}
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
