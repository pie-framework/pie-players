/**
 * AWS Polly Voices API Route
 *
 * Returns available TTS voices from AWS Polly.
 * Supports filtering by language, gender, and engine.
 */

import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	mapTtsFailure,
	TtsNotConfiguredError,
} from "@pie-players/demo-ui/server";

type PollyEngine = "neural" | "standard";
const SUPPORTED_ENGINES: PollyEngine[] = ["neural", "standard"];

// Keep one singleton per engine so switching is cheap.
const pollyProviders = new Map<PollyEngine, PollyServerProvider>();

/**
 * Get or initialize the Polly provider
 */
async function getPollyProvider(
	engine: PollyEngine,
): Promise<PollyServerProvider> {
	const existing = pollyProviders.get(engine);
	if (existing) return existing;

	{
		if (
			!process.env.AWS_REGION ||
			!process.env.AWS_ACCESS_KEY_ID ||
			!process.env.AWS_SECRET_ACCESS_KEY
		) {
			throw new TtsNotConfiguredError(
				"AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file.",
			);
		}

		console.log("[Polly API] Initializing AWS Polly provider...");
		const provider = new PollyServerProvider();

		// Build credentials object
		const credentials: any = {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		};

		if (process.env.AWS_SESSION_TOKEN) {
			credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
		}

		await provider.initialize({
			region: process.env.AWS_REGION || "us-east-1",
			credentials,
			engine,
			defaultVoice: "Joanna",
		});

		console.log(`[Polly API] Provider initialized successfully (${engine})`);
		pollyProviders.set(engine, provider);
	}
	return pollyProviders.get(engine)!;
}

/**
 * GET /api/tts/polly/voices
 *
 * Query parameters:
 * - language: Filter by language code (e.g., 'en-US', 'es-ES')
 * - gender: Filter by gender ('male', 'female', 'neutral')
 * - engine: Filter by Polly engine ('standard' | 'neural')
 */
export const GET: RequestHandler = async ({ url }) => {
	console.log("[Polly API] GET /api/tts/polly/voices");

	try {
		const language = url.searchParams.get("language") || undefined;
		const gender = url.searchParams.get("gender") as
			| "male"
			| "female"
			| "neutral"
			| undefined;
		const engineParam = url.searchParams.get("engine");
		const engine = (engineParam || "neural") as PollyEngine;
		if (!SUPPORTED_ENGINES.includes(engine)) {
			return json(
				{
					error: `Unsupported Polly engine "${engine}". Use "neural" or "standard".`,
				},
				{ status: 400 },
			);
		}

		const polly = await getPollyProvider(engine);
		const voices = await polly.getVoices({
			language,
			gender,
			quality: engine,
		});

		console.log(
			`[Polly API] Returned ${voices.length} voices (language=${language}, gender=${gender}, engine=${engine})`,
		);

		return json({ voices });
	} catch (err) {
		const { status, message, logAsFault } = mapTtsFailure(err);
		if (logAsFault) console.error("[Polly API] Error:", err);

		return json({ error: message }, { status });
	}
};
