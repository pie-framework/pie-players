/**
 * SvelteKit API route for listing TTS voices
 *
 * Copy this file to your SvelteKit app:
 * src/routes/api/tts/voices/+server.ts
 */

import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Initialize Polly provider (singleton)
let pollyProvider: PollyServerProvider | null = null;

async function getPollyProvider(): Promise<PollyServerProvider> {
	if (!pollyProvider) {
		pollyProvider = new PollyServerProvider();
		await pollyProvider.initialize({
			region: process.env.AWS_REGION || "us-east-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
			},
			engine: "neural",
			defaultVoice: "Joanna",
		});
	}
	return pollyProvider;
}

export const GET: RequestHandler = async ({ url }) => {
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

		// Get Polly provider
		const polly = await getPollyProvider();

		// Get voices with filters
		const voices = await polly.getVoices({
			language,
			gender,
			quality,
		});

		return json({ voices });
	} catch (err) {
		console.error("[TTS API] Get voices error:", err);

		if (err instanceof Error) {
			throw error(500, { message: err.message });
		}

		throw error(500, { message: "Internal server error" });
	}
};
