/**
 * SchoolCity TTS voices route.
 *
 * Unlike the Polly and Google equivalents this initializes no provider and reads
 * no credentials: the SchoolCity service has no voice endpoint, so the roster is
 * the table `@pie-players/tts-server-sc` transcribes from it. That makes the
 * route answerable in a demo with no SchoolCity access configured, which is the
 * case this exists to cover — a caller needs the locale list to build a picker
 * before it can synthesize anything.
 */

import { schoolCityVoices } from "@pie-players/tts-server-sc";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const GENDERS = ["male", "female", "neutral"] as const;
type Gender = (typeof GENDERS)[number];

const QUALITIES = ["standard", "premium", "neural"] as const;
type Quality = (typeof QUALITIES)[number];

/**
 * GET /api/tts/sc/voices
 *
 * Query parameters:
 * - language: language range, matched per RFC 4647 (`en` reaches every English
 *   locale, `en-US` only that one)
 * - gender: 'male' | 'female' | 'neutral'
 * - quality: 'standard' | 'premium' | 'neural' — the service serves standard
 *   voices only, so anything else answers with an empty list
 */
export const GET: RequestHandler = async ({ url }) => {
	const language = url.searchParams.get("language") || undefined;

	const genderParam = url.searchParams.get("gender");
	if (genderParam && !GENDERS.includes(genderParam as Gender)) {
		return json(
			{
				error: `Unsupported gender "${genderParam}". Use ${GENDERS.join(", ")}.`,
			},
			{ status: 400 },
		);
	}

	const qualityParam = url.searchParams.get("quality");
	if (qualityParam && !QUALITIES.includes(qualityParam as Quality)) {
		return json(
			{
				error: `Unsupported quality "${qualityParam}". Use ${QUALITIES.join(", ")}.`,
			},
			{ status: 400 },
		);
	}

	return json({
		voices: schoolCityVoices({
			language,
			gender: (genderParam as Gender) || undefined,
			quality: (qualityParam as Quality) || undefined,
		}),
	});
};
