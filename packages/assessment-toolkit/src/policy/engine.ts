/**
 * Tool policy engine — the stable entry for a host that instantiates or
 * consumes a `ToolPolicyEngine`: the engine class, its decision request and
 * response types, and the `PolicySource` extension contract. The composition
 * pipeline, the PNP policy source and the provenance builder stay behind the
 * engine, with no entry of their own.
 */

export {
	ToolPolicyEngine,
	type PnpEnforcementMode,
	type ResolvedEngineInputs,
	type ToolPolicyChangeEvent,
	type ToolPolicyChangeListener,
	type ToolPolicyEngineArgs,
	type ToolPolicyEngineInputs,
} from "./core/ToolPolicyEngine.js";

export {
	isHostDeniedFeature,
	type FeaturePolicyDecision,
	type FeaturePolicyRule,
} from "./core/feature-decision.js";

export type {
	ItemSettingNotAppliedDetails,
	RequiredToolBlockedDetails,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
	ToolPolicyDiagnostic,
	ToolPolicyDiagnosticCode,
	ToolPolicyEntry,
	ToolPolicyHostGate,
	ToolScope,
	UnknownSupportIdDetails,
} from "./core/decision-types.js";

export type {
	PolicySource,
	PolicySourceDecisionContext,
	PolicySourceProvenanceEntry,
	PolicySourceResult,
} from "./core/PolicySource.js";

export type {
	PolicySourceTag,
	PnpPolicySourceRule,
	PnpPolicySourceTag,
	CustomPolicySourceTag,
} from "./core/policy-source-tag.js";

export type {
	ToolPolicyDecisionRule,
	ToolPolicyFeatureTrail,
	ToolPolicyProvenance,
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "./core/provenance.js";
