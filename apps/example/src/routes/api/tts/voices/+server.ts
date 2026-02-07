/**
 * TTS Voices API Route
 *
 * Returns available TTS voices from AWS Polly.
 * Supports filtering by language, gender, and quality.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PollyServerProvider } from '@pie-players/tts-server-polly';

// Use same singleton as synthesize route
let pollyProvider: PollyServerProvider | null = null;

/**
 * Get or initialize the Polly provider
 */
async function getPollyProvider(): Promise<PollyServerProvider> {
	if (!pollyProvider) {
		if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
			throw new Error(
				'AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file.'
			);
		}

		pollyProvider = new PollyServerProvider();
		await pollyProvider.initialize({
			region: process.env.AWS_REGION || 'us-east-1',
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
			engine: 'neural',
			defaultVoice: 'Joanna',
		});
	}
	return pollyProvider;
}

/**
 * GET /api/tts/voices
 *
 * Query parameters:
 * - language: Filter by language code (e.g., 'en-US', 'es-ES')
 * - gender: Filter by gender ('male', 'female', 'neutral')
 * - quality: Filter by quality ('standard', 'neural', 'premium')
 *
 * Response:
 * {
 *   voices: Voice[]
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const language = url.searchParams.get('language') || undefined;
		const gender = url.searchParams.get('gender') as 'male' | 'female' | 'neutral' | undefined;
		const quality = url.searchParams.get('quality') as 'standard' | 'neural' | 'premium' | undefined;

		// Get Polly provider
		const polly = await getPollyProvider();

		// Get voices with filters
		const voices = await polly.getVoices({
			language,
			gender,
			quality,
		});

		console.log(`[TTS API] Returned ${voices.length} voices (language=${language}, gender=${gender}, quality=${quality})`);

		return json({ voices });
	} catch (err) {
		console.error('[TTS API] Get voices error:', err);

		if (err instanceof Error) {
			throw error(500, { message: err.message });
		}

		throw error(500, { message: 'Internal server error' });
	}
};
