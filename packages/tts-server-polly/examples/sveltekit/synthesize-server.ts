/**
 * SvelteKit API route for TTS synthesis
 *
 * Copy this file to your SvelteKit app:
 * src/routes/api/tts/synthesize/+server.ts
 */

import { generateHashedCacheKey } from "@pie-players/tts-server-core";
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

// Optional: Redis caching
// import { createClient } from 'redis';
// const redis = createClient({ url: process.env.REDIS_URL });
// await redis.connect();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			text,
			provider = "polly",
			voice,
			language,
			rate,
			includeSpeechMarks = true,
		} = body;

		// Validate request
		if (!text || typeof text !== "string") {
			throw error(400, { message: "Text is required and must be a string" });
		}

		if (text.length > 3000) {
			throw error(400, { message: "Text too long (max 3000 characters)" });
		}

		// Optional: Check Redis cache
		// const cacheKey = await generateHashedCacheKey({
		//   providerId: 'aws-polly',
		//   text,
		//   voice: voice || 'Joanna',
		//   language: language || 'en-US',
		//   rate: rate || 1.0,
		//   format: 'mp3',
		// });
		//
		// const cached = await redis.get(cacheKey);
		// if (cached) {
		//   console.log('[TTS API] Cache hit:', cacheKey);
		//   return json(JSON.parse(cached));
		// }

		// Get Polly provider
		const polly = await getPollyProvider();

		// Synthesize speech
		const result = await polly.synthesize({
			text,
			voice: voice || "Joanna",
			language: language || "en-US",
			rate,
			includeSpeechMarks,
		});

		// Convert Buffer to base64 for JSON response
		const response = {
			audio:
				result.audio instanceof Buffer
					? result.audio.toString("base64")
					: result.audio,
			contentType: result.contentType,
			speechMarks: result.speechMarks,
			metadata: result.metadata,
		};

		// Optional: Cache result
		// await redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(response));

		return json(response);
	} catch (err) {
		console.error("[TTS API] Synthesis error:", err);

		if (err instanceof Error) {
			throw error(500, { message: err.message });
		}

		throw error(500, { message: "Internal server error" });
	}
};
