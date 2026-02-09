/**
 * AWS Polly Voices API Route
 *
 * Returns available TTS voices from AWS Polly.
 * Supports filtering by language, gender, and quality.
 */

import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Use singleton
let pollyProvider: PollyServerProvider | null = null;

/**
 * Get or initialize the Polly provider
 */
async function getPollyProvider(): Promise<PollyServerProvider> {
	if (!pollyProvider) {
		console.log("[Polly API] Initializing AWS Polly provider...");
		console.log(
			"[Polly API] AWS_REGION:",
			process.env.AWS_REGION ? "✓ Set" : "✗ Missing",
		);
		console.log(
			"[Polly API] AWS_ACCESS_KEY_ID:",
			process.env.AWS_ACCESS_KEY_ID
				? `✓ Set (${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...)`
				: "✗ Missing",
		);
		console.log(
			"[Polly API] AWS_SECRET_ACCESS_KEY:",
			process.env.AWS_SECRET_ACCESS_KEY ? "✓ Set (hidden)" : "✗ Missing",
		);

		if (
			!process.env.AWS_REGION ||
			!process.env.AWS_ACCESS_KEY_ID ||
			!process.env.AWS_SECRET_ACCESS_KEY
		) {
			const errorMsg =
				"AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file.";
			console.error(`[Polly API] ${errorMsg}`);
			throw new Error(errorMsg);
		}

		pollyProvider = new PollyServerProvider();

		// Build credentials object
		const credentials: any = {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		};

		if (process.env.AWS_SESSION_TOKEN) {
			credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
		}

		await pollyProvider.initialize({
			region: process.env.AWS_REGION || "us-east-1",
			credentials,
			engine: "neural",
			defaultVoice: "Joanna",
		});

		console.log("[Polly API] Provider initialized successfully");
	}
	return pollyProvider;
}

/**
 * GET /api/tts/polly/voices
 *
 * Query parameters:
 * - language: Filter by language code (e.g., 'en-US', 'es-ES')
 * - gender: Filter by gender ('male', 'female', 'neutral')
 * - quality: Filter by quality ('standard', 'neural', 'premium')
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
		const quality = url.searchParams.get("quality") as
			| "standard"
			| "neural"
			| "premium"
			| undefined;

		const polly = await getPollyProvider();
		const voices = await polly.getVoices({
			language,
			gender,
			quality,
		});

		console.log(
			`[Polly API] Returned ${voices.length} voices (language=${language}, gender=${gender}, quality=${quality})`,
		);

		return json({ voices });
	} catch (err) {
		console.error("[Polly API] Error:", err);

		if (err instanceof Error) {
			return json({ error: err.message }, { status: 500 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
