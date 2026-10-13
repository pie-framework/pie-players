import type {
	ItemEntity,
	PassageEntity,
} from "@pie-players/pie-players-shared/types";

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

/**
 * A non-empty string becomes the card's title. `{ visible: false }` hides it
 * visually; the heading stays, carrying `defaultTitle`. Anything else, a throw
 * included, keeps `defaultTitle`.
 */
export type SectionPlayerCardTitleFormatter = (
	context: SectionPlayerCardTitleContext,
) => string | { visible: false } | null | undefined;
