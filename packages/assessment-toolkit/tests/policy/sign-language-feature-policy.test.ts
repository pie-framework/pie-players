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
import {
	ACCOMMODATION_ONLY_SUPPORT_IDS,
	DEFAULT_PERSONAL_NEEDS_PROFILE,
	createDefaultPersonalNeedsProfile,
} from "../../src/services/defaultPersonalNeedsProfile.js";
import { createPackagedToolRegistry } from "../../src/services/createDefaultToolRegistry.js";
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

describe("default personal needs profile", () => {
	test("excludes accommodation-only support ids", () => {
		// Registering a signing tool must not switch signing on for every student
		// whose host does not supply a profile.
		expect(ACCOMMODATION_ONLY_SUPPORT_IDS).toContain(FEATURE);
		expect(DEFAULT_PERSONAL_NEEDS_PROFILE.supports).not.toContain(FEATURE);
		expect(createDefaultPersonalNeedsProfile().supports).not.toContain(FEATURE);
	});

	test("still includes the universal features the packaged registry declares", () => {
		const declared = new Set<string>();
		for (const tool of createPackagedToolRegistry().getAllTools()) {
			for (const supportId of tool.pnpSupportIds || []) declared.add(supportId);
		}
		const expected = [...declared].filter(
			(supportId) => !ACCOMMODATION_ONLY_SUPPORT_IDS.includes(supportId),
		);
		expect(DEFAULT_PERSONAL_NEEDS_PROFILE.supports.sort()).toEqual(
			expected.sort(),
		);
	});
});
