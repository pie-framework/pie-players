/**
 * SvelteKit API route for TTS synthesis
 *
 * Copy this file to your SvelteKit app:
 * src/routes/api/tts/synthesize/+server.ts
 *
 * Then implement the two guards below. They reject every request until you do.
 * An unguarded synthesis route is an open, unmetered proxy to AWS Polly: any
 * caller who can reach the URL spends your Polly budget, and the character cap
 * bounds one request rather than the number of them.
 */

import { generateHashedCacheKey } from "@pie-players/tts-server-core";
import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, isHttpError, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** The only failure detail a caller ever receives. */
const OPAQUE_FAILURE = "Text-to-speech is unavailable.";

/**
 * Reject callers your app has not authenticated.
 *
 * Replace the body with your real check; do not delete the function or its call
 * site. It fails closed so a copied route cannot ship open by accident.
 *
 * A typical implementation reads what `hooks.server.ts` left on `event.locals`:
 *
 *   if (!event.locals.session) throw error(401, { message: "Unauthorized" });
 */
async function requireAuthenticatedCaller(event: RequestEvent): Promise<void> {
	console.error(
		"[TTS API] requireAuthenticatedCaller is not implemented, rejecting",
		event.url.pathname,
	);
	throw error(503, { message: OPAQUE_FAILURE });
}

/**
 * Reject callers who have spent their quota.
 *
 * Replace the body with your real limiter; do not delete the function or its
 * call site. Rate limiting is what bounds the cost of a shared or leaked
 * credential.
 *
 * Key on caller identity where you have it, and on the client address where you
 * do not:
 *
 *   const key = event.locals.session?.userId ?? event.getClientAddress();
 *   if (!(await limiter.take(key))) {
 *     throw error(429, { message: "Too many requests" });
 *   }
 */
async function enforceRateLimit(event: RequestEvent): Promise<void> {
	console.error(
		"[TTS API] enforceRateLimit is not implemented, rejecting",
		event.url.pathname,
	);
	throw error(503, { message: OPAQUE_FAILURE });
}

/**
 * Log the failure and raise a client-safe one in its place.
 *
 * AWS SDK error strings can carry region, ARN and credential-shape detail, so
 * the detail stays in the server log and the caller learns only the status.
 */
function failOpaquely(err: unknown): never {
	console.error("[TTS API] Synthesis error:", err);

	const detail = err instanceof Error ? err.message : "";

	if (/ThrottlingException|TooManyRequestsException/.test(detail)) {
		throw error(429, {
			message: "Text-to-speech is busy. Please try again shortly.",
		});
	}

	if (
		/credentials|InvalidSignature|SignatureDoesNotMatch|NetworkingError|ENOTFOUND|ETIMEDOUT/.test(
			detail,
		)
	) {
		throw error(503, { message: OPAQUE_FAILURE });
	}

	throw error(500, { message: OPAQUE_FAILURE });
}

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

export const POST: RequestHandler = async (event) => {
	try {
		// Guards first: reject before spending anything on the request.
		await requireAuthenticatedCaller(event);
		await enforceRateLimit(event);

		const body = await event.request.json();
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

		// Optional: Check Redis cache. Uncommenting this is what uses the
		// `generateHashedCacheKey` import above.
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
		// Statuses raised above (the guards, request validation) are already
		// client-safe and pass through unchanged.
		if (isHttpError(err)) throw err;

		failOpaquely(err);
	}
};
