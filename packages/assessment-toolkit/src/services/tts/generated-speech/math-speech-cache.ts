import {
	resolveMathSpeechFromChunks,
	type ResolvedMathSpeech,
} from "../math-speech.js";
import type { MathSpeechResolver } from "./assemble-plan.js";

const normalizeLocale = (language?: string): string =>
	(language || "en").split("-")[0].toLowerCase() || "en";

// Bump when speech-rule-engine output semantics change in a way that must
// invalidate cached spoken text (e.g. an SRE upgrade with different phrasing).
const SRE_CACHE_VERSION = "sre-v1";

const DEFAULT_MAX_ENTRIES = 256;

export interface MathSpeechCacheOptions {
	maxEntries?: number;
	/** Underlying resolver; defaults to the real SRE call. Injectable for tests. */
	resolve?: MathSpeechResolver;
}

/**
 * Build a memoized {@link MathSpeechResolver}.
 *
 * Caches only DOM-free spoken-text results keyed by
 * `(SRE version, locale, canonical MathML)`. Locale already determines the SRE
 * domain (clearspeak/mathspeak) and the English variable-normalization, so it
 * fully captures the deterministic inputs; canonical MathML is a stable,
 * content-hashable string. Never caches DOM nodes or maps. Bounded by a simple
 * LRU so long sessions do not grow unbounded.
 */
export const createMemoizedMathSpeechResolver = (
	options: MathSpeechCacheOptions = {},
): MathSpeechResolver => {
	const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
	const resolve =
		options.resolve ??
		((chunk, opts) => resolveMathSpeechFromChunks([chunk], opts));
	const cache = new Map<string, ResolvedMathSpeech>();

	return async (chunk, opts) => {
		const key = `${SRE_CACHE_VERSION}\u0000${normalizeLocale(
			opts.language,
		)}\u0000${opts.produceSsml ? "ssml" : "plain"}\u0000${chunk.mathml}`;
		const cached = cache.get(key);
		if (cached) {
			// Refresh LRU recency.
			cache.delete(key);
			cache.set(key, cached);
			return cached;
		}
		const resolved = await resolve(chunk, opts);
		cache.set(key, resolved);
		if (cache.size > maxEntries) {
			const oldest = cache.keys().next().value;
			if (oldest !== undefined) cache.delete(oldest);
		}
		return resolved;
	};
};
