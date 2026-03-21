import type { InstrumentationProvider } from "./types.js";

export function isInstrumentationProvider(
	value: unknown,
): value is InstrumentationProvider {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.providerId === "string" &&
		typeof candidate.providerName === "string" &&
		typeof candidate.initialize === "function" &&
		typeof candidate.trackError === "function" &&
		typeof candidate.trackEvent === "function" &&
		typeof candidate.destroy === "function" &&
		typeof candidate.isReady === "function"
	);
}
