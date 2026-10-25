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
 * key, not something to render. `toLanguageTag` is the form to render.
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
 * A tag in BCP-47 syntax with its authored casing kept: POSIX underscores become
 * hyphens, so `es_ES` renders as `es-ES`. The form for a `lang` attribute or a
 * platform locale API.
 *
 * Returns an empty string for nullish or blank input.
 */
export function toLanguageTag(tag: string | null | undefined): string {
	return tag ? tag.trim().replace(/_/g, "-") : "";
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

/** `maximize()` runs on every resolution, for each candidate catalog. */
const scripts = new Map<string, string | undefined>();

/**
 * The script a tag is written in, lowercased: explicit (`sr-Latn`), or the
 * CLDR likely script (`zh-TW` maximizes to Hant, `sr` to Cyrl). `undefined`
 * when the tag has no script data or the runtime has no `Intl.Locale`.
 */
export function languageTagScript(
	tag: string | null | undefined,
): string | undefined {
	const normalized = normalizeLanguageTag(tag);
	if (
		!normalized ||
		typeof Intl === "undefined" ||
		typeof Intl.Locale !== "function"
	) {
		return undefined;
	}
	if (scripts.has(normalized)) return scripts.get(normalized);
	let script: string | undefined;
	try {
		script = new Intl.Locale(normalized).maximize().script?.toLowerCase();
	} catch {
		// Not a tag `Intl.Locale` parses: no script data.
	}
	scripts.set(normalized, script);
	return script;
}

/**
 * Whether a catalog reached by widening serves a request in the same script.
 * A tag without script data passes, so a runtime without `Intl.Locale`
 * resolves as plain RFC 4647 lookup.
 */
export function languageTagScriptsMatch(
	requested: string | null | undefined,
	candidate: string | null | undefined,
): boolean {
	const requestedScript = languageTagScript(requested);
	const candidateScript = languageTagScript(candidate);
	return (
		!requestedScript || !candidateScript || requestedScript === candidateScript
	);
}

/**
 * The script-aware lookup sequence: the RFC 4647 sequence with the language
 * and likely script inserted before the bare language, so `zh-TW` yields
 * `["zh-tw", "zh-hant", "zh"]`. A bare-language step serves the request only
 * in the same script, which `findBestLanguageMatch` checks.
 */
export function languageTagScriptLookupSequence(
	tag: string | null | undefined,
): string[] {
	const sequence = languageTagLookupSequence(tag);
	const script = languageTagScript(tag);
	if (!script || sequence.length < 2) return sequence;
	const language = sequence[sequence.length - 1];
	const withScript = `${language}-${script}`;
	if (sequence.includes(withScript)) return sequence;
	return [...sequence.slice(0, -1), withScript, language];
}

/**
 * Best available tag for a request, or `undefined` when nothing matches.
 * Ranking is by the request's specificity rather than the candidates' order,
 * so `es-MX` prefers an `es-MX` candidate over an `es` one however they were
 * authored, and `zh-TW` reaches `zh-Hant`. A catalog shorter than the request
 * serves it only in the same script: a bare `zh` catalog is Simplified, so
 * `zh-TW` passes it by.
 */
export function findBestLanguageMatch(
	requested: string | null | undefined,
	available: readonly (string | null | undefined)[],
): string | undefined {
	const exact = normalizeLanguageTag(requested);
	for (const step of languageTagScriptLookupSequence(requested)) {
		const hit = available.find(
			(candidate) =>
				normalizeLanguageTag(candidate) === step &&
				(step === exact || languageTagScriptsMatch(requested, candidate)),
		);
		if (hit != null) return hit;
	}
	return undefined;
}

/**
 * `findBestLanguageMatch`, then primary-subtag widening, so `nl-BE` and a bare
 * `nl` reach a regional `nl-NL` and `es-MX` reaches `es-ES`. Both stay within
 * the request's script: `zh` never reaches `zh-TW`, and `sr-Latn` may reach
 * `sr-ME`. The rule that picks an interface catalog and a content variant alike.
 */
export function findClosestLanguageMatch(
	requested: string | null | undefined,
	available: readonly (string | null | undefined)[],
): string | undefined {
	const best = findBestLanguageMatch(requested, available);
	if (best !== undefined) return best;
	const language = normalizeLanguageTag(requested).split("-")[0];
	if (!language) return undefined;
	const sibling = available.find(
		(candidate) =>
			normalizeLanguageTag(candidate).split("-")[0] === language &&
			languageTagScriptsMatch(requested, candidate),
	);
	return sibling ?? undefined;
}

/** The content language a backend serves, and whether it is a substitute. */
export interface ContentLanguageMatch {
	/** The `available` entry served, as authored. */
	language: string;
	/** `"fallback"` when the default language stands in for the request. */
	substitution?: "fallback";
}

/**
 * The language to serve content in: the closest `available` match for the
 * first `requested` tag that has one, under `findClosestLanguageMatch`. With no
 * match, `defaultLanguage` is served as a fallback unless `fallback` is
 * `"none"`; `undefined` means nothing can be served. No requested languages
 * serve the default without a substitution.
 */
export function negotiateContentLanguage(
	requested: readonly string[],
	available: readonly string[],
	options: { defaultLanguage?: string; fallback?: "default" | "none" } = {},
): ContentLanguageMatch | undefined {
	for (const tag of requested) {
		const language = findClosestLanguageMatch(tag, available);
		if (language !== undefined) return { language };
	}
	const { defaultLanguage, fallback = "default" } = options;
	if (requested.length > 0 && fallback === "none") return undefined;
	const language = available.find((candidate) =>
		languageTagsEqual(candidate, defaultLanguage),
	);
	if (language === undefined) return undefined;
	return requested.length > 0 ? { language, substitution: "fallback" } : { language };
}

/**
 * The canonical form of a usable language tag, or `undefined` for anything a
 * language in use would not be: `es_MX` normalizes to `es-MX`, `NL-nl` to
 * `nl-NL`, and `Spanish` or an empty string are not tags. One rule for every
 * `lang` this repository writes — content and chrome alike — and the same rule
 * the PIE elements apply to `model.language`, so every stamped attribute on a
 * page carries the same shape.
 */
export function canonicalLanguageTag(
	language: string | null | undefined,
): string | undefined {
	const tag = toLanguageTag(language).split(/[.@]/)[0];
	// `Intl` accepts any 5-8 letter primary subtag, `Spanish` included; a
	// language in use has an ISO 639 code of two or three letters.
	if (!/^[a-z]{2,3}(-|$)/i.test(tag)) return undefined;
	try {
		return Intl.getCanonicalLocales(tag)[0];
	} catch {
		return undefined;
	}
}
