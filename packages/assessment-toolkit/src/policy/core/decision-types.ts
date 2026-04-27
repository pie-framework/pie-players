/**
 * Tool Policy Engine — decision input/output types.
 *
 * These types describe the *request/response* contract for
 * `ToolPolicyEngine.decide(...)`. The engine itself, plus the
 * composition pipeline that produces the response, lives in sibling
 * modules.
 *
 * See `.cursor/plans/m8-design.md` § 2 for the engine shape, § 3 for
 * the composition rule, and § 4 for the provenance contract.
 */

import type { ToolPlacementLevel } from "../../services/tools-config-normalizer.js";
import type { ToolContext, ToolLevel } from "../../services/tool-context.js";
import type { PolicySourceTag } from "./policy-source-tag.js";
import type { ToolPolicyProvenance } from "./provenance.js";

/**
 * Scope identifier for a `decide(...)` request. The engine uses
 * `level` to pick which placement bucket to read; `scopeId` is opaque
 * to the engine (it is round-tripped into provenance for human-readable
 * trails) and is typically the section-id, item-id, or passage-id of
 * the surface asking the question. `contentKind` mirrors the
 * `ToolbarContext.scope.contentKind` field already in use by
 * `<pie-item-toolbar>` Pass-2 visibility.
 */
export interface ToolScope {
	level: ToolLevel;
	scopeId: string;
	assessmentId?: string;
	sectionId?: string;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: string;
}

export interface ToolPolicyDecisionRequest {
	/**
	 * Placement bucket the engine reads from
	 * (`tools.placement[level]`). Stays narrow (`section | item |
	 * passage`) — broader `ToolLevel` values from `tool-context.ts`
	 * are surfaced through `scope.level` only.
	 */
	level: ToolPlacementLevel;
	scope: ToolScope;
	/**
	 * Optional Pass-2 context. The engine itself does NOT call
	 * `isVisibleInContext(...)`; that gate is intentionally applied
	 * at the toolbar boundary (Pass-2 = relevance, Pass-1 = the
	 * engine's job). The context is forwarded to custom
	 * `PolicySource` instances so they can refine the candidate set
	 * if they need to.
	 */
	context?: ToolContext;
}

/**
 * Diagnostic codes the engine may emit alongside a decision. The
 * canonical case in M8 is `tool-policy.qtiRequiredBlocked` — fired
 * when a host policy gate (`policy.blocked`, missing-from-`placement`,
 * provider veto) removed a tool that QTI's `requiredTools` /
 * `district.requiredTools` mandates.
 *
 * `tool-policy.placementMissing` fires when a custom `PolicySource`
 * references a tool ID that is not present in `tools.placement[level]`
 * for the resolved level. The host-side `ToolConfigDiagnostic` channel
 * (already used by `tool-config-validation.ts`) covers config-time
 * misconfiguration; this channel covers per-decision conflicts.
 */
export type ToolPolicyDiagnosticCode =
	| "tool-policy.qtiRequiredBlocked"
	| "tool-policy.placementMissing";

/**
 * Which host gate removed a QTI-mandated tool. Surfaced inside
 * `ToolPolicyDiagnostic.details` for `tool-policy.qtiRequiredBlocked`
 * so consumers can render a single human-readable explanation
 * ("the proctor blocked the calculator that this student's IEP
 * requires") without re-deriving the host gate from
 * `provenance.features[toolId].allDecisions`.
 *
 * The four values mirror steps 1–4 of `composeDecision`:
 *   - `placement-missing` — tool is not in `tools.placement[level]`
 *   - `provider-disabled` — `tools.providers[id].enabled === false`
 *   - `host-allowlist`    — non-empty `tools.policy.allowed` excludes the id
 *   - `host-blocked`      — `tools.policy.blocked` lists the id
 */
export type ToolPolicyHostGate =
	| "placement-missing"
	| "provider-disabled"
	| "host-allowlist"
	| "host-blocked";

/**
 * Strongly-typed payload for `tool-policy.qtiRequiredBlocked`
 * diagnostics. The diagnostic's `details` field still types as
 * `Record<string, unknown>` for forward compatibility, but engines
 * always populate this exact shape today and consumers can safely
 * cast.
 */
export interface QtiRequiredBlockedDetails extends Record<string, unknown> {
	/** The QTI rule that mandated the tool (e.g. `district-requirement`). */
	rule: string;
	/** Which host gate removed the tool. */
	hostRule: ToolPolicyHostGate;
	/** The host configuration value that triggered the gate (best-effort, may be omitted). */
	hostValue?: unknown;
}

export interface ToolPolicyDiagnostic {
	code: ToolPolicyDiagnosticCode;
	level: ToolPlacementLevel;
	toolId: string;
	message: string;
	source?: PolicySourceTag;
	details?: Record<string, unknown>;
}

export interface ToolPolicyEntry {
	toolId: string;
	/**
	 * `true` when QTI mandates this tool (item or district
	 * `requiredTools`, or PNP support without prohibition). Advisory
	 * mandates that the host blocked do *not* surface here — they
	 * appear in `diagnostics` instead. Hosts that need to know about
	 * those should listen on the diagnostic channel.
	 */
	required: boolean;
	/**
	 * `true` for PNP `supports` — UI-level signal that the host
	 * cannot toggle this tool off in user preferences. Does NOT
	 * override host blocks (they would have removed the entry
	 * before this flag is read).
	 */
	alwaysAvailable: boolean;
	/**
	 * Tool-specific settings resolved from the assessment / item
	 * settings via the QTI source. Hosts that want to read these
	 * directly should use `entry.settings` rather than peeking into
	 * the assessment entity from above the engine.
	 */
	settings?: unknown;
	/**
	 * Every contributor that helped this entry survive the
	 * composition pipeline. Always non-empty — at minimum
	 * `["placement"]` for any entry that came from
	 * `tools.placement[level]`.
	 */
	sources: PolicySourceTag[];
}

export interface ToolPolicyDecision {
	visibleTools: ToolPolicyEntry[];
	diagnostics: ToolPolicyDiagnostic[];
	provenance: ToolPolicyProvenance;
}
