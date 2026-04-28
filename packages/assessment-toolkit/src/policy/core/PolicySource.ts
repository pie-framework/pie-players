/**
 * Custom `PolicySource` extension point (M8 — see
 * `.cursor/plans/m8-design.md` § 5).
 *
 * Custom sources run in step 6 of the composition pipeline — *after*
 * placement membership, provider veto, host policy, and QTI gates.
 * That ordering is deliberate: custom rules can only further *narrow*
 * the candidate set or add advisory provenance entries; they cannot
 * promote a tool that the host already removed.
 *
 * Sources MUST be pure with respect to `decide(...)`: given the same
 * `(candidates, context)` input they should produce the same
 * `(refinedCandidates, decisions)` output. Side-effects are reserved
 * for the engine's own subscription bus (`onPolicyChange`).
 */

import type { ToolPolicyDecisionRequest } from "./decision-types.js";
import type {
	ToolPolicyDecisionRule,
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "./provenance.js";

export interface PolicySourceDecisionContext {
	request: ToolPolicyDecisionRequest;
	/**
	 * Snapshot of the candidate set as it enters this source. Sources
	 * SHOULD treat this as read-only and return a fresh array via
	 * `result.refinedCandidates`. Mutating `candidates` in place is
	 * not supported and will be flagged in tests.
	 */
	candidates: readonly string[];
}

export interface PolicySourceProvenanceEntry {
	rule: ToolPolicyDecisionRule;
	featureId: string;
	action: ToolPolicyResolutionDecision["action"];
	sourceType: ToolPolicySourceType;
	reason: string;
	value?: unknown;
	/**
	 * Custom precedence value used for the decision log. Defaults to
	 * `100 + sourceIndex` (engine-assigned) when `undefined`. Sources
	 * MAY override only if they know what they are doing — overriding
	 * to a value `<= 6` lets the source masquerade as a QTI rule and
	 * is generally a bug.
	 */
	precedence?: number;
}

export interface PolicySourceResult {
	/**
	 * Refined candidate set. MUST be a subset of `context.candidates`.
	 * Returning a superset is unsupported and will be normalized away
	 * by the engine (with an `tool-policy.placementMissing` diagnostic
	 * for any added IDs).
	 */
	refinedCandidates: string[];
	/**
	 * Provenance entries to append to the decision log. Each entry is
	 * recorded under `featureId` whether or not it survives — sources
	 * MAY emit advisory entries for blocked tools to document why.
	 */
	decisions?: PolicySourceProvenanceEntry[];
}

export interface PolicySource {
	/** Stable identifier — used for `custom.${id}` source tags. */
	readonly id: string;

	refine(context: PolicySourceDecisionContext): PolicySourceResult;
}
