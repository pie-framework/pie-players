/**
 * Audio handoff between read-aloud and a media surface.
 *
 * One learner, one pair of ears: read-aloud and media audio must never run at
 * once, and the action the learner just took wins. Every media surface in the
 * toolkit's graph needs both halves of that rule — pause yourself when speech
 * starts, pause speech when you start — and there are already two such surfaces
 * (the signing region, a timed-media stimulus reached through its port) with
 * nothing in common but this. Shared so the rule has one statement: which states
 * count as speaking is the part that would drift.
 *
 * Neither half resumes what it silenced. The learner presses play.
 */

import type { TtsServiceApi } from "./interfaces.js";
import { PlaybackState } from "./TTSService.js";

/** Only what a handoff needs, so a host passing a partial service still works. */
type TtsHandoffSubscriber = Pick<
	TtsServiceApi,
	"onStateChange" | "offStateChange"
>;
type TtsHandoffPlayback = Pick<TtsServiceApi, "isPlaying" | "pause">;

const NOOP = (): void => {};

/**
 * Silence a media surface whenever read-aloud starts speaking.
 *
 * `LOADING` as well as `PLAYING`, so the pause lands before the first word rather
 * than a provider round-trip after it. A `LOADING` that then fails leaves media
 * paused, which costs the learner one press of play.
 *
 * Returns the teardown, including where there was nothing to bind.
 */
export function bindTtsAudioHandoff(args: {
	ttsService: Partial<TtsHandoffSubscriber> | null | undefined;
	/** Unique per surface: the service keys its listener sets by this. */
	listenerId: string;
	silence: () => void;
}): () => void {
	const { ttsService, listenerId, silence } = args;
	if (typeof ttsService?.onStateChange !== "function") return NOOP;
	const onTtsState = (state: PlaybackState): void => {
		if (state !== PlaybackState.PLAYING && state !== PlaybackState.LOADING) {
			return;
		}
		silence();
	};
	ttsService.onStateChange(listenerId, onTtsState);
	return () => {
		try {
			ttsService.offStateChange?.(listenerId, onTtsState);
		} catch {
			// A torn-down service is not a failure to detach from.
		}
	};
}

/**
 * The other half: media audio has started, so read-aloud yields.
 *
 * Paused rather than stopped, so the learner keeps their place in the passage.
 */
export function pauseTtsForMediaAudio(
	ttsService: Partial<TtsHandoffPlayback> | null | undefined,
): void {
	try {
		if (ttsService?.isPlaying?.()) ttsService.pause?.();
	} catch {
		// A torn-down or uninitialized TTS service must not break playback.
	}
}
