import {
	ContextProvider,
	type SessionCommitContextValue,
	sessionCommitContext,
} from "@pie-players/pie-context";

/**
 * The context value for a host's `idleSaveDelayMs`.
 *
 * Anything but a finite, non-negative number leaves the field out, so the
 * element keeps its own default.
 */
export function resolveSessionCommitContextValue(
	idleSaveDelayMs: unknown,
): SessionCommitContextValue {
	if (
		typeof idleSaveDelayMs !== "number" ||
		!Number.isFinite(idleSaveDelayMs) ||
		idleSaveDelayMs < 0
	) {
		return {};
	}
	return { idleSaveDelayMs };
}

/**
 * Answers `sessionCommitContext` for every element under `host`.
 *
 * The player provides it whether or not the host set a delay: an empty value
 * reads as the element's defaults, the same as no answer, and a delay the host
 * sets later reaches subscribers through `setValue`.
 */
export function provideSessionCommitContext(
	host: Element,
	initialValue: SessionCommitContextValue,
) {
	const provider = new ContextProvider(host, {
		context: sessionCommitContext,
		initialValue,
	});
	provider.connect();
	return {
		setValue: (value: SessionCommitContextValue) => provider.setValue(value),
		disconnect: () => provider.disconnect(),
	};
}
