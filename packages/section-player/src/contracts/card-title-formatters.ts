import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared/types";

export type SectionPlayerItemTitleContext = {
	kind: "item";
	item: ItemEntity;
	itemIndex: number;
	itemCount: number;
	canonicalItemId: string;
	defaultTitle: string;
};

export type SectionPlayerPassageTitleContext = {
	kind: "passage";
	passage: PassageEntity;
	defaultTitle: string;
};

export type SectionPlayerCardTitleContext =
	| SectionPlayerItemTitleContext
	| SectionPlayerPassageTitleContext;

export type SectionPlayerCardTitleFormatter = (
	context: SectionPlayerCardTitleContext,
) => string | null | undefined;
