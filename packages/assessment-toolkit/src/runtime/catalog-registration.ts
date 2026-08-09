/**
 * Where accessibility catalogs live on a rendered entity, and which owner scope
 * each one belongs to.
 *
 * Catalogs are placed dynamically: a shell registers what its entity carries
 * when it mounts, and readers (TTS, the item card's media region) resolve by
 * identifier within an owner scope. Both sides therefore have to agree on two
 * facts — the three places catalogs can hang off an entity, and the owner
 * context each one is filed under. This module is the only place either is
 * decided, so a reader cannot look up a scope registration never wrote.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";
import type { CatalogOwnerContext } from "../services/AccessibilityCatalogResolver.js";
import type {
	RuntimeRegistrationDetail,
	RuntimeRegistrationKind,
} from "./registration-events.js";

export interface CatalogRegistrationRuntimeContext {
	assessmentId?: string;
	sectionId?: string;
}

export interface CatalogRegistration {
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
	kind: RuntimeRegistrationKind;
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
 * The owner context an entity's catalogs are registered under, and therefore the
 * one a reader must look them up with.
 *
 * Exported because readers construct the lookup context themselves: the
 * resolver matches contexts field by field, so a reader that hand-assembled its
 * own would silently resolve nothing the day either side gained a field.
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
 * Every catalog an entity carries, paired with the owner scope it belongs in.
 *
 * Three places carry catalogs, and the distinction matters to resolution rather
 * than only to bookkeeping: entity-level `accessibilityCatalogs` and
 * extractor-generated `config.extractedCatalogs` are filed against the entity,
 * while a model's own catalogs are filed against that model, so two models on
 * one item can use the same catalog identifier without colliding.
 *
 * Passages have no models, so the walk stops after the entity-level pair.
 */
export function collectEntityCatalogRegistrations(
	entity: CatalogSourceEntity | null | undefined,
	owner: CatalogOwnerIdentity,
): CatalogRegistration[] {
	if (!entity) return [];
	const context = catalogOwnerContextFor(owner);
	const registrations: CatalogRegistration[] = [];
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
	for (const model of entity.config?.models ?? []) {
		if (!hasCatalogs(model.accessibilityCatalogs)) continue;
		registrations.push({
			context: { ...context, modelId: model.id },
			catalogs: model.accessibilityCatalogs,
		});
	}
	return registrations;
}

/** Adapter for the runtime registration event a shell dispatches on mount. */
export function collectCatalogRegistrations(
	detail: RuntimeRegistrationDetail,
	runtime: CatalogRegistrationRuntimeContext = {},
): CatalogRegistration[] {
	return collectEntityCatalogRegistrations(
		detail.item as CatalogSourceEntity | null | undefined,
		{
			kind: detail.kind,
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId,
			assessmentId: runtime.assessmentId,
			sectionId: runtime.sectionId,
		},
	);
}
