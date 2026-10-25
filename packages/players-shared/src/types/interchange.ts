/**
 * Language-variant interchange types (PIE-1393). Backends and authoring tools
 * exchange them; no player reads `AdaptationLink` or `LanguagePolicy`.
 *
 * A language variant is its own item or passage version that declares
 * `language` and, when it is a translation, `isAdaptationOf`. Its family is
 * `isAdaptationOf.baseId ?? baseId`.
 */
import type { SemVer } from "./index.js";

/** The source a translated item or passage was adapted from. */
export interface AdaptationLink {
	baseId: string;
	/** The source version translated. Absent when provenance is unknown. */
	version?: SemVer;
}

/**
 * The languages an assessment offers and what a backend serves when a family
 * has no variant in the requested language.
 */
export interface LanguagePolicy {
	/** BCP 47 tags the assessment may be served in. */
	languages: string[];
	/**
	 * `"default"` serves an item whose family lacks the requested language in
	 * the closest match for the platform default, `en-US` (so `en` or `en-GB`),
	 * then its content that declares no language, then its source. Fallback is
	 * per item; items sharing a passage fall back together. `"none"` fails the
	 * load.
	 */
	fallback: "default" | "none";
	/**
	 * `"closest"`, the default, serves the nearest variant in the requested
	 * language, so `es-MX` reaches `es` or `es-ES`; `"exact"` serves only an
	 * equal tag and leaves anything else to `fallback`.
	 */
	matching?: "closest" | "exact";
	/**
	 * `"serve"` serves a variant whose source has a newer release and records
	 * it as stale; `"require-current"` treats that variant as missing.
	 */
	staleness: "serve" | "require-current";
}

/** Why the served content differs from what was requested. */
export type ContentSubstitution = "fallback" | "stale";

/** The content version a backend served, and the language it served it in. */
export interface ServedContentIdentity {
	baseId: string;
	version?: SemVer;
	/** The family key, when the served version belongs to a variant family. */
	family?: string;
	/** BCP 47 tag of the served content. */
	servedLanguage?: string;
	substitution?: ContentSubstitution;
}
