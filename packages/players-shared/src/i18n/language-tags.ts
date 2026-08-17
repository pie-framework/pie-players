/**
 * BCP-47 language tag comparison.
 *
 * Deliberately carries no locale data and no DOM access: this module is the one
 * piece of language machinery that everything else needs, including the
 * accessibility catalog resolver and TTS voice selection, neither of which wants
 * a message catalog. Importing `../i18n/index.js` would pull the eagerly-bundled
 * English translations, so this stays a separate entry point.
 *
 * Content producers do not agree on tag syntax. The Learnosity transform emits
 * POSIX `es_ES`, QTI catalog cards carry BCP-47 `xml:lang`, and pie-elements-ng
 * carries a hand-written POSIX-to-BCP-47 mapping table of its own. Comparing
 * with `===`, as the catalog resolver did, means an `es_ES` card matches no
 * request for `es-ES` and surfaces only through a no-language-constraint
 * fallback — resolution by accident.
 *
 * @module @pie-players/pie-players-shared/i18n/language-tags
 */

/**
 * Canonicalize a language tag for comparison.
 *
 * Converts POSIX underscores to hyphens, strips a POSIX charset or modifier
 * suffix (`es_ES.UTF-8`, `es_ES@euro`), and lowercases. Lowercasing rather than
 * applying BCP-47 display casing is intentional — this output is a comparison
 * key, not something to render.
 *
 * Returns an empty string for nullish or blank input, which callers read as
 * "this card declares no language".
 */
export function normalizeLanguageTag(tag: string | null | undefined): string {
	if (!tag) return "";
	const separatorsUnified = tag.trim().replace(/_/g, "-");
	const withoutPosixSuffix = separatorsUnified.split(/[.@]/)[0];
	return withoutPosixSuffix.toLowerCase();
}

/**
 * Whether two language tags denote the same locale, ignoring separator style and
 * case. Two tags that both declare no language are not a match.
 */
export function languageTagsEqual(
	a: string | null | undefined,
	b: string | null | undefined,
): boolean {
	const left = normalizeLanguageTag(a);
	if (!left) return false;
	return left === normalizeLanguageTag(b);
}

/**
 * The RFC 4647 lookup sequence for a tag, most specific first.
 *
 * `es-MX` yields `["es-mx", "es"]`, so a request for Mexican Spanish reaches a
 * card tagged plain `es` without also reaching one tagged `es-ES`. Truncation
 * never stops on a singleton subtag (`x`, `u`), per RFC 4647 §3.4, and never
 * produces a bare region or script.
 */
export function languageTagLookupSequence(
	tag: string | null | undefined,
): string[] {
	const normalized = normalizeLanguageTag(tag);
	if (!normalized) return [];

	const subtags = normalized.split("-");
	const sequence: string[] = [];

	for (let length = subtags.length; length > 0; length--) {
		const candidate = subtags.slice(0, length);
		// A trailing singleton introduces an extension with nothing left in it.
		if (candidate.length > 1 && candidate[candidate.length - 1].length === 1) {
			continue;
		}
		sequence.push(candidate.join("-"));
	}

	return sequence;
}

/**
 * Best available tag for a request, by RFC 4647 lookup, or `undefined` when
 * nothing matches. Ranking is by the request's specificity rather than the
 * candidates' order, so `es-MX` prefers an `es-MX` candidate over an `es` one
 * however they were authored.
 */
export function findBestLanguageMatch(
	requested: string | null | undefined,
	available: readonly (string | null | undefined)[],
): string | undefined {
	for (const step of languageTagLookupSequence(requested)) {
		const hit = available.find(
			(candidate) => normalizeLanguageTag(candidate) === step,
		);
		if (hit != null) return hit;
	}
	return undefined;
}
