/**
 * Which policy inputs `<pie-assessment-toolkit>` forwards to the coordinator it
 * owns.
 *
 * The toolkit forwards an input when its own value for it changes. A host
 * driving the owned coordinator directly — an embedded toolkit's host binds its
 * assessment from `runtime-ready` or `toolkit-ready` — keeps that binding until
 * the toolkit's own value changes, so an unrelated re-run of the forwarding
 * effect (a `tools` change, a coordinator rebuild trigger) cannot reset it. A
 * coordinator not forwarded to yet is newly built and holds no inputs, so it
 * receives only the inputs that are set.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import type { PnpEnforcementMode } from "../policy/core/ToolPolicyEngine.js";

export interface ForwardedPolicyInputs {
	pnpEnforcement: PnpEnforcementMode | null;
	assessment: AssessmentEntity | null;
	currentItemRef: AssessmentItemRef | null;
}

/**
 * The inputs to forward, in apply order: the enforcement override first, so
 * binding the assessment never resolves auto-mode against a stale override.
 * `previous` is what was last forwarded to the same coordinator, or `null` for
 * a coordinator not forwarded to yet.
 */
export function policyInputsToForward(
	previous: ForwardedPolicyInputs | null,
	next: ForwardedPolicyInputs,
): Array<keyof ForwardedPolicyInputs> {
	const order: Array<keyof ForwardedPolicyInputs> = [
		"pnpEnforcement",
		"assessment",
		"currentItemRef",
	];
	return order.filter((key) =>
		previous ? !Object.is(previous[key], next[key]) : next[key] !== null,
	);
}
