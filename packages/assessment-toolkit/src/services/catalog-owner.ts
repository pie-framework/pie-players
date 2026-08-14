/**
 * Identity and traversal rules for one mounted accessibility-catalog owner.
 *
 * The resolver is the public lifecycle boundary. This supporting module keeps
 * its owner identity and direct-lookup helper separate from the runtime event
 * adapter, while keeping the entity walk private to the resolver package.
 */

import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";

export type CatalogOwnerKind = "global" | "passage" | "itemModel";

interface CatalogOwnerScopeContext {
	assessmentId?: string;
	sectionId?: string;
}

/** A valid resolver scope for a global, passage, or item/model owner. */
export type CatalogOwnerContext =
	| (CatalogOwnerScopeContext & {
			ownerKind: "global";
			canonicalItemId?: never;
			itemId?: never;
			passageId?: never;
			modelId?: never;
	  })
	| (CatalogOwnerScopeContext & {
			ownerKind: "passage";
			passageId: string;
			canonicalItemId?: never;
			itemId?: never;
			modelId?: never;
	  })
	| (CatalogOwnerScopeContext & {
			ownerKind: "itemModel";
			itemId: string;
			canonicalItemId?: string;
			modelId?: string;
			passageId?: never;
	  });

export interface CatalogOwnerRegistrationEntry {
	context: CatalogOwnerContext;
	catalogs: AccessibilityCatalog[];
}

/** The entity shape catalogs hang off: an item, or a passage. */
export interface CatalogSourceEntity {
	accessibilityCatalogs?: AccessibilityCatalog[];
	config?: {
		extractedCatalogs?: AccessibilityCatalog[];
		models?: Array<{
			id?: string;
			accessibilityCatalogs?: AccessibilityCatalog[];
		}>;
	};
}

/** Who is rendering the entity — everything owner scoping is derived from. */
export interface CatalogOwnerIdentity {
	kind: "item" | "passage";
	/** The rendered instance id. */
	itemId: string;
	canonicalItemId?: string;
	assessmentId?: string;
	sectionId?: string;
}

const hasCatalogs = (
	catalogs: AccessibilityCatalog[] | undefined,
): catalogs is AccessibilityCatalog[] =>
	Array.isArray(catalogs) && catalogs.length > 0;

/**
 * Build the lookup context for a direct resolver client such as inline TTS.
 *
 * Owner registration uses the same function, so direct readers cannot drift
 * from the context the resolver files the entity under.
 */
export function catalogOwnerContextFor(
	owner: CatalogOwnerIdentity,
): CatalogOwnerContext {
	if (owner.kind === "passage") {
		return {
			ownerKind: "passage",
			assessmentId: owner.assessmentId,
			sectionId: owner.sectionId,
			passageId: owner.canonicalItemId || owner.itemId,
		};
	}
	return {
		ownerKind: "itemModel",
		assessmentId: owner.assessmentId,
		sectionId: owner.sectionId,
		itemId: owner.itemId,
		canonicalItemId: owner.canonicalItemId || owner.itemId,
	};
}

/**
 * Collect every catalog group carried by one owner in registration-precedence
 * order. This is deliberately not exported from the package root: callers
 * register the owner once through `AccessibilityCatalogResolver.registerOwner`.
 */
export function collectOwnerCatalogRegistrations(
	entity: CatalogSourceEntity | null | undefined,
	owner: CatalogOwnerIdentity,
): CatalogOwnerRegistrationEntry[] {
	if (!entity) return [];
	const context = catalogOwnerContextFor(owner);
	const registrations: CatalogOwnerRegistrationEntry[] = [];
	if (hasCatalogs(entity.accessibilityCatalogs)) {
		registrations.push({ context, catalogs: entity.accessibilityCatalogs });
	}
	if (hasCatalogs(entity.config?.extractedCatalogs)) {
		registrations.push({
			context,
			catalogs: entity.config.extractedCatalogs,
		});
	}
	if (owner.kind === "passage") return registrations;
	if (context.ownerKind !== "itemModel") return registrations;
	for (const model of entity.config?.models ?? []) {
		if (!hasCatalogs(model.accessibilityCatalogs)) continue;
		registrations.push({
			context: { ...context, modelId: model.id },
			catalogs: model.accessibilityCatalogs,
		});
	}
	return registrations;
}
