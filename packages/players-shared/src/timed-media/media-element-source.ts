/**
 * The native `<video>` / `<audio>` adapter for the Media Time Source port.
 *
 * Short by design. The port is shaped after `HTMLMediaElement` precisely so that
 * the browser's own media element satisfies it in a few lines, which is what
 * makes the port testable and the eventual media-player dependency reversible
 * rather than load-bearing.
 *
 * Touches no DOM until called, so this module stays importable in Node beside the
 * rest of the pure timed-media contract.
 */

import type {
	MediaTimeSource,
	MediaTimeSourceCapabilities,
	MediaTimeSourceNotification,
} from "./types.js";

/**
 * A native media element can be paused and its position can be written, so both
 * capabilities hold. A host wrapping something that only *looks* native — an
 * embed behind a facade, a remote-controlled player — overrides them rather than
 * letting the section assume control it does not have.
 */
export const NATIVE_MEDIA_CAPABILITIES: MediaTimeSourceCapabilities = {
	canPause: true,
	canRestrictSeeking: true,
};

export interface MediaElementTimeSourceOptions {
	capabilities?: Partial<MediaTimeSourceCapabilities>;
}

/** The subset of `HTMLMediaElement` this adapter uses. */
type MediaElementLike = Pick<
	HTMLMediaElement,
	| "currentTime"
	| "duration"
	| "paused"
	| "seekable"
	| "play"
	| "pause"
	| "addEventListener"
	| "removeEventListener"
>;

const NOTIFYING_EVENTS: ReadonlyArray<{
	name: string;
	type: MediaTimeSourceNotification["type"];
}> = [
	{ name: "timeupdate", type: "time" },
	// Both halves of a seek are reported. `seeking` is where a clamp can still
	// land before the frame paints at the new position; `seeked` is the one that
	// always fires. The reduction is idempotent for an already-legal position, so
	// reporting twice costs nothing.
	{ name: "seeking", type: "seek" },
	{ name: "seeked", type: "seek" },
	{ name: "play", type: "play" },
	{ name: "pause", type: "pause" },
	{ name: "ended", type: "ended" },
];

export function createMediaElementTimeSource(
	element: MediaElementLike,
	options: MediaElementTimeSourceOptions = {},
): MediaTimeSource {
	const capabilities: MediaTimeSourceCapabilities = {
		...NATIVE_MEDIA_CAPABILITIES,
		...(options.capabilities ?? {}),
	};

	const listeners = new Set<
		(notification: MediaTimeSourceNotification) => void
	>();

	function currentTime(): number {
		const value = element.currentTime;
		return Number.isFinite(value) && value >= 0 ? value : 0;
	}

	function notify(type: MediaTimeSourceNotification["type"]): void {
		const notification = { type, currentTime: currentTime() } as
			MediaTimeSourceNotification;
		for (const listener of Array.from(listeners)) {
			try {
				listener(notification);
			} catch {
				// A subscriber that throws must not stop the others or break playback:
				// this runs on every `timeupdate`.
			}
		}
	}

	const handlers = NOTIFYING_EVENTS.map((entry) => ({
		name: entry.name,
		handler: () => notify(entry.type),
	}));

	return {
		get currentTime() {
			return currentTime();
		},
		get duration() {
			// `NaN` before metadata loads, as on the element itself. Callers that
			// need a real duration wait for it rather than reading a zero that looks
			// like a finished video.
			return element.duration;
		},
		get paused() {
			return element.paused;
		},
		get seekable() {
			return element.seekable ?? null;
		},
		capabilities,
		play() {
			return element.play();
		},
		pause() {
			element.pause();
		},
		seekTo(seconds: number) {
			if (!Number.isFinite(seconds) || seconds < 0) return;
			element.currentTime = seconds;
		},
		subscribe(listener) {
			listeners.add(listener);
			if (listeners.size === 1) {
				for (const entry of handlers) {
					element.addEventListener(entry.name, entry.handler);
				}
			}
			return () => {
				if (!listeners.delete(listener)) return;
				if (listeners.size > 0) return;
				for (const entry of handlers) {
					element.removeEventListener(entry.name, entry.handler);
				}
			};
		},
	};
}

/**
 * Find the media element a stimulus renderable mounted.
 *
 * Deliberately a plain query rather than a contract on what the stimulus is: a
 * passage config mounting `<pie-video-stimulus>`, and one carrying authored
 * `<video>` markup, both end up with a media element in the card's subtree, and
 * the section needs no way to tell them apart. An element that wants to supply its
 * own port registers one instead.
 */
export function findMediaElement(root: ParentNode | null): HTMLMediaElement | null {
	if (!root) return null;
	const found = root.querySelector("video, audio");
	return (found as HTMLMediaElement | null) ?? null;
}
