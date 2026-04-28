/**
 * Tool policy engine — facade entry point (M8 PR 1).
 *
 * Narrow, stable public surface for hosts that want to instantiate or
 * consume a `ToolPolicyEngine`. Re-exports the engine class, its
 * decision request/response types, the Svelte context key, and the
 * minimal `PolicySource` extension contract.
 *
 * **Pairing.** This module is the stable counterpart to
 * `./policy/internal`, which exposes the wider, evolving surface
 * (composition pipeline, provenance builder, QTI source). Consumers
 * that only need to drive an engine and read its decisions should
 * import from here. Consumers that need to reach past the facade
 * (e.g. test the composition pipeline directly, build a custom QTI
 * source variant, instrument provenance generation) should import
 * from `./policy/internal` and accept the documented stability
 * disclaimer there.
 *
 * Mirrors the M7 `runtime/engine` / `runtime/internal` split — see
 * the same rationale in `src/runtime/engine.ts`.
 */

export {
	ToolPolicyEngine,
	type QtiEnforcementMode,
	type ResolvedEngineInputs,
	type ToolPolicyChangeEvent,
	type ToolPolicyChangeListener,
	type ToolPolicyEngineArgs,
	type ToolPolicyEngineInputs,
} from "./core/ToolPolicyEngine.js";

export {
	TOOL_POLICY_ENGINE_KEY,
	type ToolPolicyEngineContext,
} from "./core/engine-context.js";

export type {
	QtiRequiredBlockedDetails,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
	ToolPolicyDiagnostic,
	ToolPolicyDiagnosticCode,
	ToolPolicyEntry,
	ToolPolicyHostGate,
	ToolScope,
} from "./core/decision-types.js";

export type {
	PolicySource,
	PolicySourceDecisionContext,
	PolicySourceProvenanceEntry,
	PolicySourceResult,
} from "./core/PolicySource.js";

export type {
	PolicySourceTag,
	QtiPolicySourceRule,
	QtiPolicySourceTag,
	CustomPolicySourceTag,
} from "./core/policy-source-tag.js";

export type {
	ToolPolicyDecisionRule,
	ToolPolicyFeatureTrail,
	ToolPolicyProvenance,
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "./core/provenance.js";
