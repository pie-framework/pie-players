/**
 * Tool policy engine — **internal** entry point (M8 PR 1).
 *
 * Re-exports the composition pipeline, the PNP policy source, and the
 * provenance builder for advanced hosts that want to drive the engine
 * components directly, and for the engine's own tests.
 *
 * **Stability posture.** This module is **not** part of the stable
 * public API. Symbols here are subject to change between minor
 * versions with only a changeset note. Hosts that need long-term
 * stability should depend on the facade (`ToolPolicyEngine` exported
 * from `./policy/engine`) instead.
 *
 * The split is intentional:
 *   - `./policy/engine`   — narrow, stable facade for common host
 *                           wiring and Svelte context.
 *   - `./policy/internal` — wide, evolving surface for the
 *                           composition pipeline, PNP policy source, and
 *                           any host that wants to reach past the
 *                           facade.
 */

export {
	composeDecision,
	type ComposeDecisionInputs,
} from "./core/compose-decision.js";

export {
	PnpPolicySource,
	type PnpPolicyApplyArgs,
	type PnpPolicyDecisionEvent,
	type PnpPolicyResult,
	type PnpPolicyToolFlags,
} from "./sources/PnpPolicySource.js";

export { ToolPolicyProvenanceBuilder } from "./core/provenance.js";

export {
	assessmentHasPnpPolicyInputs,
	itemRefHasPnpPolicyInputs,
	resolveDefaultPnpEnforcement,
} from "./core/pnp-policy-inputs.js";
