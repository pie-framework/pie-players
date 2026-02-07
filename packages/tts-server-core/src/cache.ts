/**
 * Caching interface for TTS results
 * @module @pie-players/tts-server-core
 */

import type { SynthesizeResponse } from "./types.js";

/**
 * Cache key components for TTS synthesis
 */
export interface CacheKeyComponents {
	/** Provider identifier */
	providerId: string;

	/** Text to synthesize */
	text: string;

	/** Voice ID */
	voice: string;

	/** Language code */
	language?: string;

	/** Speech rate */
	rate?: number;

	/** Audio format */
	format?: string;
}

/**
 * Cache interface for TTS providers
 */
export interface ITTSCache {
	/**
	 * Get cached synthesis result
	 *
	 * @param key - Cache key
	 * @returns Cached result or null if not found
	 */
	get(key: string): Promise<SynthesizeResponse | null>;

	/**
	 * Store synthesis result in cache
	 *
	 * @param key - Cache key
	 * @param value - Synthesis response to cache
	 * @param ttl - Time to live in seconds (optional)
	 */
	set(key: string, value: SynthesizeResponse, ttl?: number): Promise<void>;

	/**
	 * Check if key exists in cache
	 *
	 * @param key - Cache key
	 * @returns True if key exists
	 */
	has(key: string): Promise<boolean>;

	/**
	 * Delete cached result
	 *
	 * @param key - Cache key
	 */
	delete(key: string): Promise<void>;

	/**
	 * Clear all cached results
	 */
	clear(): Promise<void>;

	/**
	 * Get cache statistics
	 */
	getStats?(): Promise<CacheStats>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
	/** Total cache hits */
	hits: number;

	/** Total cache misses */
	misses: number;

	/** Hit rate (0.0 to 1.0) */
	hitRate: number;

	/** Number of keys in cache */
	keyCount: number;

	/** Total size in bytes (if available) */
	sizeBytes?: number;
}

/**
 * Generate cache key from components
 *
 * @param components - Cache key components
 * @returns Cache key string
 */
export function generateCacheKey(components: CacheKeyComponents): string {
	const {
		providerId,
		text,
		voice,
		language = "",
		rate = 1.0,
		format = "mp3",
	} = components;

	// Create deterministic key from components
	const keyParts = [
		"tts",
		providerId,
		voice,
		language,
		rate.toFixed(2),
		format,
		text,
	];

	// Use simple concatenation with delimiter
	// In production, consider using a hash function for shorter keys
	return keyParts.join(":");
}

/**
 * Generate SHA-256 hash for cache key
 * Useful for creating shorter keys from long text
 *
 * @param text - Text to hash
 * @returns Hex string hash
 */
export async function hashText(text: string): Promise<string> {
	// Use Web Crypto API (available in modern Node.js and browsers)
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate short cache key using hash
 *
 * @param components - Cache key components
 * @returns Promise resolving to cache key
 */
export async function generateHashedCacheKey(
	components: CacheKeyComponents,
): Promise<string> {
	const {
		providerId,
		text,
		voice,
		language = "",
		rate = 1.0,
		format = "mp3",
	} = components;

	// Hash the text to keep key length reasonable
	const textHash = await hashText(text);

	const keyParts = [
		"tts",
		providerId,
		voice,
		language,
		rate.toFixed(2),
		format,
		textHash,
	];

	return keyParts.join(":");
}

/**
 * In-memory cache implementation
 * Simple LRU cache for development/testing
 */
export class MemoryCache implements ITTSCache {
	private cache = new Map<
		string,
		{ value: SynthesizeResponse; expires: number }
	>();
	private hits = 0;
	private misses = 0;
	private maxSize: number;

	constructor(maxSize = 100) {
		this.maxSize = maxSize;
	}

	async get(key: string): Promise<SynthesizeResponse | null> {
		const entry = this.cache.get(key);

		if (!entry) {
			this.misses++;
			return null;
		}

		// Check expiration
		if (Date.now() > entry.expires) {
			this.cache.delete(key);
			this.misses++;
			return null;
		}

		this.hits++;

		// Update metadata to mark as served from cache
		const result = { ...entry.value };
		result.metadata = { ...result.metadata, cached: true };

		return result;
	}

	async set(
		key: string,
		value: SynthesizeResponse,
		ttl = 86400,
	): Promise<void> {
		// Enforce max size (simple LRU)
		if (this.cache.size >= this.maxSize) {
			// Delete oldest entry (first key)
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.cache.delete(firstKey);
			}
		}

		this.cache.set(key, {
			value,
			expires: Date.now() + ttl * 1000,
		});
	}

	async has(key: string): Promise<boolean> {
		const entry = this.cache.get(key);
		if (!entry) return false;

		// Check expiration
		if (Date.now() > entry.expires) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}

	async clear(): Promise<void> {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
	}

	async getStats(): Promise<CacheStats> {
		const total = this.hits + this.misses;
		return {
			hits: this.hits,
			misses: this.misses,
			hitRate: total > 0 ? this.hits / total : 0,
			keyCount: this.cache.size,
		};
	}
}
