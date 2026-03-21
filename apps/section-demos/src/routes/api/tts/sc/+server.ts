import { SignJWT } from "jose";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

interface SchoolCitySynthesizeRequest {
	text: string;
	speedRate?: "slow" | "medium" | "fast";
	lang_id?: string;
	cache?: boolean;
}

type SpeechMark = {
	time: number;
	start: number;
	end: number;
	value: string;
	type: "word";
};

const REQUIRED_ENV_KEYS = [
	"TTS_SCHOOLCITY_URL",
	"TTS_SCHOOLCITY_API_KEY",
	"TTS_SCHOOLCITY_ISS",
] as const;

const getRequiredEnv = (): Record<(typeof REQUIRED_ENV_KEYS)[number], string> => {
	const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
	if (missing.length > 0) {
		throw error(503, {
			message: `Missing required SC TTS env vars: ${missing.join(", ")}`,
		});
	}
	return {
		TTS_SCHOOLCITY_URL: process.env.TTS_SCHOOLCITY_URL as string,
		TTS_SCHOOLCITY_API_KEY: process.env.TTS_SCHOOLCITY_API_KEY as string,
		TTS_SCHOOLCITY_ISS: process.env.TTS_SCHOOLCITY_ISS as string,
	};
};

const normalizeEndpoint = (value: string): string => value.replace(/\/+$/, "/");

const parseResponseBody = async (response: Response): Promise<Record<string, unknown>> => {
	const raw = await response.text();
	if (!raw) return {};
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return { message: raw };
	}
};

const toBearerToken = async (issuer: string, signingKey: string): Promise<string> => {
	const secret = new TextEncoder().encode(signingKey);
	return new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(issuer)
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(secret);
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
			marks.push({ time, start, end, value, type: "word" });
		} catch {
			// Ignore malformed JSONL rows and keep parsing remaining marks.
		}
	}
	return sortSpeechMarks(marks);
};

/**
 * SC returns Polly marks indexed against wrapped/normalized SSML.
 * We estimate a stable positive shift back to the original request text.
 */
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

const rebaseSpeechMarks = (marks: SpeechMark[], requestText: string): SpeechMark[] => {
	if (!marks.length) return marks;
	const textLength = requestText.length;
	if (!textLength) return marks;
	const maxEnd = Math.max(...marks.map((mark) => mark.end));
	// Already aligned to source text.
	if (maxEnd <= textLength + 2) return marks;

	const shift = estimateOffsetShift(marks, requestText);
	if (shift <= 0) return marks;

	return sortSpeechMarks(
		marks.map((mark) => {
			const start = Math.max(0, Math.floor(mark.start - shift));
			const end = Math.max(start + 1, Math.floor(mark.end - shift));
			return { ...mark, start, end };
		}),
	);
};

const fetchNormalizedSpeechMarks = async (
	wordMarksUrl: string,
	requestText: string,
): Promise<SpeechMark[]> => {
	const marksResponse = await fetch(wordMarksUrl);
	if (!marksResponse.ok) {
		throw new Error(`Failed to fetch SC word marks (${marksResponse.status})`);
	}
	const marksRaw = await marksResponse.text();
	const parsed = parseWordMarksJsonl(marksRaw);
	return rebaseSpeechMarks(parsed, requestText);
};

const logProxyDebug = (event: string, payload?: Record<string, unknown>): void => {
	if (payload) {
		console.info(`[tts-sc-proxy] ${event}`, payload);
		return;
	}
	console.info(`[tts-sc-proxy] ${event}`);
};

export const POST: RequestHandler = async ({ request }) => {
	const { TTS_SCHOOLCITY_URL, TTS_SCHOOLCITY_API_KEY, TTS_SCHOOLCITY_ISS } =
		getRequiredEnv();
	const upstreamUrl = normalizeEndpoint(TTS_SCHOOLCITY_URL);
	const requestId = `sc-${Date.now().toString(36)}`;

	let body: SchoolCitySynthesizeRequest;
	try {
		body = (await request.json()) as SchoolCitySynthesizeRequest;
	} catch {
		throw error(400, { message: "Invalid JSON payload" });
	}

	if (!body.text || typeof body.text !== "string") {
		throw error(400, { message: "text is required and must be a string" });
	}
	logProxyDebug("request:start", {
		requestId,
		upstreamUrl,
		textLength: body.text.length,
		speedRate: body.speedRate || "default",
		lang_id: body.lang_id || "default",
		cache: typeof body.cache === "boolean" ? body.cache : "default",
	});

	const token = await toBearerToken(TTS_SCHOOLCITY_ISS, TTS_SCHOOLCITY_API_KEY);
	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetch(upstreamUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				text: body.text,
				speedRate: body.speedRate,
				lang_id: body.lang_id,
				cache: body.cache,
			}),
		});
	} catch (fetchError) {
		const details =
			fetchError && typeof fetchError === "object"
				? {
						name: (fetchError as Error).name,
						message: (fetchError as Error).message,
						cause:
							(fetchError as Error & { cause?: unknown }).cause &&
							typeof (fetchError as Error & { cause?: unknown }).cause === "object"
								? String((fetchError as Error & { cause?: unknown }).cause)
								: undefined,
					}
				: { message: String(fetchError) };
		logProxyDebug("request:network-error", {
			requestId,
			upstreamUrl,
			...details,
		});
		throw error(502, { message: "SC TTS upstream request failed" });
	}

	const payload = await parseResponseBody(upstreamResponse);
	if (!upstreamResponse.ok) {
		logProxyDebug("request:upstream-error", {
			requestId,
			upstreamUrl,
			status: upstreamResponse.status,
			payloadMessage:
				typeof payload.message === "string" ? payload.message : undefined,
		});
		const remoteMessage =
			typeof payload.message === "string"
				? payload.message
				: `SC TTS request failed (${upstreamResponse.status})`;
		throw error(upstreamResponse.status, { message: remoteMessage });
	}

	const audioContent = payload.audioContent;
	const word = payload.word;
	if (typeof audioContent !== "string" || typeof word !== "string") {
		logProxyDebug("request:invalid-payload", {
			requestId,
			upstreamUrl,
			hasAudioContent: typeof audioContent === "string",
			hasWord: typeof word === "string",
		});
		throw error(502, {
			message: "SC TTS proxy received an invalid response payload",
		});
	}
	logProxyDebug("request:success", {
		requestId,
		upstreamUrl,
		hasAudioContent: true,
		hasWord: true,
	});

	let speechMarks: SpeechMark[] | undefined;
	try {
		speechMarks = await fetchNormalizedSpeechMarks(word, body.text);
		logProxyDebug("marks:normalized", {
			requestId,
			count: speechMarks.length,
			first: speechMarks[0],
		});
	} catch (marksError) {
		logProxyDebug("marks:degraded", {
			requestId,
			message: marksError instanceof Error ? marksError.message : String(marksError),
		});
	}

	return json({
		audioContent,
		word,
		...(speechMarks && speechMarks.length > 0 ? { speechMarks } : {}),
	});
};
