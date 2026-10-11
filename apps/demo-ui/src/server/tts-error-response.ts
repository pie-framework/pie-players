/**
 * Client-safe error mapping for the demo TTS routes.
 *
 * The demo TTS routes are intentionally unauthenticated for local development
 * and e2e specs — see "Demo endpoints are not production-grade" in
 * `docs/tools-and-accomodations/tool_host_contract.md`. That is deliberate;
 * echoing internal error text is not. AWS and Google SDK error strings can name
 * the region, an ARN, or the shape of the credential that failed, so the detail
 * belongs in the server log and the caller receives a status and a generic
 * message.
 *
 * This lives in `demo-ui` rather than in either app's `$lib` because
 * section-demos and assessment-demos carry hand-drifted copies of the same TTS
 * routes, and that drift is what let one raw-error passthrough become four. One
 * mapper and one sentinel, imported by both.
 */

import { TTSError, TTSErrorCode } from "@pie-players/tts-server-core";

/**
 * Thrown when a demo TTS provider's credentials are simply absent.
 *
 * Expected in dev and CI, so it is not a fault to log. Its message is authored
 * at the throw site rather than coming from a vendor SDK — it names the missing
 * env vars and nothing about the deployment — so it is returned to the caller as
 * it is, which is what makes a misconfigured local demo diagnosable from the
 * browser.
 */
export class TtsNotConfiguredError extends Error {}

export interface TtsFailure {
	status: number;
	message: string;
	/** False for an expected missing-`.env`; true for a genuine failure. */
	logAsFault: boolean;
}

const fault = (status: number, message: string): TtsFailure => ({
	status,
	message,
	logAsFault: true,
});

const UNEXPECTED = fault(
	500,
	"Text-to-speech service encountered an unexpected error.",
);
const UNREADABLE_REQUEST = fault(
	400,
	"Text-to-speech service cannot process this request.",
);

/**
 * The answer for each `TTSErrorCode`. A `Record` over the enum, so a code added
 * to `@pie-players/tts-server-core` fails the type check here until it is
 * mapped.
 */
const FAILURE_BY_CODE: Record<TTSErrorCode, TtsFailure> = {
	[TTSErrorCode.INVALID_REQUEST]: UNREADABLE_REQUEST,
	[TTSErrorCode.INVALID_VOICE]: UNREADABLE_REQUEST,
	[TTSErrorCode.TEXT_TOO_LONG]: UNREADABLE_REQUEST,
	[TTSErrorCode.RATE_LIMIT_EXCEEDED]: fault(
		429,
		"Text-to-speech service is temporarily busy. Please try again in a moment.",
	),
	[TTSErrorCode.AUTHENTICATION_ERROR]: fault(
		503,
		"Text-to-speech service authentication failed.",
	),
	[TTSErrorCode.INITIALIZATION_ERROR]: fault(
		503,
		"Text-to-speech service is not configured.",
	),
	[TTSErrorCode.NETWORK_ERROR]: fault(
		503,
		"Text-to-speech service is temporarily unavailable.",
	),
	[TTSErrorCode.PROVIDER_ERROR]: fault(
		503,
		"Text-to-speech service encountered an error. Please try again later.",
	),
	[TTSErrorCode.INVALID_PROVIDER]: UNEXPECTED,
};

/**
 * The providers report every vendor failure as a `TTSError`, so its code picks
 * the answer. Anything else is the route's own fault, or a provider throwing
 * outside its vendor calls, and answers 500.
 */
export function mapTtsFailure(err: unknown): TtsFailure {
	if (err instanceof TtsNotConfiguredError) {
		return { status: 503, message: err.message, logAsFault: false };
	}
	return (err instanceof TTSError && FAILURE_BY_CODE[err.code]) || UNEXPECTED;
}
