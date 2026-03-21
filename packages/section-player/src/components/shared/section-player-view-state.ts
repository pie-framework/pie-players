import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../../controllers/types.js";
import {
	getCanonicalItemIdForItem,
	getSessionForItemOrEmpty,
	EMPTY_COMPOSITION,
} from "./composition.js";
import type { PlayerElementParams } from "./player-action.js";
import { getRenderablesSignature } from "./player-preload.js";
import { mapRenderablesToItems } from "./section-player-runtime.js";

export type LayoutCompositionSnapshot = {
	compositionModel: SectionCompositionModel;
	passages: SectionCompositionModel["passages"];
	items: SectionCompositionModel["items"];
	renderables: ItemEntity[];
	renderablesSignature: string;
};

function resolveEmbeddedItemStrategy(playerStrategy: string): string {
	return playerStrategy === "iife" ? "preloaded" : playerStrategy;
}

export function getCompositionFromEvent(event: Event): SectionCompositionModel {
	const detail = (event as CustomEvent<{ composition?: SectionCompositionModel }>)
		.detail;
	return detail?.composition || EMPTY_COMPOSITION;
}

export function deriveLayoutCompositionSnapshot(
	compositionModel: SectionCompositionModel,
): LayoutCompositionSnapshot {
	const renderables = mapRenderablesToItems(compositionModel.renderables || []);
	return {
		compositionModel,
		passages: compositionModel.passages || [],
		items: compositionModel.items || [],
		renderables,
		renderablesSignature: getRenderablesSignature(compositionModel.renderables || []),
	};
}

export function getCompositionSnapshotFromEvent(
	event: Event,
): LayoutCompositionSnapshot {
	return deriveLayoutCompositionSnapshot(getCompositionFromEvent(event));
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
	const embeddedStrategy = resolveEmbeddedItemStrategy(args.playerStrategy);
	return {
		config: args.passage.config || {},
		env: args.resolvedPlayerEnv,
		attributes: {
			...(args.resolvedPlayerAttributes || {}),
			strategy: embeddedStrategy,
		},
		props: args.resolvedPlayerProps || {},
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
	const embeddedStrategy = resolveEmbeddedItemStrategy(args.playerStrategy);
	return {
		config: args.item.config || {},
		env: args.resolvedPlayerEnv,
		session: getSessionForItemOrEmpty(args.compositionModel, args.item),
		attributes: {
			...(args.resolvedPlayerAttributes || {}),
			strategy: embeddedStrategy,
		},
		props: args.resolvedPlayerProps || {},
	};
}

export function getCanonicalItemId(args: {
	compositionModel: SectionCompositionModel;
	item: ItemEntity;
}): string {
	return getCanonicalItemIdForItem(args.compositionModel, args.item);
}
