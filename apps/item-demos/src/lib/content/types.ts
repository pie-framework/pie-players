import type { ItemEntity } from "@pie-players/pie-players-shared/types";

/** Catalog entry for one item demo. Session seeds belong in `demo-session-seeds.ts`, not here. */
export interface DemoInfo {
	id: string;
	name: string;
	description: string;
	sourcePackage: string;
	sourceVariantId: string;
	tags: string[];
	item: Partial<ItemEntity>;
}
