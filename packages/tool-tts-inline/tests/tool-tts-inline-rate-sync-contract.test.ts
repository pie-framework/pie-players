import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-tts-inline.svelte", import.meta.url),
).text();

describe("tool-tts-inline playback-rate synchronization", () => {
	test("keeps user/start writes off the external-prop effect path", () => {
		const effectStart = source.indexOf(
			"$effect(() => {\n\t\tconst service = ttsService;\n\t\tconst choicesKey = speedChoicesKey;",
		);
		expect(effectStart).toBeGreaterThan(-1);
		const effectEnd = source.indexOf("\n\t});", effectStart);
		expect(effectEnd).toBeGreaterThan(effectStart);
		const effect = source.slice(effectStart, effectEnd);
		const queuedSync = effect.indexOf("queueMicrotask");
		expect(queuedSync).toBeGreaterThan(-1);

		// playbackRate is deliberately read only in the queued callback. A direct
		// tracked read would make a button selection invoke both this effect and
		// handlePlaybackRate, recreating the concurrent rate-update race.
		expect(effect.slice(0, queuedSync)).not.toContain("playbackRate");
		expect(effect.slice(queuedSync)).toContain("const rate = playbackRate;");
		expect(effect).toContain("lastSyncedPlaybackRateTarget !== syncTarget");
	});
});
