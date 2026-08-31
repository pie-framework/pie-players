/**
 * SvelteKit API route for listing TTS voices
 *
 * Copy this file to your SvelteKit app:
 * src/routes/api/tts/voices/+server.ts
 *
 * Then implement the two guards below. They reject every request until you do.
 * This route calls AWS on every request and is reachable by whoever can reach
 * the URL, so it carries the same guards as the synthesis route.
 */

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
	console.error("[TTS API] Get voices error:", err);

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

export const GET: RequestHandler = async (event) => {
	try {
		// Guards first: reject before spending anything on the request.
		await requireAuthenticatedCaller(event);
		await enforceRateLimit(event);

		const language = event.url.searchParams.get("language") || undefined;
		const gender = event.url.searchParams.get("gender") as
			| "male"
			| "female"
			| "neutral"
			| undefined;
		const quality = event.url.searchParams.get("quality") as
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
		// Statuses raised above (the guards) are already client-safe and pass
		// through unchanged.
		if (isHttpError(err)) throw err;

		failOpaquely(err);
	}
};
