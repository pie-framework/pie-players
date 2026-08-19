/**
 * HTTP-status error mapping
 * @module @pie-players/tts-server-core
 */

import { TTSErrorCode } from "./types.js";

/**
 * Map a plain HTTP status code to the closest `TTSErrorCode`, for providers
 * whose wire format is a REST API rather than a vendor SDK with its own
 * richer error taxonomy (a vendor SDK should map its own exception types
 * instead — see PollyServerProvider/GoogleCloudTTSProvider). Uses only the
 * handful of status codes with an unambiguous, universal REST meaning;
 * anything else is a provider-level failure a caller can't act on more
 * specifically.
 */
export function resolveTTSErrorCodeForHttpStatus(
	status: number,
): TTSErrorCode {
	if (status === 401 || status === 403) return TTSErrorCode.AUTHENTICATION_ERROR;
	if (status === 429) return TTSErrorCode.RATE_LIMIT_EXCEEDED;
	if (status === 400) return TTSErrorCode.INVALID_REQUEST;
	return TTSErrorCode.PROVIDER_ERROR;
}
