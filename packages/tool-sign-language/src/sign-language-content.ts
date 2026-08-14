/**
 * Which signed alternate an item carries, if any.
 *
 * The resource half of AfA's PNP/DRD pair. Availability has two independent
 * halves and both are required:
 *
 *   1. **Content** — the item carries a matching catalog card. QTI approximates
 *      DRD in-band: the presence of the card *is* the resource declaration, and
 *      it is what keeps the region off the overwhelming majority of items, which
 *      carry no signing video.
 *   2. **Eligibility** — policy granted the feature id. Signing is an
 *      accommodation, so silence means no.
 *
 * Deliberately not framed as "default on versus default off": neither half
 * implies the other, and neither is a default. The host asks about eligibility
 * and then calls `resolve` here; it does not know which of the two answered no.
 *
 * A signed alternate reaches an item one way only: as a catalog card, authored
 * or written by an importer. There is deliberately no path that lifts a signing
 * video out of item markup at render time. One was implemented and removed: it
 * had no producer — the Learnosity transform writes `accessibilityCatalogs`
 * directly — and it failed in the wrong direction, since a runtime that could
 * not parse the markup left the video in the visible content, showing the
 * accommodation to every learner regardless of eligibility. `SSMLExtractor` is
 * not a precedent for re-adding it: inline `<speak>` is real authored content
 * PIE does not control, and there is no equivalent body of items carrying
 * signing video inline.
 *
 * This module is data-only so it can be unit-tested without a DOM; the region
 * component owns rendering and lifecycle.
 */

import type {
	CatalogOwnerSnapshot,
	ToolContentDependencyContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	AMERICAN_SIGN_LANGUAGE,
	isSignLanguageCard,
	matchesRequestedSignLanguage,
	resolveSignLanguageMedia,
	type SignLanguageMedia,
} from "./sign-language-cards.js";

/** QTI 3.0 / AfA support id gating signed alternates. */
export const SIGN_LANGUAGE_FEATURE_ID = "signLanguage";

export interface ResolvedSignLanguageAlternate extends SignLanguageMedia {
	catalogId: string;
}

export interface SignLanguageLookupArgs {
	catalogs: CatalogOwnerSnapshot;
	/** Sign language the learner is entitled to, ISO 639-3. */
	requestedSignLang?: string;
}

/**
 * Resolve the signed alternate to show for an item, or `null`.
 *
 * Owner scope, item/passage/model traversal and registration order are already
 * represented by the snapshot. What remains capability-specific is the strict
 * **no cross-sign-language substitution** rule: handing an ASL learner a BSL
 * recording is worse than handing them nothing.
 *
 * MVP takes the first resolvable card: sample content is one recording per item.
 * The refs stay per-node capable for when choice-level docking lands.
 */
export function resolveSignLanguageAlternate(
	args: SignLanguageLookupArgs,
): ResolvedSignLanguageAlternate | null {
	const requested = args.requestedSignLang?.trim() || AMERICAN_SIGN_LANGUAGE;
	const candidates = args.catalogs.cards.flatMap(({ catalogId, card }) => {
		if (!isSignLanguageCard(card)) return [];
		const media = resolveSignLanguageMedia(card);
		return media ? [{ catalogId, media }] : [];
	});

	// An exact language always beats an unlabelled fallback, regardless of card
	// order. A differently-labelled card is never a fallback.
	for (const candidate of candidates) {
		if (!candidate.media.signLang) continue;
		if (!matchesRequestedSignLanguage(candidate.media, requested)) continue;
		return { ...candidate.media, catalogId: candidate.catalogId };
	}
	for (const candidate of candidates) {
		if (candidate.media.signLang) continue;
		return { ...candidate.media, catalogId: candidate.catalogId };
	}
	return null;
}

/**
 * Which sign language the learner is entitled to.
 *
 * Read from the feature's policy parameters (`toolParameters` / `toolConfigs`),
 * never inferred from the item's content language — a Spanish item's signed
 * alternate is LSM, not ASL.
 */
export function resolveRequestedSignLanguage(
	parameters: unknown,
): string | undefined {
	if (!parameters || typeof parameters !== "object") return undefined;
	const candidate = (parameters as { signLang?: unknown }).signLang;
	if (typeof candidate === "string" && candidate.trim()) {
		return candidate.trim();
	}
	return undefined;
}

/**
 * The registration's `requiresAuthoredContent` implementation: the whole
 * content half behind the one call the host makes.
 *
 * The host supplies one owner snapshot and learns only whether there is
 * something to render. It never sees a catalog type, card shape, entity walk or
 * sign-language code.
 */
export function resolveSignLanguageContent(
	context: ToolContentDependencyContext,
): ResolvedSignLanguageAlternate | null {
	if (!context.catalogs) return null;
	return resolveSignLanguageAlternate({
		catalogs: context.catalogs,
		requestedSignLang: resolveRequestedSignLanguage(context.parameters),
	});
}
