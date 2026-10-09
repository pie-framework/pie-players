import type {
	AssessmentEntity,
	AssessmentSettings,
	ToolParametersFor,
} from "@pie-players/pie-players-shared/types";

import type { PnpPolicyItem } from "../sources/PnpPolicySource.js";

/**
 * A tool's parameters for one decision: the item's `toolParameters` entry, else
 * the assessment's `toolConfigs` entry.
 *
 * Parameters say how a tool behaves wherever policy shows it, so they reach a
 * tool placed without a grant, and PNP enforcement does not gate them. `item` is
 * set only for a decision about the item's own toolbar or content.
 */
export function resolveToolParameters<K extends string>(
	toolId: K,
	assessment: AssessmentEntity | null | undefined,
	item: PnpPolicyItem | undefined,
): ToolParametersFor<K> | undefined {
	const settings = assessment?.settings as AssessmentSettings | undefined;
	const value =
		item?.settings.toolParameters?.[toolId] ?? settings?.toolConfigs?.[toolId];
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as ToolParametersFor<K>)
		: undefined;
}
