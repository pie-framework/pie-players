/**
 * The `code` a speak's rejection carries when speech could not start, as
 * distinct from a failure while speaking. Read by shape: several copies of the
 * toolkit can share a page, so an error class from one fails `instanceof` in
 * another.
 */
export const TTS_START_FAILED_CODE = "tts-start-failed";

/** Whether a speak rejected because speech could not start. */
export function isTTSStartFailure(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === TTS_START_FAILED_CODE
	);
}

/** Marks `cause` as a start failure, keeping its message and stack. */
export function toTTSStartFailure(cause: unknown): Error {
	const error = cause instanceof Error ? cause : new Error(String(cause));
	(error as Error & { code?: string }).code = TTS_START_FAILED_CODE;
	return error;
}
