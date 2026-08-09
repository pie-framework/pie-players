/**
 * Sign-language catalog card payloads.
 *
 * A `sign-language` catalog card carries a signing video rather than text, so
 * `CatalogCard.content` (a flat string) cannot describe it: no second source,
 * no MIME type, no poster, no time range. `CatalogCard.payload` carries those,
 * and this module is the single place that decides whether a card describes a
 * playable signed alternate.
 *
 * The payload is the *only* accepted form. A bare URL in `content` is not a
 * signing card: nothing writes that shape, so accepting it would buy a second
 * code path and a second source of truth for no existing content. Such a card
 * is reported and treated as absent rather than silently rendering.
 *
 * Validation is "treat as absent, never as text": a malformed payload must not
 * degrade to an empty video or render a URL as visible content.
 *
 * There is deliberately no signing equivalent of `data-tts-suppress`. Whether a
 * clip gives a decoding item away depends on fingerspelling versus lexical
 * signing — a fact about the recording, known to the signer and not to whoever
 * authors an attribute. And suppression is per node while a signed alternate is
 * one video per item, so the only available rule would withhold a deaf
 * candidate's whole translation over one word. Read-aloud needs a machine-readable
 * guard because a synthesizer speaks whatever text is present; signed content does
 * not exist until a signer films it. Revisit only if per-node signing docking
 * lands and a program authors signing for decoding-construct items.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	CatalogCard,
	CatalogCardPayload,
	MediaAssetRef,
	MediaFragmentRange,
	MediaSource,
	SignLanguageCardPayload,
} from "@pie-players/pie-players-shared/types";
import {
	applyMediaFragment,
	isSafeMediaSrc,
	normalizeMediaFragment,
	normalizeMediaSources,
	trimmedOrUndefined,
} from "./catalog-media.js";

// Re-exported because `applyMediaFragment` is part of the toolkit's public
// surface under this module's name; the implementation is shared with spoken
// audio cards now that both forms reference media.
export { applyMediaFragment };

/** Catalog type token for signed alternates. Matches QTI 3's `support` value. */
export const SIGN_LANGUAGE_CATALOG_TYPE = "sign-language";

/** ISO 639-3 code for American Sign Language, and QTI 3's `xml:lang` value. */
export const AMERICAN_SIGN_LANGUAGE = "ase";

/**
 * Human-readable names for the sign languages PIE has a reason to name today.
 *
 * Used for the region's accessible label, which must name the language ("American
 * Sign Language") rather than say "video". Unknown codes fall back to a labelled
 * code rather than a lie.
 */
const SIGN_LANGUAGE_NAMES: Record<string, string> = {
	ase: "American Sign Language",
	bfi: "British Sign Language",
	fsl: "French Sign Language",
	gss: "Greek Sign Language",
	mfs: "Mexican Sign Language",
	// Signed English is not a distinct sign language; it rides the same card
	// type tagged with a spoken-language code, so name it where it appears.
	"eng-US": "Signed English",
	"en-US": "Signed English",
};

export function describeSignLanguage(signLang?: string): string {
	const code = (signLang || "").trim();
	if (!code) return "Sign language";
	return SIGN_LANGUAGE_NAMES[code] ?? `Sign language (${code})`;
}

/**
 * A validated signed alternate, flattened for rendering.
 *
 * `signLang` is optional because a card need not assert a language. Callers
 * decide what to do with an unknown one; see `matchesRequestedSignLanguage`.
 */
export interface SignLanguageMedia {
	signLang?: string;
	sources: MediaSource[];
	poster?: string;
	label?: string;
	fragment?: MediaFragmentRange;
}

type SignLanguageCardLike = {
	language?: string;
	content?: string;
	payload?: CatalogCardPayload;
};

/**
 * Validate a `sign-language` card into something renderable, or `null`.
 *
 * Returns `null` — meaning "this card is absent" — when the payload yields no
 * usable source. Never returns a partially-valid result that would render an
 * empty player.
 *
 * A payload that carries sources but no `signLang` falls back to the card's
 * `language`, and then to unlabelled. Language *matching* is a separate
 * decision (see `matchesRequestedSignLanguage`) so the strict
 * no-cross-sign-language rule lives in exactly one place.
 */
export function resolveSignLanguageMedia(
	card: SignLanguageCardLike | null | undefined,
): SignLanguageMedia | null {
	if (!card) return null;
	const cardLanguage = trimmedOrUndefined(card.language);
	const payload = card.payload as SignLanguageCardPayload | undefined;

	if (!payload || typeof payload !== "object") {
		// Always say something. A signing card that yields nothing is invisible to
		// everyone except the learner who needed the accommodation, so the only
		// place it can surface is here.
		//
		// `payload` was briefly also spelled `signLanguage` by two producers, and
		// this function accepted both. It no longer does — one fact under two names
		// is what let a card render on one code path and read as absent on another —
		// so a card left over from that spelling arrives here with no payload at
		// all, which is what the second message is for.
		if (trimmedOrUndefined(card.content)) {
			console.warn(
				"[sign-language] card carries `content` but no `payload`; signing media must be a structured payload, so this card is ignored",
			);
		} else {
			console.warn(
				"[sign-language] card carries no `payload`; signing media lives in `payload` (a card written against the older `signLanguage` key needs re-importing), so this card is ignored",
			);
		}
		return null;
	}

	const media = payload.media as Partial<MediaAssetRef> | undefined;
	const sources = normalizeMediaSources(media?.sources);
	if (sources.length === 0) return null;
	const poster = trimmedOrUndefined(media?.poster);
	return {
		signLang: trimmedOrUndefined(payload.signLang) ?? cardLanguage,
		sources,
		poster: poster && isSafeMediaSrc(poster) ? poster : undefined,
		label: trimmedOrUndefined(media?.label),
		fragment: normalizeMediaFragment(payload.fragment),
	};
}

/**
 * Whether a resolved signed alternate may be shown for a requested sign
 * language.
 *
 * Deliberately strict: there is no cross-sign-language fallback. ASL, BSL and
 * LSF are not interchangeable, so showing a different sign language than the
 * one requested would hand a learner a language they may not follow — worse
 * than showing nothing. A card that asserts *no* language is accepted, because it
 * cannot be shown to be a mismatch — only a positive claim of another language
 * is refused.
 */
export function matchesRequestedSignLanguage(
	media: SignLanguageMedia,
	requestedSignLang: string,
): boolean {
	if (!media.signLang) return true;
	const requested = (requestedSignLang || "").trim();
	if (!requested) return true;
	return media.signLang.toLowerCase() === requested.toLowerCase();
}

/** Whether a catalog card is a sign-language card at all. */
export function isSignLanguageCard(card: CatalogCard): boolean {
	return card?.catalog === SIGN_LANGUAGE_CATALOG_TYPE;
}
