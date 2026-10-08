import { describe, expect, test } from "bun:test";
import {
	bindTtsAudioHandoff,
	pauseTtsForMediaAudio,
} from "../src/services/audio-handoff";
import { PlaybackState } from "../src/services/TTSService";

/** A TTS service reduced to what a handoff touches. */
function fakeTts(initial: PlaybackState = PlaybackState.IDLE) {
	const listeners = new Map<string, (state: PlaybackState) => void>();
	const calls: string[] = [];
	let state = initial;
	return {
		calls,
		emit(next: PlaybackState) {
			state = next;
			for (const listener of Array.from(listeners.values())) listener(next);
		},
		listenerCount: () => listeners.size,
		service: {
			onStateChange(id: string, callback: (state: PlaybackState) => void) {
				listeners.set(id, callback);
			},
			offStateChange(id: string) {
				listeners.delete(id);
			},
			getState: () => state,
			pause() {
				calls.push("pause");
			},
		},
	};
}

describe("bindTtsAudioHandoff", () => {
	test("silences the media surface as speech begins, and not for the states that end it", () => {
		const tts = fakeTts();
		let silenced = 0;
		const teardown = bindTtsAudioHandoff({
			ttsService: tts.service,
			listenerId: "surface-1",
			silence: () => {
				silenced += 1;
			},
		});

		// `LOADING` counts: the pause has to land before the first word, not a
		// provider round-trip after it.
		tts.emit(PlaybackState.LOADING);
		expect(silenced).toBe(1);
		tts.emit(PlaybackState.PLAYING);
		expect(silenced).toBe(2);

		// Speech ending never resumes media — the learner presses play.
		tts.emit(PlaybackState.PAUSED);
		tts.emit(PlaybackState.IDLE);
		tts.emit(PlaybackState.ERROR);
		expect(silenced).toBe(2);

		teardown();
		expect(tts.listenerCount()).toBe(0);
		tts.emit(PlaybackState.PLAYING);
		expect(silenced).toBe(2);
	});

	test("a missing or partial service binds nothing and still returns a teardown", () => {
		expect(() =>
			bindTtsAudioHandoff({
				ttsService: null,
				listenerId: "surface-1",
				silence: () => {},
			})(),
		).not.toThrow();
		// A host may hand a media surface an object that is not a TTS service yet.
		expect(() =>
			bindTtsAudioHandoff({
				ttsService: { isPlaying: () => true } as never,
				listenerId: "surface-1",
				silence: () => {},
			})(),
		).not.toThrow();
	});
});

describe("pauseTtsForMediaAudio", () => {
	test("pauses speech that is running or loading and leaves silence alone", () => {
		const speaking = fakeTts(PlaybackState.PLAYING);
		pauseTtsForMediaAudio(speaking.service);
		expect(speaking.calls).toEqual(["pause"]);

		// A loading read sounds once its audio arrives, over the media.
		const loading = fakeTts(PlaybackState.LOADING);
		pauseTtsForMediaAudio(loading.service);
		expect(loading.calls).toEqual(["pause"]);

		for (const quiet of [
			PlaybackState.IDLE,
			PlaybackState.PAUSED,
			PlaybackState.ERROR,
		]) {
			const idle = fakeTts(quiet);
			pauseTtsForMediaAudio(idle.service);
			expect(idle.calls).toEqual([]);
		}
	});

	test("a torn-down service does not break the playback that asked", () => {
		expect(() => pauseTtsForMediaAudio(null)).not.toThrow();
		expect(() =>
			pauseTtsForMediaAudio({
				getState: () => {
					throw new Error("service is gone");
				},
			}),
		).not.toThrow();
	});
});
