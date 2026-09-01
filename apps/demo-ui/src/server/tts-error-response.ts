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

export function mapTtsFailure(err: unknown): TtsFailure {
	if (err instanceof TtsNotConfiguredError) {
		return { status: 503, message: err.message, logAsFault: false };
	}

	const detail = err instanceof Error ? err.message : "";

	// Matched case-insensitively and on the singular stem: a real SDK failure says
	// "Resolved credential object is not valid for arn:aws:iam::…", which
	// `includes("credentials")` misses. Credentials are tested before the vendor
	// catch-all so an ARN in the message cannot claim the error first.
	if (
		/\bcredential|not configured|CredentialsProviderError|UnrecognizedClientException|ExpiredToken|AccessDenied/i.test(
			detail,
		)
	) {
		return fault(503, "Text-to-speech service is not configured.");
	}

	if (/InvalidSignature|SignatureDoesNotMatch/i.test(detail)) {
		return fault(503, "Text-to-speech service authentication failed.");
	}

	if (/Throttling|TooManyRequests|Rate exceeded/i.test(detail)) {
		return fault(
			429,
			"Text-to-speech service is temporarily busy. Please try again in a moment.",
		);
	}

	if (
		/NetworkingError|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(detail)
	) {
		return fault(503, "Text-to-speech service is temporarily unavailable.");
	}

	// Word-bounded so "flaws"/"laws" cannot match, and case-insensitive so a
	// lowercase "aws" in an ARN or endpoint host does.
	if (/\b(aws|polly|google)\b/i.test(detail)) {
		return fault(
			503,
			"Text-to-speech service encountered an error. Please try again later.",
		);
	}

	return fault(500, "Text-to-speech service encountered an unexpected error.");
}
