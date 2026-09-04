import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryCache } from "./cache.js";
import type { SynthesizeResponse } from "./types.js";

const response = (text: string): SynthesizeResponse => ({
	audio: `audio-for-${text}`,
	contentType: "audio/mpeg",
	speechMarks: [],
	metadata: {
		providerId: "test",
		voice: "Joanna",
		duration: 1,
		charCount: text.length,
		cached: false,
	},
});

/** Fill a cache to exactly `count` entries, keyed `key-0` … `key-<count-1>`. */
async function fill(cache: MemoryCache, count: number): Promise<void> {
	for (let i = 0; i < count; i++) {
		await cache.set(`key-${i}`, response(`key-${i}`));
	}
}

const keyCount = async (cache: MemoryCache): Promise<number> =>
	(await cache.getStats()).keyCount;

describe("MemoryCache eviction order", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps a re-read early key when the next insertion evicts", async () => {
		const cache = new MemoryCache(3);
		await fill(cache, 3);

		// `key-0` is the oldest insertion; reading it makes it the most recently
		// used, so the insertion below must take `key-1` instead.
		expect(await cache.get("key-0")).not.toBeNull();
		await cache.set("key-3", response("key-3"));

		expect(await cache.has("key-0")).toBe(true);
		expect(await cache.has("key-1")).toBe(false);
		expect(await cache.has("key-2")).toBe(true);
		expect(await cache.has("key-3")).toBe(true);
	});

	it("evicts an untouched early key", async () => {
		const cache = new MemoryCache(3);
		await fill(cache, 3);

		await cache.set("key-3", response("key-3"));

		expect(await cache.has("key-0")).toBe(false);
		expect(await cache.has("key-3")).toBe(true);
	});

	it("keeps a hot key alive under a stream of cold insertions", async () => {
		// The reported failure: the busiest passage is also the oldest insertion,
		// so the FIFO form evicted it first and re-synthesized it every pass.
		const cache = new MemoryCache(4);
		await cache.set("hot", response("hot"));
		await fill(cache, 3);

		for (let i = 0; i < 20; i++) {
			expect(await cache.get("hot")).not.toBeNull();
			await cache.set(`cold-${i}`, response(`cold-${i}`));
		}

		expect((await cache.getStats()).misses).toBe(0);
	});

	it("refreshes recency when an existing key is overwritten", async () => {
		const cache = new MemoryCache(3);
		await fill(cache, 3);

		await cache.set("key-0", response("key-0-again"));
		await cache.set("key-3", response("key-3"));

		expect(await cache.has("key-0")).toBe(true);
		expect(await cache.has("key-1")).toBe(false);
		expect(await keyCount(cache)).toBe(3);
	});

	it("holds at most maxSize entries across many insertions", async () => {
		const cache = new MemoryCache(5);
		await fill(cache, 50);

		expect(await keyCount(cache)).toBe(5);
		expect(await cache.has("key-49")).toBe(true);
		expect(await cache.has("key-44")).toBe(false);
	});

	it("drops expired entries before a live one at capacity", async () => {
		const now = vi.spyOn(Date, "now").mockReturnValue(0);

		const cache = new MemoryCache(3);
		await cache.set("short-a", response("short-a"), 10);
		await cache.set("short-b", response("short-b"), 10);
		await cache.set("long", response("long"), 3600);

		now.mockReturnValue(20_000);
		await cache.set("fresh", response("fresh"), 3600);

		// Both ten-second entries went on the insertion itself, so `long` was
		// never an eviction candidate. Read the count before any `has` call: `has`
		// reclaims an expired key it is asked about, which would hide the sweep.
		expect(await keyCount(cache)).toBe(2);
		expect(await cache.has("short-a")).toBe(false);
		expect(await cache.has("short-b")).toBe(false);
		expect(await cache.has("long")).toBe(true);
		expect(await cache.has("fresh")).toBe(true);
	});

	it("counts an expired read as a miss and reclaims the key", async () => {
		const now = vi.spyOn(Date, "now").mockReturnValue(0);

		const cache = new MemoryCache(3);
		await cache.set("gone", response("gone"), 10);

		now.mockReturnValue(20_000);
		expect(await cache.get("gone")).toBeNull();

		const stats = await cache.getStats();
		expect(stats.misses).toBe(1);
		expect(stats.keyCount).toBe(0);
	});

	it("returns a fresh object marked as served from cache on each hit", async () => {
		const cache = new MemoryCache(3);
		await cache.set("key", response("key"));

		const first = await cache.get("key");
		expect(first?.metadata.cached).toBe(true);

		const second = await cache.get("key");
		expect(second?.metadata.cached).toBe(true);
		expect(second).not.toBe(first);
	});
});
