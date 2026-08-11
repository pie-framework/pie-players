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

import {
	collectEntityCatalogRegistrations,
	type CatalogOwnerContext,
	type CatalogSourceEntity,
	type AccessibilityCatalogResolverApi,
	type ToolContentDependencyContext,
} from "@pie-players/pie-assessment-toolkit";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import {
	AMERICAN_SIGN_LANGUAGE,
	isSignLanguageCard,
	matchesRequestedSignLanguage,
	resolveSignLanguageMedia,
	SIGN_LANGUAGE_CATALOG_TYPE,
	type SignLanguageMedia,
} from "./sign-language-cards.js";

/** QTI 3.0 / AfA support id gating signed alternates. */
export const SIGN_LANGUAGE_FEATURE_ID = "signLanguage";

/** A catalog on this item that carries at least one sign-language card. */
export interface SignLanguageCatalogRef {
	catalogId: string;
	/** Set when the catalog is owned by one model rather than the item root. */
	modelId?: string;
}

export interface ResolvedSignLanguageAlternate extends SignLanguageMedia {
	catalogId: string;
}

/**
 * Collect the catalog identifiers on an item that carry signing cards.
 *
 * The region resolves through the catalog resolver, but the resolver is keyed by
 * identifier within an owner scope — something has to say *which* identifiers
 * this item put in play, and whether each belongs to the item or to one model.
 * That is the same walk the runtime does when it registers an item's catalogs,
 * so it is borrowed rather than repeated: a ref can only name a scope
 * registration actually files under. Only the "does this catalog carry signing"
 * filter is ours.
 *
 * The owner identity here is a placeholder: the assessment and section ids are
 * not known at extraction time and are supplied by the caller at lookup time
 * (see `resolveSignLanguageAlternate`). Nothing but `modelId` is read from the
 * walk's contexts.
 */
export function collectSignLanguageCatalogRefs(
	item: ItemEntity | null | undefined,
): SignLanguageCatalogRef[] {
	if (!item) return [];
	const refs: SignLanguageCatalogRef[] = [];
	const seen = new Set<string>();
	const registrations = collectEntityCatalogRegistrations(
		item as CatalogSourceEntity,
		{ kind: "item", itemId: item.id ?? "" },
	);
	for (const registration of registrations) {
		const modelId = registration.context.modelId;
		for (const catalog of registration.catalogs) {
			if (!Array.isArray(catalog?.cards)) continue;
			if (!catalog.cards.some(isSignLanguageCard)) continue;
			const key = `${modelId ?? ""}|${catalog.identifier}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push(
				modelId
					? { catalogId: catalog.identifier, modelId }
					: { catalogId: catalog.identifier },
			);
		}
	}
	return refs;
}

export interface SignLanguageLookupArgs {
	resolver: AccessibilityCatalogResolverApi;
	refs: SignLanguageCatalogRef[];
	/** Owner context for the item, without `modelId` — added per ref. */
	ownerContext: CatalogOwnerContext;
	/** Sign language the learner is entitled to, ISO 639-3. */
	requestedSignLang?: string;
}

/**
 * Resolve the signed alternate to show for an item, or `null`.
 *
 * Priority, language fallback and owner scoping are the resolver's job and are
 * not re-implemented here. What *is* enforced here is the one deliberate
 * departure from the resolver's default behaviour: **no cross-sign-language
 * substitution.** The resolver's last fallback rung matches any card of the
 * requested type regardless of language, which for spoken content is helpful
 * and for signing is not — handing an ASL learner a BSL recording is worse than
 * handing them nothing. So a card the resolver returns by that rung is accepted
 * only if its language actually matches, or if the card asserts no language at
 * all.
 *
 * MVP takes the first resolvable card: sample content is one recording per item.
 * The refs stay per-node capable for when choice-level docking lands.
 */
export function resolveSignLanguageAlternate(
	args: SignLanguageLookupArgs,
): ResolvedSignLanguageAlternate | null {
	const requested = args.requestedSignLang?.trim() || AMERICAN_SIGN_LANGUAGE;
	for (const ref of args.refs) {
		const context: CatalogOwnerContext = ref.modelId
			? { ...args.ownerContext, modelId: ref.modelId }
			: args.ownerContext;

		// Exact language match first, with the resolver's fallback rungs off so
		// nothing else can slip through.
		const exact = args.resolver.getAlternative(ref.catalogId, {
			type: SIGN_LANGUAGE_CATALOG_TYPE,
			language: requested,
			useFallback: false,
			context,
		});
		const exactMedia = resolveSignLanguageMedia(exact);
		if (exactMedia) return { ...exactMedia, catalogId: ref.catalogId };

		// Then allow the fallback rungs, but only to reach a card that asserts no
		// language. Anything that comes back tagged with a different sign language
		// is rejected rather than substituted.
		const fallback = args.resolver.getAlternative(ref.catalogId, {
			type: SIGN_LANGUAGE_CATALOG_TYPE,
			language: requested,
			useFallback: true,
			context,
		});
		const fallbackMedia = resolveSignLanguageMedia(fallback);
		if (
			fallbackMedia &&
			matchesRequestedSignLanguage(fallbackMedia, requested)
		) {
			return { ...fallbackMedia, catalogId: ref.catalogId };
		}
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
 * The host supplies the item, the resolver and the owner scope, and learns only
 * whether there is something to render. It never sees a catalog type, a card
 * shape or a sign-language code.
 */
export function resolveSignLanguageContent(
	context: ToolContentDependencyContext,
): ResolvedSignLanguageAlternate | null {
	const resolver = context.catalogResolver;
	if (!resolver) return null;
	const refs = collectSignLanguageCatalogRefs(
		context.item as ItemEntity | null | undefined,
	);
	if (refs.length === 0) return null;
	return resolveSignLanguageAlternate({
		resolver,
		refs,
		ownerContext: context.ownerContext,
		requestedSignLang: resolveRequestedSignLanguage(context.parameters),
	});
}
