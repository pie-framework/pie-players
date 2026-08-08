/**
 * Sign-language catalog card payloads.
 *
 * A `sign-language` catalog card carries a signing video rather than text, so
 * `CatalogCard.content` (a flat string) cannot describe it: no second source,
 * no MIME type, no poster, no time range. `CatalogCard.payload` carries those,
 * and this module is the single place that decides whether a card describes a
 * playable signed alternate.
 *
 * Validation is deliberately "treat as absent, never as text": a malformed
 * payload must not degrade to an empty video or render a URL as visible
 * content. The legacy single-source form — a bare URL in `content` with no
 * payload — stays supported, because authored content predates the payload.
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
 * `signLang` is optional because an unlabelled legacy card cannot assert a
 * language. Callers decide what to do with an unknown language; see
 * `matchesRequestedSignLanguage`.
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
 * Media source URLs are handed to a `<video>` in the learner's browser. Only
 * schemes a media element can actually fetch are allowed; anything else is
 * dropped so an authored `javascript:` / `file:` URL cannot ride into the DOM.
 * Relative and protocol-relative URLs are allowed — host content is commonly
 * served from the same origin as the player.
 */
const DISALLOWED_SRC_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SRC_SCHEMES = new Set(["http:", "https:", "data:", "blob:"]);

function isSafeMediaSrc(raw: unknown): raw is string {
	if (typeof raw !== "string") return false;
	const src = raw.trim();
	if (!src) return false;
	// Relative ("/video.mp4", "video.mp4") and protocol-relative ("//cdn/x.mp4")
	// forms carry no scheme to check and inherit the document's.
	if (src.startsWith("//") || !DISALLOWED_SRC_SCHEME.test(src)) return true;
	const scheme = src.slice(0, src.indexOf(":") + 1).toLowerCase();
	return ALLOWED_SRC_SCHEMES.has(scheme);
}

function normalizeSources(raw: unknown): MediaSource[] {
	if (!Array.isArray(raw)) return [];
	const sources: MediaSource[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const candidate = entry as Partial<MediaSource>;
		if (!isSafeMediaSrc(candidate.src)) continue;
		const source: MediaSource = { src: candidate.src.trim() };
		if (typeof candidate.type === "string" && candidate.type.trim()) {
			source.type = candidate.type.trim();
		}
		if (Number.isFinite(candidate.width)) source.width = candidate.width;
		if (Number.isFinite(candidate.height)) source.height = candidate.height;
		sources.push(source);
	}
	return sources;
}

function normalizeFragment(raw: unknown): MediaFragmentRange | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const candidate = raw as Partial<MediaFragmentRange>;
	const start = Number(candidate.startSeconds);
	if (!Number.isFinite(start) || start < 0) return undefined;
	const end = Number(candidate.endSeconds);
	// An end at or before the start would produce a zero/negative slice; treat
	// it as "no end" rather than a range that can never play.
	if (!Number.isFinite(end) || end <= start) return { startSeconds: start };
	return { startSeconds: start, endSeconds: end };
}

function trimmedOrUndefined(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function isSignLanguagePayload(
	payload: CatalogCardPayload | undefined,
): payload is SignLanguageCardPayload {
	return Boolean(
		payload &&
			typeof payload === "object" &&
			(payload as SignLanguageCardPayload).kind === SIGN_LANGUAGE_CATALOG_TYPE,
	);
}

/**
 * Validate a `sign-language` card into something renderable, or `null`.
 *
 * Returns `null` — meaning "this card is absent" — when neither the typed
 * payload nor the legacy `content` URL yields a usable source. Never returns a
 * partially-valid result that would render an empty player.
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

	if (isSignLanguagePayload(card.payload)) {
		const media = card.payload.media as Partial<MediaAssetRef> | undefined;
		const sources = normalizeSources(media?.sources);
		if (sources.length === 0) return null;
		const poster = trimmedOrUndefined(media?.poster);
		return {
			signLang: trimmedOrUndefined(card.payload.signLang) ?? cardLanguage,
			sources,
			poster: poster && isSafeMediaSrc(poster) ? poster : undefined,
			label: trimmedOrUndefined(media?.label),
			fragment: normalizeFragment(card.payload.fragment),
		};
	}

	// Legacy single-source form: a bare URL in `content`. Authored content
	// predates the payload, so this must keep resolving.
	if (isSafeMediaSrc(card.content)) {
		return {
			signLang: cardLanguage,
			sources: [{ src: card.content.trim() }],
		};
	}

	return null;
}

/**
 * Whether a resolved signed alternate may be shown for a requested sign
 * language.
 *
 * Deliberately strict: there is no cross-sign-language fallback. ASL, BSL and
 * LSF are not interchangeable, so showing a different sign language than the
 * one requested would hand a learner a language they may not follow — worse
 * than showing nothing. An *unlabelled* card (legacy content that asserts no
 * language) is accepted, because rejecting it would make existing content dead
 * rather than safe.
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

/**
 * Apply a fragment range to a source URL as a Media Fragments URI, so one
 * recording can serve several content nodes. Browsers honour the start offset;
 * the region enforces the end offset itself, because support for the end bound
 * is inconsistent.
 */
export function applyMediaFragment(
	src: string,
	fragment?: MediaFragmentRange,
): string {
	if (!fragment) return src;
	// Never stack a second fragment onto a URL that already carries one — the
	// authored value wins.
	if (src.includes("#")) return src;
	const end =
		fragment.endSeconds !== undefined ? `,${fragment.endSeconds}` : "";
	return `${src}#t=${fragment.startSeconds}${end}`;
}

/** Whether a catalog card is a sign-language card at all. */
export function isSignLanguageCard(card: CatalogCard): boolean {
	return card?.catalog === SIGN_LANGUAGE_CATALOG_TYPE;
}
