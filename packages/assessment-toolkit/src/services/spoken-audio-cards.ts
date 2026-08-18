/**
 * Recorded audio as a `spoken` catalog card.
 *
 * QTI 3 treats a recording and synthesized speech as the *same* support — both
 * are `spoken`, and a card carries recorded audio through `qti-file-href` plus a
 * MIME type — so this is not a new accommodation but the other form the existing
 * one can take. Some programs prefer a human voice to synthesis; PIE's `spoken`
 * card was string-only, so it had no way to say "play this file for this node".
 *
 * A node commonly carries both forms in the same language: the reading script
 * *and* a recording of it. That is APIP's pattern and what QTI's migration
 * guidance preserves, because the script is both the source the audio was
 * generated from and the fallback for when the audio will not play. Resolution
 * chooses between them with `CatalogLookupOptions.form`; playback treats the
 * script as the recording's fallback.
 *
 * Validation posture matches sign-language cards: "treat as absent, never as
 * partially valid". A malformed payload must not produce a silent player that
 * looks like read-aloud is working.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	CatalogCardPayload,
	MediaAssetRef,
	MediaFragmentRange,
	MediaSource,
	SpokenAudioCardPayload,
} from "@pie-players/pie-players-shared/types";
import {
	isUnsupportedMediaAssetVersion,
	normalizeMediaFragment,
	normalizeMediaSources,
	trimmedOrUndefined,
} from "./catalog-media.js";

/** Catalog type token for spoken alternates. Matches QTI 3's `support` value. */
export const SPOKEN_CATALOG_TYPE = "spoken";

/** A validated recorded spoken alternate, flattened for playback. */
export interface SpokenAudioMedia {
	/**
	 * Authored order preserved. Playback uses the first entry: an `<audio>` element
	 * fed alternative `<source>` children reports failure through a path that is
	 * awkward to observe reliably, and a dependable fallback to the reading script
	 * is worth more than encoding negotiation. Extra entries are kept so a future
	 * consumer can negotiate without re-reading the card.
	 */
	sources: MediaSource[];
	fragment?: MediaFragmentRange;
	label?: string;
}

type SpokenAudioCardLike = {
	language?: string;
	content?: string;
	payload?: CatalogCardPayload;
};

/**
 * Validate a `spoken` card's payload into something playable, or `null`.
 *
 * Silent when the card simply is not a recording — a card carrying `content` is
 * a reading script, which is the overwhelmingly common case and not a fault.
 * Loud when a card looks like it meant to be a recording and cannot be played,
 * because that failure is otherwise invisible to everyone but the learner who
 * needed it.
 */
export function resolveSpokenAudioMedia(
	card: SpokenAudioCardLike | null | undefined,
): SpokenAudioMedia | null {
	if (!card) return null;
	const payload = card.payload as SpokenAudioCardPayload | undefined;
	if (!payload || typeof payload !== "object") {
		// A script card, not a broken audio card. Resolution asks for the payload
		// form as a *preference*, so getting a `content` card back here is normal.
		return null;
	}

	const media = payload.media as Partial<MediaAssetRef> | undefined;
	if (!media || typeof media !== "object") {
		console.warn(
			"[spoken-audio] card carries a `payload` with no `media`; recorded speech needs `media.sources`, so this card is ignored and read-aloud falls back to the script or generated speech",
		);
		return null;
	}

	if (isUnsupportedMediaAssetVersion(media.version)) {
		console.warn(
			`[spoken-audio] card's media declares version ${String(media.version)}, which this build does not render; the card is ignored and read-aloud falls back to the script or generated speech`,
		);
		return null;
	}

	// A signing video filed under `spoken` is a mis-authored card, not an audio
	// track to guess at. Refusing it keeps the two card types from quietly
	// swapping roles.
	if (media.kind !== undefined && media.kind !== "audio") {
		console.warn(
			`[spoken-audio] card's media is kind "${media.kind}", not "audio"; a spoken card carries recorded speech, so this card is ignored`,
		);
		return null;
	}

	const sources = normalizeMediaSources(media.sources);
	if (sources.length === 0) {
		console.warn(
			"[spoken-audio] card's `media.sources` yielded no usable URL; read-aloud falls back to the script or generated speech",
		);
		return null;
	}

	return {
		sources,
		fragment: normalizeMediaFragment(payload.fragment),
		label: trimmedOrUndefined(media.label),
	};
}
