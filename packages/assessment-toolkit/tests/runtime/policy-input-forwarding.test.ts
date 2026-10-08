import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import {
	type ForwardedPolicyInputs,
	policyInputsToForward,
} from "../../src/runtime/policy-input-forwarding.js";

const unset: ForwardedPolicyInputs = {
	pnpEnforcement: null,
	assessment: null,
};

describe("policyInputsToForward", () => {
	test("a new coordinator receives only the inputs that are set", () => {
		expect(policyInputsToForward(null, unset)).toEqual([]);
		const assessment = { id: "a1" } as AssessmentEntity;
		expect(
			policyInputsToForward(null, { ...unset, pnpEnforcement: "on", assessment }),
		).toEqual(["pnpEnforcement", "assessment"]);
	});

	test("a re-run with unchanged inputs forwards nothing, so a host binding survives", () => {
		// An embedded toolkit has no `assessment` prop; its host binds one on the
		// coordinator. A later `tools` change re-runs the effect with the same
		// toolkit inputs, which must not send `assessment: null` over the binding.
		expect(policyInputsToForward(unset, { ...unset })).toEqual([]);
	});

	test("forwards the inputs whose value changed, enforcement first", () => {
		const assessment = { id: "a1" } as AssessmentEntity;
		expect(
			policyInputsToForward(
				{ ...unset, assessment: { id: "a0" } as AssessmentEntity },
				{ pnpEnforcement: "off", assessment },
			),
		).toEqual(["pnpEnforcement", "assessment"]);
	});
});
