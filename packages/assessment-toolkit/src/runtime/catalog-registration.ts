import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";
import type { CatalogOwnerContext } from "../services/AccessibilityCatalogResolver.js";
import type { RuntimeRegistrationDetail } from "./registration-events.js";

export interface CatalogRegistrationRuntimeContext {
	assessmentId?: string;
	sectionId?: string;
}

export interface CatalogRegistration {
	context: CatalogOwnerContext;
	catalogs: AccessibilityCatalog[];
}

type CatalogSource = {
	accessibilityCatalogs?: AccessibilityCatalog[];
	config?: {
		extractedCatalogs?: AccessibilityCatalog[];
		models?: Array<{
			id?: string;
			accessibilityCatalogs?: AccessibilityCatalog[];
		}>;
	};
};

const hasCatalogs = (
	catalogs: AccessibilityCatalog[] | undefined,
): catalogs is AccessibilityCatalog[] =>
	Array.isArray(catalogs) && catalogs.length > 0;

export function collectCatalogRegistrations(
	detail: RuntimeRegistrationDetail,
	runtime: CatalogRegistrationRuntimeContext = {},
): CatalogRegistration[] {
	const entity = detail.item as CatalogSource | null | undefined;
	if (!entity) return [];
	const registrations: CatalogRegistration[] = [];
	if (detail.kind === "passage") {
		const context: CatalogOwnerContext = {
			ownerKind: "passage",
			assessmentId: runtime.assessmentId,
			sectionId: runtime.sectionId,
			passageId: detail.canonicalItemId || detail.itemId,
		};
		if (hasCatalogs(entity.accessibilityCatalogs)) {
			registrations.push({ context, catalogs: entity.accessibilityCatalogs });
		}
		if (hasCatalogs(entity.config?.extractedCatalogs)) {
			registrations.push({
				context,
				catalogs: entity.config.extractedCatalogs,
			});
		}
		return registrations;
	}

	const itemContext: CatalogOwnerContext = {
		ownerKind: "itemModel",
		assessmentId: runtime.assessmentId,
		sectionId: runtime.sectionId,
		itemId: detail.itemId,
		canonicalItemId: detail.canonicalItemId || detail.itemId,
	};
	if (hasCatalogs(entity.accessibilityCatalogs)) {
		registrations.push({
			context: itemContext,
			catalogs: entity.accessibilityCatalogs,
		});
	}
	if (hasCatalogs(entity.config?.extractedCatalogs)) {
		registrations.push({
			context: itemContext,
			catalogs: entity.config.extractedCatalogs,
		});
	}
	for (const model of entity.config?.models ?? []) {
		if (!hasCatalogs(model.accessibilityCatalogs)) continue;
		registrations.push({
			context: { ...itemContext, modelId: model.id },
			catalogs: model.accessibilityCatalogs,
		});
	}
	return registrations;
}
