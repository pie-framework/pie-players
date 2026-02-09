/**
 * Google Cloud TTS Voices API Route
 *
 * Returns available TTS voices from Google Cloud Text-to-Speech.
 * Supports filtering by language, gender, and voice type (WaveNet, Studio, Standard).
 */

import { GoogleCloudTTSProvider } from "@pie-players/tts-server-google";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Use singleton
let googleProvider: GoogleCloudTTSProvider | null = null;

/**
 * Get or initialize the Google provider
 */
async function getGoogleProvider(): Promise<GoogleCloudTTSProvider> {
	if (!googleProvider) {
		console.log("[Google TTS API] Initializing Google Cloud TTS provider...");

		// Check for API key (simple method)
		const hasApiKey = !!process.env.GOOGLE_API_KEY;
		// Check for service account credentials (advanced method)
		const hasServiceAccount = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

		console.log(
			"[Google TTS API] GOOGLE_API_KEY:",
			hasApiKey
				? `✓ Set (${process.env.GOOGLE_API_KEY?.substring(0, 8)}...)`
				: "✗ Missing",
		);
		console.log(
			"[Google TTS API] GOOGLE_APPLICATION_CREDENTIALS:",
			hasServiceAccount ? "✓ Set" : "✗ Missing",
		);
		console.log(
			"[Google TTS API] GOOGLE_CLOUD_PROJECT:",
			process.env.GOOGLE_CLOUD_PROJECT ? "✓ Set" : "✗ Missing",
		);

		// Require at least one authentication method
		if (!hasApiKey && !hasServiceAccount) {
			const errorMsg =
				"Google Cloud credentials not configured. Please set either:\n" +
				"  - GOOGLE_API_KEY (simpler, for testing)\n" +
				"  - GOOGLE_APPLICATION_CREDENTIALS (recommended for production, path to service account JSON)";
			console.error(`[Google TTS API] ${errorMsg}`);
			throw new Error(errorMsg);
		}

		googleProvider = new GoogleCloudTTSProvider();

		// Build credentials object based on what's available
		let credentials: string | { apiKey: string } | undefined;
		if (hasApiKey) {
			console.log("[Google TTS API] Using API key authentication");
			credentials = { apiKey: process.env.GOOGLE_API_KEY! };
		} else if (hasServiceAccount) {
			console.log("[Google TTS API] Using service account authentication");
			credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
		}

		await googleProvider.initialize({
			projectId: process.env.GOOGLE_CLOUD_PROJECT || "pie-tts-project",
			credentials,
			defaultVoice: "en-US-Wavenet-A",
			voiceType: "wavenet",
		});

		console.log("[Google TTS API] Provider initialized successfully");
	}
	return googleProvider;
}

/**
 * GET /api/tts/google/voices
 *
 * Query parameters:
 * - language: Filter by language code (e.g., 'en-US', 'es-ES')
 * - gender: Filter by gender ('male', 'female', 'neutral')
 * - voiceType: Filter by voice type ('wavenet', 'studio', 'standard')
 */
export const GET: RequestHandler = async ({ url }) => {
	console.log("[Google TTS API] GET /api/tts/google/voices");

	try {
		const language = url.searchParams.get("language") || undefined;
		const gender = url.searchParams.get("gender") as
			| "male"
			| "female"
			| "neutral"
			| undefined;
		const voiceType = url.searchParams.get("voiceType") as
			| "wavenet"
			| "studio"
			| "standard"
			| undefined;

		// Map voiceType to quality filter
		let quality: "standard" | "neural" | "premium" | undefined;
		if (voiceType === "wavenet") {
			quality = "neural";
		} else if (voiceType === "studio") {
			quality = "premium";
		} else if (voiceType === "standard") {
			quality = "standard";
		}

		const google = await getGoogleProvider();
		const voices = await google.getVoices({
			language,
			gender,
			quality,
		});

		console.log(
			`[Google TTS API] Returned ${voices.length} voices (language=${language}, gender=${gender}, voiceType=${voiceType})`,
		);

		return json({ voices });
	} catch (err) {
		console.error("[Google TTS API] Error:", err);

		if (err instanceof Error) {
			return json({ error: err.message }, { status: 500 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
