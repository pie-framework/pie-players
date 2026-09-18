import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type {
	SectionCanonicalItemViewModel,
	SectionCompositionModel,
} from "../../controllers/types.js";

// One object stands in for every item that has no session yet, so it is frozen:
// a consumer that writes into its own session container — `<pie-item-player>`
// keeps that container live — would otherwise leak one item's entries into
// every other item's.
export const EMPTY_ITEM_SESSION = Object.freeze({
	id: "",
	data: Object.freeze([]),
}) as Record<string, unknown>;

export const EMPTY_COMPOSITION: SectionCompositionModel = {
	section: null,
	assessmentItemRefs: [],
	passages: [],
	items: [],
	rubricBlocks: [],
	instructions: [],
	renderables: [],
	currentItemIndex: 0,
	currentItem: null,
	isPageMode: false,
	itemSessionsByItemId: {},
	testAttemptSession: null,
	itemViewModels: [],
	formative: null,
};

export function getEntityTitle(entity: unknown): string {
	const title = (entity as { title?: unknown } | null)?.title;
	return typeof title === "string" ? title.trim() : "";
}

export function getCanonicalItemIdForItem(
	compositionModel: SectionCompositionModel,
	item: ItemEntity,
): string {
	const fromViewModel = getItemViewModelForItem(compositionModel, item);
	return fromViewModel?.canonicalItemId || "";
}

export function getSessionForItem(
	compositionModel: SectionCompositionModel,
	item: ItemEntity,
): unknown {
	const itemViewModel = getItemViewModelForItem(compositionModel, item);
	return itemViewModel?.session;
}

export function getSessionForItemOrEmpty(
	compositionModel: SectionCompositionModel,
	item: ItemEntity,
): Record<string, unknown> {
	return (getSessionForItem(compositionModel, item) ||
		EMPTY_ITEM_SESSION) as Record<string, unknown>;
}

function getItemViewModelForItem(
	compositionModel: SectionCompositionModel,
	item: ItemEntity,
): SectionCanonicalItemViewModel | undefined {
	const itemId = item.id || "";
	if (!itemId) return undefined;
	return compositionModel.itemViewModels.find((viewModel) => {
		return (
			viewModel.itemId === itemId ||
			viewModel.canonicalItemId === itemId ||
			viewModel.item?.id === itemId
		);
	});
}
