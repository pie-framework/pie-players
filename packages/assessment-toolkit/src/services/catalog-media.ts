/**
 * Validation primitives shared by every catalog card whose payload references
 * media.
 *
 * Extracted from `sign-language-cards.ts` when `spoken` cards gained a recorded
 * audio form: both card types take authored, wire-facing URLs and hand them to a
 * media element in the learner's browser, so both need the same scheme
 * allow-list and the same "treat as absent, never as partially valid" posture.
 * Two copies of a URL allow-list is one copy that gets a fix and one that does
 * not.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	MediaFragmentRange,
	MediaSource,
} from "@pie-players/pie-players-shared/types";

/**
 * Media source URLs are handed to a media element in the learner's browser. Only
 * schemes such an element can actually fetch are allowed; anything else is
 * dropped so an authored `javascript:` / `file:` URL cannot ride into the DOM.
 * Relative and protocol-relative URLs are allowed — host content is commonly
 * served from the same origin as the player.
 */
const DISALLOWED_SRC_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SRC_SCHEMES = new Set(["http:", "https:", "data:", "blob:"]);

export function isSafeMediaSrc(raw: unknown): raw is string {
	if (typeof raw !== "string") return false;
	const src = raw.trim();
	if (!src) return false;
	// Relative ("/video.mp4", "video.mp4") and protocol-relative ("//cdn/x.mp4")
	// forms carry no scheme to check and inherit the document's.
	if (src.startsWith("//") || !DISALLOWED_SRC_SCHEME.test(src)) return true;
	const scheme = src.slice(0, src.indexOf(":") + 1).toLowerCase();
	return ALLOWED_SRC_SCHEMES.has(scheme);
}

export function normalizeMediaSources(raw: unknown): MediaSource[] {
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
		// Deduplicated by `src`, because the signing region renders `<source>`
		// elements in an `{#each}` keyed on exactly that: an authored card listing
		// one URL twice — the same file under two MIME types is the plausible way —
		// would otherwise throw Svelte's duplicate-key error and take the whole
		// region down rather than degrade. The first entry wins, so authored order
		// still decides which encoding the browser is offered first.
		if (sources.some((existing) => existing.src === source.src)) continue;
		sources.push(source);
	}
	return sources;
}

export function normalizeMediaFragment(
	raw: unknown,
): MediaFragmentRange | undefined {
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

export function trimmedOrUndefined(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

/**
 * Apply a fragment range to a source URL as a Media Fragments URI, so one
 * recording can serve several content nodes. Browsers honour the start offset;
 * the end offset is enforced by the caller, because support for the end bound is
 * inconsistent.
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
