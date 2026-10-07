/**
 * A one-item section, for a host that holds a single item config in the shape
 * `<pie-item-player config>` takes and delivers it through a section player
 * layout. Side-effect free: importing it defines no custom element and runs in
 * Node.
 */

import type {
	AdvancedItemConfig,
	AssessmentItemRef,
	AssessmentSection,
	ConfigEntity,
	ItemConfig,
	ReferencedItemEntity,
	SectionControllerSessionState,
} from "@pie-players/pie-players-shared/types";

export interface ItemSectionOptions {
	/** Defaults to the item config's id. */
	sectionId?: string;
	itemVId?: string;
	/** The item's session, in the shape `<pie-item-player session>` takes. */
	session?: unknown;
}

export interface ItemSection {
	section: AssessmentSection;
	session: SectionControllerSessionState | null;
}

function isAdvancedItemConfig(
	config: ItemConfig,
): config is AdvancedItemConfig {
	return Boolean((config as Partial<AdvancedItemConfig>).pie);
}

/**
 * The fields of an advanced config with no section-level equivalent stay with
 * the item, on its config, as `<pie-item-player>` carries them. A value `pie`
 * already holds is kept.
 */
function itemFromAdvancedConfig(
	config: AdvancedItemConfig,
): ReferencedItemEntity {
	const itemConfig: ConfigEntity = { ...config.pie };
	if (
		config.instructorResources !== undefined &&
		itemConfig.instructorResources === undefined
	) {
		itemConfig.instructorResources = config.instructorResources;
	}
	if (
		config.defaultExtraModels !== undefined &&
		itemConfig.defaultExtraModels === undefined
	) {
		itemConfig.defaultExtraModels = config.defaultExtraModels;
	}
	const item: ReferencedItemEntity = { id: config.id, config: itemConfig };
	if (config.passage) {
		item.passage = { id: config.passage.id, config: config.passage };
	}
	return item;
}

/**
 * Build the `section` and `session` a section player layout takes from one item
 * config and, optionally, its session.
 *
 * The item ref's `identifier` and the item's `id` are the config's `id`, so
 * every `itemId` the section reports is the id the host already holds. The item
 * and its passage carry no `baseId` or `version`. The host sets `section-id` to
 * `section.identifier`.
 */
export function sectionFromItem(
	config: ItemConfig,
	options: ItemSectionOptions = {},
): ItemSection {
	const item: ReferencedItemEntity = isAdvancedItemConfig(config)
		? itemFromAdvancedConfig(config)
		: { id: config.id, config };
	const itemRef: AssessmentItemRef = { identifier: config.id, item };
	if (options.itemVId !== undefined) itemRef.itemVId = options.itemVId;
	return {
		section: {
			identifier: options.sectionId ?? config.id,
			assessmentItemRefs: [itemRef],
		},
		session:
			options.session == null
				? null
				: {
						currentItemIndex: 0,
						itemSessions: { [config.id]: options.session },
					},
	};
}
