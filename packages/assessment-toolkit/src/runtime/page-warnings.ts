/**
 * How long a warning about a missing input waits when a host may still be
 * supplying it, such as a toolkit or a registry loaded after mount.
 */
export const PENDING_INPUT_WARNING_DELAY_MS = 10_000;

/**
 * Warns about a setup mistake once per document, across every copy of the
 * toolkit loaded into it: the latch is a `Symbol.for` slot on the document, so
 * the custom-element bundle and the modules a host imports share it. Not
 * development-only, because the custom-element build compiles those branches
 * out, and a host misconfigures in production as readily as anywhere.
 */
export function warnOncePerDocument(
	doc: Document | null | undefined,
	key: string,
	message: string,
): void {
	if (!doc) return;
	const slot = Symbol.for(`pie.assessmentToolkit.warned.${key}`);
	const latches = doc as unknown as Record<symbol, unknown>;
	if (latches[slot]) return;
	latches[slot] = true;
	console.warn(message);
}
