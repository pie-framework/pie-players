import type { CatalogSourceEntity } from "../services/catalog-owner.js";
import type { ToolkitCoordinatorApi } from "../services/interfaces.js";
import type { RuntimeRegistrationDetail } from "./registration-events.js";

/**
 * What a content registration files with the coordinator: the content's
 * accessibility catalogs, and an item's policy settings under its canonical
 * id, the id its item-level toolbar scopes decisions by. Returns the cleanups
 * that withdraw them, for the toolkit to run when the content unregisters or
 * the coordinator changes.
 */
export function registerContentWithCoordinator(
	coordinator: Pick<
		ToolkitCoordinatorApi,
		"getServiceBundle" | "registerItemSettings"
	>,
	detail: RuntimeRegistrationDetail,
	owner: { assessmentId: string; sectionId: string },
): Array<() => void> {
	const cleanups = [
		coordinator.getServiceBundle().catalogResolver.registerOwner({
			owner: {
				kind: detail.kind,
				itemId: detail.itemId,
				canonicalItemId: detail.canonicalItemId,
				assessmentId: owner.assessmentId,
				sectionId: owner.sectionId,
			},
			entity: detail.item as CatalogSourceEntity | null | undefined,
		}),
	];
	if (detail.kind === "item" && detail.settings) {
		cleanups.push(
			coordinator.registerItemSettings(
				detail.canonicalItemId || detail.itemId,
				detail.settings,
			),
		);
	}
	return cleanups;
}
