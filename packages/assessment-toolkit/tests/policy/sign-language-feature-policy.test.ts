/**
 * Feature policy for the `signLanguage` accommodation.
 *
 * Signing is policy-addressable but is not a toolbar tool, so eligibility comes
 * from `ToolPolicyEngine.decideFeature(...)` rather than a placement-scoped
 * `decide(...)`. These tests pin the two things the accommodation depends on:
 * the six-level precedence applies unchanged, and it is never granted by
 * default.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import { createEmptyPersonalNeedsProfile } from "../../src/services/defaultPersonalNeedsProfile.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";

const FEATURE = "signLanguage";

function engine(inputs: {
	assessment?: AssessmentEntity;
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

describe("signLanguage feature eligibility", () => {
	test("is not granted when nothing configures it", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["highlighter"] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
		expect(decision.action).toBe("skip");
	});

	test("is not granted with no assessment bound at all", () => {
		expect(engine({}).decideFeature(FEATURE).granted).toBe(false);
	});

	test("is granted by a student PNP support", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: true,
			action: "enable",
			rule: "pnp-support",
			precedence: 6,
			sourceType: "student",
			required: false,
		});
	});

	test("is blocked by a PNP prohibition", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: {
					supports: [],
					prohibitedSupports: [FEATURE],
				},
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
		expect(decision.rule).toBe("pnp-prohibited");
	});

	test("district block beats a student support", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				settings: { districtPolicy: { blockedTools: [FEATURE] } },
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
		expect(decision).toMatchObject({ rule: "district-block", precedence: 1 });
	});

	test("a test-administration override withdraws it for the session", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				settings: {
					testAdministration: { toolOverrides: { [FEATURE]: false } },
				},
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
		expect(decision).toMatchObject({
			rule: "test-admin-override",
			precedence: 2,
		});
	});

	test("an item restriction withdraws it for one item", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: { restrictedTools: [FEATURE] },
			} as AssessmentItemRef,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
		expect(decision).toMatchObject({ rule: "item-restriction", precedence: 3 });
	});

	test("an item requirement mandates it", () => {
		const decision = engine({
			assessment: { id: "a1" } as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: { requiredTools: [FEATURE] },
			} as AssessmentItemRef,
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: true,
			rule: "item-requirement",
			precedence: 4,
			required: true,
		});
	});

	test("a district requirement mandates it", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				settings: { districtPolicy: { requiredTools: [FEATURE] } },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: true,
			rule: "district-requirement",
			precedence: 5,
			required: true,
		});
	});

	test("carries item parameters, with item level winning over assessment level", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				settings: { toolConfigs: { [FEATURE]: { signLang: "bfi" } } },
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: { toolParameters: { [FEATURE]: { signLang: "ase" } } },
			} as AssessmentItemRef,
		}).decideFeature(FEATURE);
		expect(decision.parameters).toEqual({ signLang: "ase" });
	});

	test("does not leak a verdict from another support id", () => {
		// `apply(...)` keys its maps by mapped tool id; a single-feature decision
		// must not pick up flags a different support contributed.
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["calculator"] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
	});

	test("throws after the engine is disposed", () => {
		const policyEngine = engine({});
		policyEngine.dispose();
		expect(() => policyEngine.decideFeature(FEATURE)).toThrow();
	});
});

describe("the core ships no populated default profile", () => {
	test("grants nothing", () => {
		// The core once derived a profile from every registered tool's
		// `pnpSupportIds`, which read registry membership as eligibility tier and
		// granted an accommodation to every student whose host supplied no profile.
		// Nothing is granted now, so no exclusion list is needed to keep signing
		// out.
		const profile = createEmptyPersonalNeedsProfile();
		expect(profile.supports).toEqual([]);
		expect(profile.prohibitedSupports).toEqual([]);
		expect(profile.activateAtInit).toEqual([]);
	});

	test("returns a fresh profile per call", () => {
		// Profiles flow into policy inputs hosts mutate; a shared reference would
		// let one host's edit reach another's.
		const first = createEmptyPersonalNeedsProfile();
		first.supports.push(FEATURE);
		expect(createEmptyPersonalNeedsProfile().supports).toEqual([]);
	});

	test("an empty profile does not grant the accommodation", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: createEmptyPersonalNeedsProfile(),
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
	});
});
