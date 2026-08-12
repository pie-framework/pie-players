import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../../controllers/types.js";
import {
	getCanonicalItemIdForItem,
	getSessionForItem,
	getSessionForItemOrEmpty,
	EMPTY_COMPOSITION,
} from "./composition.js";
import type { PlayerElementParams } from "./player-action.js";
import { getRenderablesSignature } from "./player-preload.js";
import { mapRenderablesToItems } from "./section-player-host-runtime.js";
import {
	resolveItemPlayerPropsWithBackend,
	stripItemDeliveryBackendProps,
} from "./section-player-backend-delivery.js";

/**
 * Heading depth as composition context.
 *
 * Where an item's headings belong in a document outline is a fact about the
 * page, not about the item: the same item renders under a host `<h1>` here and
 * three levels down there. The section player is the publisher — it knows the
 * level its own card headings occupy — and each PIE element is a resolver,
 * reading the level off the player host and deriving the outline it emits.
 * `docs/architecture/composition-context.md` states the pattern and its
 * invariants.
 *
 * The two content kinds get different values from the same level, and the
 * difference is not arbitrary:
 *
 * - An item card's heading ("Question 3") *is* the item's heading. The element
 *   must not emit a second one at that level, so it renders no screen-reader
 *   item heading and nests authored content one level below.
 * - A passage card's heading ("Passage") is a group label. The passage's own
 *   title is real content and belongs beneath it, so the passage player's level
 *   is one deeper again.
 *
 * At the default this yields card `h2` -> passage title `h3` -> passage content
 * `h4`, and question `h2` -> prompt content `h3`, which is the outline
 * PIE-159 specifies.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Matches the level the cards rendered at before it was configurable. */
export const DEFAULT_SECTION_BASE_HEADING_LEVEL: HeadingLevel = 2;

/**
 * Levels a resolver can still nest under. Above this, passage sub-content
 * clamps at `h6` and the outline flattens rather than nesting, which reads to
 * assistive technology as siblings.
 */
const DEEPEST_NESTABLE_BASE_LEVEL = 4;
const warnedDeepLevels = new Set<number>();

export function normalizeBaseHeadingLevel(value: unknown): HeadingLevel {
	const parsed =
		typeof value === "number"
			? value
			: Number.parseInt(String(value ?? ""), 10);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
		return DEFAULT_SECTION_BASE_HEADING_LEVEL;
	}
	if (parsed > DEEPEST_NESTABLE_BASE_LEVEL && !warnedDeepLevels.has(parsed)) {
		warnedDeepLevels.add(parsed);
		console.warn(
			`[pie-section-player] baseHeadingLevel=${parsed} leaves no room to nest: ` +
				"passage sub-content clamps at h6 and the outline flattens. " +
				"Levels 1-4 keep the full structure.",
		);
	}
	return parsed as HeadingLevel;
}

/** Card heading fills the item's slot, so the element adds none of its own. */
export function itemHeadingContext(
	level: HeadingLevel,
): Record<string, unknown> {
	return { baseHeadingLevel: level, includeSrHeading: false };
}

/** Card heading is a group label; the passage's own title sits one below it. */
export function passageHeadingContext(
	level: HeadingLevel,
): Record<string, unknown> {
	return { baseHeadingLevel: Math.min(6, level + 1) as HeadingLevel };
}

export type LayoutCompositionSnapshot = {
	compositionModel: SectionCompositionModel;
	passages: SectionCompositionModel["passages"];
	items: SectionCompositionModel["items"];
	renderables: ItemEntity[];
	renderablesSignature: string;
};

export function getCompositionFromEvent(event: Event): SectionCompositionModel {
	const detail = (
		event as CustomEvent<{ composition?: SectionCompositionModel }>
	).detail;
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
		renderablesSignature: getRenderablesSignature(
			compositionModel.renderables || [],
		),
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
	baseHeadingLevel?: HeadingLevel;
}): PlayerElementParams {
	// Keep passage visuals aligned with item defaults by sharing the same
	// runtime env shape; passage content remains non-response by content model.
	// Strategy is propagated verbatim: with the deep ElementLoader primitive,
	// aggregate pre-warming is a performance optimization rather than a
	// correctness-critical coordination mechanism, so embedded items keep the
	// host's requested strategy and independently call ensureRegistered /
	// assertRegistered.
	return {
		config: args.passage.config || {},
		env: args.resolvedPlayerEnv,
		attributes: {
			...(args.resolvedPlayerAttributes || {}),
			strategy: args.playerStrategy,
		},
		// Heading context first: a host that names either prop through
		// `runtime.player` is overriding the composition default deliberately.
		props: {
			...passageHeadingContext(
				args.baseHeadingLevel ?? DEFAULT_SECTION_BASE_HEADING_LEVEL,
			),
			...stripItemDeliveryBackendProps(args.resolvedPlayerProps || {}),
		},
	};
}

export function getItemPlayerParams(args: {
	item: ItemEntity;
	compositionModel: SectionCompositionModel;
	resolvedPlayerEnv: Record<string, unknown>;
	resolvedPlayerAttributes: Record<string, string>;
	resolvedPlayerProps: Record<string, unknown>;
	playerStrategy: string;
	itemIndex?: number;
	baseHeadingLevel?: HeadingLevel;
}): PlayerElementParams {
	const rawItemSession = getSessionForItem(args.compositionModel, args.item);
	const itemSession = getSessionForItemOrEmpty(
		args.compositionModel,
		args.item,
	);
	const canonicalItemId = getCanonicalItemIdForItem(
		args.compositionModel,
		args.item,
	);
	return {
		config: args.item.config || {},
		env: args.resolvedPlayerEnv,
		session: itemSession,
		attributes: {
			...(args.resolvedPlayerAttributes || {}),
			strategy: args.playerStrategy,
		},
		// Heading context first: a host that names either prop through
		// `runtime.player` is overriding the composition default deliberately.
		props: resolveItemPlayerPropsWithBackend({
			resolvedPlayerProps: {
				...itemHeadingContext(
					args.baseHeadingLevel ?? DEFAULT_SECTION_BASE_HEADING_LEVEL,
				),
				...(args.resolvedPlayerProps || {}),
			},
			item: args.item,
			canonicalItemId,
			itemSession:
				rawItemSession && typeof rawItemSession === "object"
					? (rawItemSession as Record<string, unknown>)
					: undefined,
			itemIndex: args.itemIndex,
			sectionId: args.compositionModel.section?.identifier,
			env: args.resolvedPlayerEnv,
		}),
	};
}

export function getCanonicalItemId(args: {
	compositionModel: SectionCompositionModel;
	item: ItemEntity;
}): string {
	return getCanonicalItemIdForItem(args.compositionModel, args.item);
}
