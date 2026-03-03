import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../../controllers/types.js";
import {
	getCanonicalItemIdForItem,
	getSessionForItemOrEmpty,
	EMPTY_COMPOSITION,
} from "./composition.js";
import type { PlayerElementParams } from "./player-action.js";

export function getCompositionFromEvent(event: Event): SectionCompositionModel {
	const detail = (event as CustomEvent<{ composition?: SectionCompositionModel }>)
		.detail;
	return detail?.composition || EMPTY_COMPOSITION;
}

export function getPassagePlayerParams(args: {
	passage: any;
	resolvedPlayerEnv: Record<string, unknown>;
	resolvedPlayerAttributes: Record<string, string>;
	resolvedPlayerProps: Record<string, unknown>;
	playerStrategy: string;
}): PlayerElementParams {
	// Keep passage visuals aligned with item defaults by sharing the same
	// runtime env shape; passage content remains non-response by content model.
	return {
		config: args.passage.config || {},
		env: args.resolvedPlayerEnv,
		attributes: args.resolvedPlayerAttributes || {},
		props: args.resolvedPlayerProps || {},
		skipElementLoading: args.playerStrategy !== "preloaded",
	};
}

export function getItemPlayerParams(args: {
	item: ItemEntity;
	compositionModel: SectionCompositionModel;
	resolvedPlayerEnv: Record<string, unknown>;
	resolvedPlayerAttributes: Record<string, string>;
	resolvedPlayerProps: Record<string, unknown>;
	playerStrategy: string;
}): PlayerElementParams {
	return {
		config: args.item.config || {},
		env: args.resolvedPlayerEnv,
		session: getSessionForItemOrEmpty(args.compositionModel, args.item),
		attributes: args.resolvedPlayerAttributes || {},
		props: args.resolvedPlayerProps || {},
		skipElementLoading: args.playerStrategy !== "preloaded",
	};
}

export function getCanonicalItemId(args: {
	compositionModel: SectionCompositionModel;
	item: ItemEntity;
}): string {
	return getCanonicalItemIdForItem(args.compositionModel, args.item);
}
