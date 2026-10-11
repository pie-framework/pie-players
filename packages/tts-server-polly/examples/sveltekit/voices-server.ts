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

import {
	type GetVoicesOptions,
	TTSError,
	TTSErrorCode,
} from "@pie-players/tts-server-core";
import {
	type PollyProviderConfig,
	PollyServerProvider,
} from "@pie-players/tts-server-polly";
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
 *   if (!event.locals.session) throw error(401, "Unauthorized");
 */
async function requireAuthenticatedCaller(event: RequestEvent): Promise<void> {
	console.error(
		"[TTS API] requireAuthenticatedCaller is not implemented, rejecting",
		event.url.pathname,
	);
	throw error(503, OPAQUE_FAILURE);
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
 *     throw error(429, "Too many requests");
 *   }
 */
async function enforceRateLimit(event: RequestEvent): Promise<void> {
	console.error(
		"[TTS API] enforceRateLimit is not implemented, rejecting",
		event.url.pathname,
	);
	throw error(503, OPAQUE_FAILURE);
}

/**
 * The status each `TTSErrorCode` answers with. A `Record` over the enum, so a
 * code added to `@pie-players/tts-server-core` fails the type check here until
 * it is mapped.
 */
const STATUS_BY_CODE: Record<TTSErrorCode, 400 | 429 | 500 | 503> = {
	[TTSErrorCode.INVALID_REQUEST]: 400,
	[TTSErrorCode.INVALID_VOICE]: 400,
	[TTSErrorCode.TEXT_TOO_LONG]: 400,
	[TTSErrorCode.RATE_LIMIT_EXCEEDED]: 429,
	[TTSErrorCode.AUTHENTICATION_ERROR]: 503,
	[TTSErrorCode.INITIALIZATION_ERROR]: 503,
	[TTSErrorCode.NETWORK_ERROR]: 503,
	[TTSErrorCode.PROVIDER_ERROR]: 503,
	[TTSErrorCode.INVALID_PROVIDER]: 500,
};

const MESSAGE_BY_STATUS = {
	400: "Text-to-speech cannot read this request.",
	429: "Text-to-speech is busy. Please try again shortly.",
	500: OPAQUE_FAILURE,
	503: OPAQUE_FAILURE,
};

/**
 * Log the failure and raise a client-safe one in its place.
 *
 * The provider reports every AWS failure as a `TTSError`, and its code picks the
 * status. The message stays in the server log: AWS SDK error strings can carry
 * region, ARN and credential-shape detail.
 */
function failOpaquely(err: unknown): never {
	console.error("[TTS API] Get voices error:", err);
	const status = (err instanceof TTSError && STATUS_BY_CODE[err.code]) || 500;
	throw error(status, MESSAGE_BY_STATUS[status]);
}

type PollyEngine = NonNullable<PollyProviderConfig["engine"]>;

const ENGINES: readonly PollyEngine[] = ["neural", "standard"];
const DEFAULT_ENGINE: PollyEngine = "neural";

/**
 * Explicit credentials when the environment sets a key pair, else none, so the
 * AWS SDK's default chain resolves them: an IAM role, SSO or a shared profile.
 */
function configuredCredentials(): PollyProviderConfig["credentials"] {
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	if (!accessKeyId || !secretAccessKey) return undefined;
	return {
		accessKeyId,
		secretAccessKey,
		sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
	};
}

/**
 * One provider per engine, since a provider's engine is fixed when it is
 * initialized and it lists only that engine's voices. The map holds the
 * initialization promise, so concurrent first requests share one provider, and
 * drops a failed one, so the next request retries.
 */
const providers = new Map<PollyEngine, Promise<PollyServerProvider>>();

function getPollyProvider(engine: PollyEngine): Promise<PollyServerProvider> {
	let provider = providers.get(engine);
	if (!provider) {
		provider = (async () => {
			const polly = new PollyServerProvider();
			await polly.initialize({
				region: process.env.AWS_REGION || "us-east-1",
				credentials: configuredCredentials(),
				engine,
				defaultVoice: "Joanna",
			});
			return polly;
		})();
		provider.catch(() => providers.delete(engine));
		providers.set(engine, provider);
	}
	return provider;
}

/** A query parameter, `undefined` when absent or empty; a 400 when not `allowed`. */
function param<T extends string>(
	searchParams: URLSearchParams,
	name: string,
	allowed: readonly T[],
): T | undefined {
	const value = searchParams.get(name);
	if (!value) return undefined;
	if (!allowed.includes(value as T)) {
		throw error(400, `Invalid ${name}`);
	}
	return value as T;
}

const GENDERS: readonly NonNullable<GetVoicesOptions["gender"]>[] = [
	"male",
	"female",
	"neutral",
];
const QUALITIES: readonly NonNullable<GetVoicesOptions["quality"]>[] = [
	"standard",
	"premium",
	"neural",
];

export const GET: RequestHandler = async (event) => {
	try {
		// Guards first: reject before spending anything on the request.
		await requireAuthenticatedCaller(event);
		await enforceRateLimit(event);

		const { searchParams } = event.url;
		const engine = param(searchParams, "engine", ENGINES) ?? DEFAULT_ENGINE;
		const options: GetVoicesOptions = {
			language: searchParams.get("language") || undefined,
			gender: param(searchParams, "gender", GENDERS),
			quality: param(searchParams, "quality", QUALITIES),
		};

		const polly = await getPollyProvider(engine);
		const voices = await polly.getVoices(options);

		return json({ voices });
	} catch (err) {
		// Statuses raised above (the guards, query validation) are already
		// client-safe and pass through unchanged.
		if (isHttpError(err)) throw err;

		failOpaquely(err);
	}
};
