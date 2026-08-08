/**
 * Feature policy decisions — eligibility for policy-addressable capabilities
 * that are not toolbar tools.
 *
 * "Tool" in this codebase means *policy-addressable capability*, not "gadget on
 * a toolbar" (see `docs/tools-and-accomodations/architecture.md`). Most such
 * capabilities render as toolbar surfaces, so the engine's main answer is a
 * placement-scoped `ToolPolicyDecision`. Some do not: a signed alternate renders
 * as its own region and is never placed on a toolbar, so asking
 * `decide({ level: "item", ... })` about it would answer the wrong question —
 * it would be absent because it is not in `tools.placement.item`, not because
 * policy said no.
 *
 * A feature decision answers only the eligibility half: *did policy grant this
 * feature id?* Whether the capability has anything to show is a separate,
 * independent check owned by its renderer — for signing, whether a matching
 * catalog card exists. Both are required; neither implies the other.
 */

import type { PnpPolicyResult } from "../sources/PnpPolicySource.js";
import type { PnpPolicySourceRule } from "./policy-source-tag.js";
import type {
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "./provenance.js";

export interface FeaturePolicyDecision {
	/** The PNP/AfA support id that was evaluated (e.g. `"signLanguage"`). */
	featureId: string;
	/**
	 * `true` only when policy explicitly granted the feature at one of the six
	 * precedence levels. A feature nobody configured is **not** available —
	 * accommodations require a documented need, so silence means no.
	 */
	granted: boolean;
	action: ToolPolicyResolutionDecision["action"];
	/** Which precedence rule produced the verdict. */
	rule: PnpPolicySourceRule;
	precedence: 1 | 2 | 3 | 4 | 5 | 6;
	sourceType: ToolPolicySourceType;
	/** Human-readable explanation, suitable for a policy debugger. */
	reason: string;
	/**
	 * `true` when the grant is a mandate (item or district `requiredTools`)
	 * rather than a student-profile support.
	 */
	required: boolean;
	/**
	 * Feature parameters resolved from item `toolParameters` then assessment
	 * `toolConfigs`, keyed by the feature id. The seam a later configurable
	 * presentation would hang on; no vocabulary is defined yet.
	 */
	parameters?: unknown;
}

/**
 * Interpret a single-feature `PnpPolicySource.resolveFeature(...)` result.
 *
 * `resolveFeature` evaluates exactly one support id, so the result carries
 * exactly one decision and at most one flags entry — no mapped-tool-id
 * bookkeeping is needed to read it back out.
 */
export function interpretFeatureResult(
	featureId: string,
	result: PnpPolicyResult,
): FeaturePolicyDecision {
	const decision = result.decisions[0];
	const flags = Array.from(result.perToolFlags.values())[0];
	return {
		featureId,
		granted: decision?.action === "enable",
		action: decision?.action ?? "skip",
		rule: decision?.rule ?? "pnp-support",
		precedence: decision?.precedence ?? 6,
		sourceType: decision?.sourceType ?? "system",
		reason: decision?.reason ?? `Feature "${featureId}" not configured`,
		required: Boolean(flags?.required),
		parameters: flags?.settings,
	};
}
