/**
 * Per-item catalog media: which signed alternate an item card should show, and
 * how wide the region holding it is.
 *
 * Availability has two independent halves, and both are required:
 *
 *   1. **Content** — the item carries a matching catalog card. This is AfA's
 *      resource-side declaration (QTI approximates DRD in-band: the presence of
 *      the card *is* the declaration), and it is what keeps the region off the
 *      overwhelming majority of items, which carry no signing video.
 *   2. **Eligibility** — policy granted the feature id. Signing is an
 *      accommodation, so silence means no.
 *
 * Deliberately not framed as "default on versus default off": neither half
 * implies the other, and neither is a default.
 *
 * This module is data-only so it can be unit-tested without a DOM; the region
 * component owns rendering and lifecycle.
 */

import {
	AMERICAN_SIGN_LANGUAGE,
	SIGN_LANGUAGE_CATALOG_TYPE,
	SignLanguageExtractor,
	isSignLanguageCard,
	matchesRequestedSignLanguage,
	resolveSignLanguageMedia,
	type AccessibilityCatalogResolverApi,
	type CatalogOwnerContext,
	type SignLanguageMedia,
} from "@pie-players/pie-assessment-toolkit";
import type {
	AccessibilityCatalog,
	ItemEntity,
} from "@pie-players/pie-players-shared/types";

/**
 * QTI 3.0 / AfA support id gating signed alternates. Excluded from the computed
 * default PNP profile by `ACCOMMODATION_ONLY_SUPPORT_IDS`, so it is only ever
 * granted deliberately.
 */
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

function catalogsWithSignLanguage(
	catalogs: AccessibilityCatalog[] | undefined,
): AccessibilityCatalog[] {
	if (!Array.isArray(catalogs)) return [];
	return catalogs.filter(
		(catalog) =>
			Array.isArray(catalog?.cards) && catalog.cards.some(isSignLanguageCard),
	);
}

/**
 * Collect the catalog identifiers on an item that carry signing cards.
 *
 * The region resolves through the catalog resolver, but the resolver is keyed
 * by identifier — something has to say *which* identifiers this item put in
 * play. Mirrors the shape `collectCatalogRegistrations` registers with, so the
 * owner contexts built from these refs line up with the registered ones.
 */
export function collectSignLanguageCatalogRefs(
	item: ItemEntity | null | undefined,
): SignLanguageCatalogRef[] {
	if (!item) return [];
	const refs: SignLanguageCatalogRef[] = [];
	const seen = new Set<string>();
	const push = (catalogId: string, modelId?: string) => {
		const key = `${modelId ?? ""}|${catalogId}`;
		if (seen.has(key)) return;
		seen.add(key);
		refs.push(modelId ? { catalogId, modelId } : { catalogId });
	};

	for (const catalog of catalogsWithSignLanguage(item.accessibilityCatalogs)) {
		push(catalog.identifier);
	}
	for (const catalog of catalogsWithSignLanguage(
		item.config?.extractedCatalogs,
	)) {
		push(catalog.identifier);
	}
	for (const model of item.config?.models ?? []) {
		for (const catalog of catalogsWithSignLanguage(
			model?.accessibilityCatalogs,
		)) {
			push(catalog.identifier, model?.id);
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

// ----------------------------------------------------------------------------
// Inline signing markup → catalog cards
// ----------------------------------------------------------------------------

export interface PreparedSignLanguageItem {
	/** The item to render and register. Identical to the input when unchanged. */
	item: ItemEntity;
	/** Catalogs on the prepared item that carry signing cards. */
	refs: SignLanguageCatalogRef[];
}

const preparedItems = new WeakMap<ItemEntity, PreparedSignLanguageItem>();

/**
 * Lift inline signing video out of an item's content into catalog cards.
 *
 * This is what lets an item work whether or not `accessibilityCatalogs` was
 * populated upstream — the same reason `SSMLExtractor` exists for spoken
 * content. Extraction is independent of policy, deliberately: the config handed
 * to `item-player` must not vary with a learner's profile.
 *
 * When there is nothing to extract, the original item is returned **by
 * reference**, so items without signing video (nearly all of them) see no
 * config churn at all downstream.
 *
 * Memoized per item object: extraction parses markup, and item props are
 * re-read on every re-render.
 */
export function prepareSignLanguageItem(
	item: ItemEntity,
): PreparedSignLanguageItem {
	const cached = preparedItems.get(item);
	if (cached) return cached;

	let prepared: PreparedSignLanguageItem = {
		item,
		refs: collectSignLanguageCatalogRefs(item),
	};

	if (item?.config) {
		const { catalogs, cleanedConfig } =
			new SignLanguageExtractor().extractFromItemConfig(item.config);
		if (catalogs.length > 0) {
			const nextItem: ItemEntity = {
				...item,
				config: {
					...cleanedConfig,
					extractedCatalogs: [
						...(item.config.extractedCatalogs ?? []),
						...catalogs,
					],
				},
			};
			prepared = {
				item: nextItem,
				refs: collectSignLanguageCatalogRefs(nextItem),
			};
		}
	}

	preparedItems.set(item, prepared);
	return prepared;
}

// ----------------------------------------------------------------------------
// Region sizing
// ----------------------------------------------------------------------------

/**
 * Default and bounds for the media region's share of the card width.
 *
 * Signing needs height for hands and face, so the region is sized by an
 * aspect-ratio target with a minimum height rather than by width alone — a flat
 * viewport percentage either wastes space on a short clip or crushes it on a
 * narrow device. The percentage below only decides how the card's width is
 * split; legibility is defended by the region's CSS.
 */
export const MEDIA_REGION_DEFAULT_PERCENT = 34;
export const MEDIA_REGION_MIN_PERCENT = 20;
export const MEDIA_REGION_MAX_PERCENT = 55;
/** Below this card width the split is dropped and the region stacks. */
export const MEDIA_REGION_STACK_BREAKPOINT_PX = 560;

export function clampMediaRegionPercent(
	value: number,
	min: number = MEDIA_REGION_MIN_PERCENT,
	max: number = MEDIA_REGION_MAX_PERCENT,
): number {
	if (!Number.isFinite(value)) return MEDIA_REGION_DEFAULT_PERCENT;
	return Math.max(min, Math.min(max, value));
}

/**
 * Convert a pointer drag into a media-region width percentage.
 *
 * Container-relative, unlike the passage/items divider's fixed 0.1%-per-pixel
 * factor: the same drag has to mean the same thing in a wide card and a narrow
 * one. The region is on the right, so dragging left grows it.
 */
export function mediaRegionPercentFromDrag(args: {
	startPercent: number;
	deltaX: number;
	containerWidthPx: number;
	min?: number;
	max?: number;
}): number {
	const width = args.containerWidthPx;
	if (!Number.isFinite(width) || width <= 0) {
		return clampMediaRegionPercent(args.startPercent, args.min, args.max);
	}
	const deltaPercent = (args.deltaX / width) * 100;
	return clampMediaRegionPercent(
		args.startPercent - deltaPercent,
		args.min,
		args.max,
	);
}
