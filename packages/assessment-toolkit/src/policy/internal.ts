/**
 * Tool policy engine — **internal** entry point (M8 PR 1).
 *
 * Re-exports the composition pipeline, the QTI source, and the
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
 *                           composition pipeline, QTI source, and
 *                           any host that wants to reach past the
 *                           facade.
 */

export {
	composeDecision,
	type ComposeDecisionInputs,
} from "./core/compose-decision.js";

export {
	QtiPolicySource,
	type QtiPolicyApplyArgs,
	type QtiPolicyDecisionEvent,
	type QtiPolicyResult,
	type QtiToolFlags,
} from "./sources/QtiPolicySource.js";

export {
	ToolPolicyProvenanceBuilder,
	createEmptyToolPolicyProvenance,
} from "./core/provenance.js";
