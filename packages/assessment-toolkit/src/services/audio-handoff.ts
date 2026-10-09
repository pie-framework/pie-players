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
type TtsHandoffSubscriber = Pick<TtsServiceApi, "onStateChange">;
type TtsHandoffPlayback = Pick<TtsServiceApi, "getState" | "pause">;

const NOOP = (): void => {};

/**
 * Read-aloud counts as speaking from the moment a read starts loading. A
 * loading read sounds as soon as its audio arrives, so both halves treat it as
 * a playing one.
 */
function isSpeaking(state: PlaybackState | undefined): boolean {
	return state === PlaybackState.PLAYING || state === PlaybackState.LOADING;
}

/**
 * Silence a media surface whenever read-aloud starts speaking.
 *
 * Silenced on loading, so the pause lands before the first word rather than a
 * provider round-trip after it. A load that then fails leaves media paused,
 * which costs the learner one press of play.
 *
 * Returns the teardown, including where there was nothing to bind.
 */
export function bindTtsAudioHandoff(args: {
	ttsService: Partial<TtsHandoffSubscriber> | null | undefined;
	silence: () => void;
}): () => void {
	const { ttsService, silence } = args;
	if (typeof ttsService?.onStateChange !== "function") return NOOP;
	const unsubscribe = ttsService.onStateChange((state: PlaybackState) => {
		if (isSpeaking(state)) silence();
	});
	return () => {
		try {
			unsubscribe();
		} catch {
			// A torn-down service is not a failure to detach from.
		}
	};
}

/**
 * The other half: media audio has started, so read-aloud yields.
 *
 * Paused rather than stopped, so the learner keeps their place in the passage.
 * A read still loading pauses too, and holds until the learner resumes it.
 */
export function pauseTtsForMediaAudio(
	ttsService: Partial<TtsHandoffPlayback> | null | undefined,
): void {
	try {
		if (isSpeaking(ttsService?.getState?.())) ttsService?.pause?.();
	} catch {
		// A torn-down or uninitialized TTS service must not break playback.
	}
}
