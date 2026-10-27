/**
 * Interchange types: backends and authoring tools exchange them, and no player
 * reads them. Their tier is listed on the content-model page.
 *
 * Language variants (PIE-1393): no player reads `AdaptationLink` or
 * `LanguagePolicy`.
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

/**
 * One curriculum standard, skill or competency the content is aligned to
 * (PIE-1381). QTI 3 Curriculum Standards Metadata (CSM 1.1), one entry per
 * `labelledGUID`. Content records direct links only; a framework provider
 * resolves parents, crosswalks and successors on read.
 */
export interface CurriculumStandard {
	/**
	 * CSM `curriculumStandardsMetadata@providerId`: who issued `guid`, from the
	 * provider-id registry on the content-model page, or a host value. Absent
	 * means `"AB"` (Academic Benchmarks).
	 */
	providerId?: string;
	/**
	 * CSM `labelledGUID/GUID`, as the provider issued it. Stored with its case
	 * and compared case-insensitively.
	 */
	guid: string;
	/** CSM `labelledGUID/caseItemURI`, for a CASE framework item. */
	caseItemURI?: string;
	/** CSM `labelledGUID/label`: a display code. Never a key. */
	label?: string;
	/** LOM classification purpose. Absent means `"educational objective"`. */
	purpose?: "educational objective" | "prerequisite" | (string & {});
	// PIE extensions; QTI 3 has no equivalent.
	/** The record's main standard for this provider. At most one per `providerId`. */
	primary?: boolean;
	/** How the link was made. */
	provenance?: "authored" | "derived" | "imported";
	/**
	 * For a derived link: the link it was generated from. An absent
	 * `providerId` means `"AB"`.
	 */
	derivedFrom?: { providerId?: string; guid: string };
}

/**
 * A cognitive-complexity classification of the content (PIE-1381). LOM
 * classification purpose "skill level".
 */
export interface SkillLevel {
	/**
	 * LOM `taxonPath/source`: `"webb-dok"`, `"blooms-revised"`,
	 * `"blooms-original"`, or a host taxonomy.
	 */
	source: string;
	/**
	 * LOM `taxon/id`: `"1"` to `"4"` for `webb-dok`; `"remember"` to `"create"`
	 * for `blooms-revised`.
	 */
	id: string;
	/** PIE extension: the author's justification. */
	rationale?: string;
}
