/**
 * Telling "nobody asked for this" apart from "nothing was bound to ask against".
 *
 * Both produce the same verdict — an ungranted feature — and only the second is a
 * defect. These pin the discriminant on the decision, that granting is unchanged
 * by it, and that it is not a synonym for denied.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";

const FEATURE = "signLanguage";

function engine(inputs: {
	assessment?: AssessmentEntity | null;
	currentItemRef?: AssessmentItemRef;
}) {
	return new ToolPolicyEngine({
		toolRegistry: new ToolRegistry(),
		inputs: {
			assessment: inputs.assessment ?? null,
			currentItemRef: inputs.currentItemRef ?? null,
		},
	});
}

describe("a denial says whether an assessment was bound", () => {
	test("no assessment bound is reported as such, with its own reason", () => {
		const decision = engine({}).decideFeature(FEATURE);
		expect(decision.assessmentBound).toBe(false);
		expect(decision.granted).toBe(false);
		expect(decision.reason).toBe(
			`No assessment is bound, so no policy source could grant "${FEATURE}"`,
		);
	});

	test("a bound profile that grants nothing keeps the evaluated reason", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["highlighter"] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.assessmentBound).toBe(true);
		expect(decision.granted).toBe(false);
		expect(decision.reason).toContain("not configured at any level");
	});

	test("a bare assessment record counts as bound", () => {
		// A test that grants nobody an accommodation is legitimate configuration;
		// never binding one is not. Only the second is the wiring gap, so profile
		// material is deliberately not part of this answer.
		const decision = engine({
			assessment: { id: "a1", name: "no profile material" } as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.assessmentBound).toBe(true);
		expect(decision.granted).toBe(false);
		expect(decision.reason).toContain("not configured at any level");
	});

	test("the verdict and its precedence are untouched", () => {
		// Nothing fired, so the rule stays what the source reported rather than
		// naming a seventh precedence level that does not exist.
		const decision = engine({}).decideFeature(FEATURE);
		expect(decision.action).toBe("skip");
		expect(decision.rule).toBe("pnp-support");
		expect(decision.precedence).toBe(6);
	});
});

describe("granting is unchanged", () => {
	test("a bound profile still grants", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({ granted: true, assessmentBound: true });
	});

	test("unbound is not a synonym for denied", () => {
		// An item ref carries its own mandate, so precedence 4 grants with no
		// assessment in sight — and the source's reason survives, because the
		// feature was in fact decided.
		const decision = engine({
			currentItemRef: {
				identifier: "i1",
				settings: { requiredTools: [FEATURE] },
			} as AssessmentItemRef,
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: true,
			assessmentBound: false,
			rule: "item-requirement",
			precedence: 4,
		});
		expect(decision.reason).not.toContain("No assessment is bound");
	});
});

describe("binding an assessment later", () => {
	test("flips the flag without a new engine", () => {
		const policyEngine = engine({});
		expect(policyEngine.decideFeature(FEATURE).assessmentBound).toBe(false);
		policyEngine.updateInputs({
			assessment: { id: "a1" } as AssessmentEntity,
		});
		expect(policyEngine.decideFeature(FEATURE).assessmentBound).toBe(true);
	});

	test("clearing it flips back", () => {
		const policyEngine = engine({
			assessment: { id: "a1" } as AssessmentEntity,
		});
		expect(policyEngine.decideFeature(FEATURE).assessmentBound).toBe(true);
		policyEngine.updateInputs({ assessment: null });
		expect(policyEngine.decideFeature(FEATURE).assessmentBound).toBe(false);
	});
});
