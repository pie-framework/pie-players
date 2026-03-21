import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SchoolCityServerProvider } from "@pie-players/tts-server-sc";
import { TTSError, TTSErrorCode } from "@pie-players/tts-server-core";

interface SchoolCitySynthesizeRequest {
	text: string;
	speedRate?: "slow" | "medium" | "fast";
	lang_id?: string;
	cache?: boolean;
}

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

let provider: SchoolCityServerProvider | null = null;
let providerCacheKey = "";

const toCacheKey = (
	env: Record<(typeof REQUIRED_ENV_KEYS)[number], string>,
): string =>
	`${env.TTS_SCHOOLCITY_URL}|${env.TTS_SCHOOLCITY_API_KEY}|${env.TTS_SCHOOLCITY_ISS}`;

const getProvider = async (
	env: Record<(typeof REQUIRED_ENV_KEYS)[number], string>,
): Promise<SchoolCityServerProvider> => {
	const nextKey = toCacheKey(env);
	if (!provider || providerCacheKey !== nextKey) {
		const next = new SchoolCityServerProvider();
		await next.initialize({
			baseUrl: env.TTS_SCHOOLCITY_URL,
			apiKey: env.TTS_SCHOOLCITY_API_KEY,
			issuer: env.TTS_SCHOOLCITY_ISS,
			defaultLanguage: "en-US",
			defaultSpeedRate: "medium",
			defaultCache: true,
		});
		provider = next;
		providerCacheKey = nextKey;
	}
	return provider;
};

const toHttpStatus = (err: unknown): number => {
	if (err instanceof TTSError) {
		if (
			err.code === TTSErrorCode.INVALID_REQUEST ||
			err.code === TTSErrorCode.TEXT_TOO_LONG
		) {
			return 400;
		}
		if (err.code === TTSErrorCode.AUTHENTICATION_ERROR) return 401;
		if (err.code === TTSErrorCode.RATE_LIMIT_EXCEEDED) return 429;
		return 502;
	}
	return 500;
};

export const POST: RequestHandler = async ({ request }) => {
	const env = getRequiredEnv();
	let body: SchoolCitySynthesizeRequest;
	try {
		body = (await request.json()) as SchoolCitySynthesizeRequest;
	} catch {
		throw error(400, { message: "Invalid JSON payload" });
	}

	if (!body.text || typeof body.text !== "string") {
		throw error(400, { message: "text is required and must be a string" });
	}
	try {
		const scProvider = await getProvider(env);
		const result = await scProvider.synthesizeWithAssets({
			text: body.text,
			language: body.lang_id,
			includeSpeechMarks: true,
			providerOptions: {
				speedRate: body.speedRate,
				cache: body.cache,
			},
		});
		return json({
			audioContent: result.audioContent,
			word: result.word,
			...(result.speechMarks.length > 0 ? { speechMarks: result.speechMarks } : {}),
		});
	} catch (err) {
		throw error(toHttpStatus(err), {
			message: err instanceof Error ? err.message : "SC TTS request failed",
		});
	}
};
