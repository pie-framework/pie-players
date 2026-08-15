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
 *
 * A denial carries `assessmentBound`, because "nobody asked for this" and
 * "nothing was bound to ask against" are the same verdict for different
 * reasons, and only the second is a defect.
 */

import type { PnpPolicyResult } from "../sources/PnpPolicySource.js";
import type { PnpPolicySourceRule } from "./policy-source-tag.js";
import type {
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "./provenance.js";

/**
 * A feature verdict comes from one of the six PNP precedence levels, or from a
 * host gate that never reaches them: `tools.policy.blocked` and a non-empty
 * `tools.policy.allowed` are absolute for the id they name, exactly as they are
 * on the placement-scoped path.
 */
export type FeaturePolicyRule =
	| PnpPolicySourceRule
	| "host-allowlist"
	| "host-blocked";

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
	rule: FeaturePolicyRule;
	precedence: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	sourceType: ToolPolicySourceType;
	/** Human-readable explanation, suitable for a policy debugger. */
	reason: string;
	/**
	 * Whether an assessment was bound when this was decided.
	 *
	 * `false` makes a *denial* a wiring gap rather than a verdict: no profile,
	 * district policy or test administration could be consulted, because there was
	 * no assessment to read them from. It is not itself a denial — an item ref
	 * carrying `requiredTools` mandates a feature at precedence 4 with no
	 * assessment bound — so read it alongside `granted` rather than instead of it.
	 *
	 * Granting is unaffected either way: an unbound host with no item mandate still
	 * gets `granted: false`, since an accommodation requires a documented need and
	 * an absent profile documents nothing.
	 *
	 * A bound assessment carrying no profile material is deliberately `true`: a
	 * test that grants nobody an accommodation is a legitimate configuration,
	 * while never binding one cannot be.
	 */
	assessmentBound: boolean;
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

/** What the engine knows that a single support-id resolution does not. */
export interface FeatureDecisionContext {
	/** Whether the engine has an assessment bound. */
	assessmentBound: boolean;
}

/**
 * Reason text for a denial that had no assessment to decide against.
 *
 * Replaces the `pnp-support` skip's "not configured at any level", which is
 * true but reads as a completed evaluation. `rule` and `precedence` stay as the
 * source reported them: nothing fired, so naming a seventh rule would describe
 * a precedence level that does not exist.
 */
const unboundAssessmentReason = (featureId: string) =>
	`No assessment is bound, so no policy source could grant "${featureId}"`;

/**
 * A host gate denied the feature outright, so no policy source was consulted.
 *
 * `precedence: 0` and the two `host-*` rules are the same values
 * `composeDecision(...)` records for the placement-scoped path, so a debugger
 * reads one vocabulary for both. `assessmentBound` is still reported: a host
 * blocklist is a verdict whether or not an assessment was bound, and the flag
 * only ever qualifies a *policy* denial.
 */
export function hostFeatureDenial(
	featureId: string,
	rule: "host-allowlist" | "host-blocked",
	hostValue: readonly string[],
	context: FeatureDecisionContext,
): FeaturePolicyDecision {
	return {
		featureId,
		granted: false,
		action: "block",
		rule,
		precedence: 0,
		sourceType: "host",
		reason:
			rule === "host-blocked"
				? "Listed in tools.policy.blocked"
				: `Not listed in tools.policy.allowed (${hostValue.join(", ")})`,
		required: false,
		assessmentBound: context.assessmentBound,
	};
}

/**
 * Whether a host gate produced the verdict, rather than a policy source.
 *
 * The distinction is load-bearing for a content-dependent capability that
 * declares `resolvesWithoutGrant`: an absent grant is a case it is allowed to
 * answer from the content alone, while a host denial is the host's off switch
 * and nothing may reopen it.
 */
export function isHostDeniedFeature(
	decision: Pick<FeaturePolicyDecision, "rule"> | null | undefined,
): boolean {
	return (
		decision?.rule === "host-blocked" || decision?.rule === "host-allowlist"
	);
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
	context: FeatureDecisionContext,
): FeaturePolicyDecision {
	const decision = result.decisions[0];
	const flags = Array.from(result.perToolFlags.values())[0];
	const granted = decision?.action === "enable";
	const reason = decision?.reason ?? `Feature "${featureId}" not configured`;
	return {
		featureId,
		granted,
		action: decision?.action ?? "skip",
		rule: decision?.rule ?? "pnp-support",
		precedence: decision?.precedence ?? 6,
		sourceType: decision?.sourceType ?? "system",
		// Only a denial is re-worded. An unbound host can still be granted the
		// feature — an item ref carrying `requiredTools` mandates it at precedence 4
		// with no assessment in sight — and there the source's reason is the true
		// one.
		reason:
			context.assessmentBound || granted
				? reason
				: unboundAssessmentReason(featureId),
		required: Boolean(flags?.required),
		parameters: flags?.settings,
		assessmentBound: context.assessmentBound,
	};
}
