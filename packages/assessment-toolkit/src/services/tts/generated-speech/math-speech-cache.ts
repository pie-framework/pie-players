import {
	normalizeSREMathSpeechOptions,
	resolveMathSpeechFromChunks,
	type ResolvedMathSpeech,
	type SREMathSpeechOptions,
} from "../math-speech.js";
import type { MathSpeechResolver } from "./assemble-plan.js";

const normalizeLocale = (language?: string): string =>
	(language || "en").split("-")[0].toLowerCase() || "en";

// Bump when speech-rule-engine output semantics change in a way that must
// invalidate cached spoken text (e.g. an SRE upgrade with different phrasing).
const SRE_CACHE_VERSION = "sre-v1";

const DEFAULT_MAX_ENTRIES = 256;

const stableStringify = (value: unknown): string => {
	if (Array.isArray(value)) {
		return `array:[${value.map(stableStringify).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `object:{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
			.join(",")}}`;
	}
	if (value === null) return "null:null";
	if (typeof value === "undefined") return "undefined:";
	if (typeof value === "function")
		return `function:${value.name || "anonymous"}`;
	if (typeof value === "symbol") return `symbol:${String(value)}`;
	if (typeof value === "bigint") return `bigint:${value.toString()}`;
	if (typeof value === "number") {
		return Number.isFinite(value)
			? `number:${value}`
			: `number:${String(value)}`;
	}
	return `${typeof value}:${JSON.stringify(value)}`;
};

const cacheKeyFor = (
	language: string | undefined,
	produceSsml: boolean,
	mathSpeech: SREMathSpeechOptions | undefined,
	mathml: string,
): string =>
	`${SRE_CACHE_VERSION}\u0000${normalizeLocale(language)}\u0000${
		produceSsml ? "ssml" : "plain"
	}\u0000${stableStringify(mathSpeech ?? null)}\u0000${mathml}`;

export interface MathSpeechCacheOptions {
	maxEntries?: number;
	/** Underlying resolver; defaults to the real SRE call. Injectable for tests. */
	resolve?: MathSpeechResolver;
}

/**
 * Build a memoized {@link MathSpeechResolver}.
 *
 * Caches only DOM-free spoken-text results keyed by
 * `(SRE version, locale, output mode, SRE mathSpeech options, MathML source)`.
 * Never caches DOM nodes or maps. Bounded by a simple LRU so long sessions do
 * not grow unbounded.
 */
export const createMemoizedMathSpeechResolver = (
	options: MathSpeechCacheOptions = {},
): MathSpeechResolver => {
	const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
	const resolve =
		options.resolve ??
		((chunk, opts) => resolveMathSpeechFromChunks([chunk], opts));
	const cache = new Map<string, ResolvedMathSpeech>();
	const setCached = (key: string, value: ResolvedMathSpeech): void => {
		cache.delete(key);
		cache.set(key, value);
		while (cache.size > maxEntries) {
			const oldest = cache.keys().next().value;
			if (oldest !== undefined) cache.delete(oldest);
		}
	};

	return async (chunk, opts) => {
		const mathSpeech = normalizeSREMathSpeechOptions(opts.mathSpeech);
		const produceSsml = opts.produceSsml === true;
		const key = cacheKeyFor(
			opts.language,
			produceSsml,
			mathSpeech,
			chunk.mathml,
		);
		const cached = cache.get(key);
		if (cached) {
			// Refresh LRU recency.
			cache.delete(key);
			cache.set(key, cached);
			return cached;
		}
		const resolved = await resolve(chunk, { ...opts, mathSpeech });
		if (produceSsml && resolved.ssml && maxEntries > 1) {
			setCached(cacheKeyFor(opts.language, false, mathSpeech, chunk.mathml), {
				speechText: resolved.speechText,
				usedMathSpeech: resolved.usedMathSpeech,
				usedFallback: resolved.usedFallback,
			});
		}
		setCached(key, resolved);
		return resolved;
	};
};
