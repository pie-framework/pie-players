import type {
	AssessmentEntity,
	AssessmentSettings,
	ToolParametersFor,
} from "@pie-players/pie-players-shared/types";

import type { PnpPolicyItem } from "../sources/PnpPolicySource.js";

function asParameters(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/**
 * A tool's parameters for one decision, merged key by key: the profile's
 * `toolParameters` entry, overridden by the assessment's, overridden by the
 * item's.
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
	const layers = [
		assessment?.personalNeedsProfile?.toolParameters?.[toolId],
		settings?.toolParameters?.[toolId],
		item?.settings.toolParameters?.[toolId],
	]
		.map(asParameters)
		.filter((layer) => layer !== undefined);
	return layers.length > 0
		? (Object.assign({}, ...layers) as ToolParametersFor<K>)
		: undefined;
}
