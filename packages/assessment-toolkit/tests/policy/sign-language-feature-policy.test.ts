/**
 * Feature policy for the `signLanguage` accommodation.
 *
 * Signing is policy-addressable but is not a toolbar tool, so eligibility comes
 * from `ToolPolicyEngine.decideFeature(...)` rather than a placement-scoped
 * `decide(...)`. These tests pin the two things the accommodation depends on:
 * the eight-level precedence applies unchanged, and it is never granted by
 * default.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	ItemSettings,
} from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";

const FEATURE = "signLanguage";

/** The scope item `i1`'s content asks feature policy with. */
const ITEM_SCOPE = { level: "item", scopeId: "i1" } as const;

function engine(inputs: {
	assessment?: AssessmentEntity;
	itemSettings?: ItemSettings;
}) {
	const created = new ToolPolicyEngine({
		toolRegistry: new ToolRegistry(),
		inputs: { assessment: inputs.assessment ?? null },
	});
	if (inputs.itemSettings) created.registerItemSettings("i1", inputs.itemSettings);
	return created;
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
			precedence: 8,
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
			itemSettings: { restrictedTools: [FEATURE] },
		}).decideFeature(FEATURE, ITEM_SCOPE);
		expect(decision.granted).toBe(false);
		expect(decision).toMatchObject({ rule: "item-restriction", precedence: 3 });
	});

	test("an item restriction does not reach a decision outside the item's scope", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: [FEATURE] },
			} as AssessmentEntity,
			itemSettings: { restrictedTools: [FEATURE] },
		}).decideFeature(FEATURE);
		expect(decision).toMatchObject({ granted: true, rule: "pnp-support" });
	});

	test("an item requirement mandates it", () => {
		const decision = engine({
			assessment: { id: "a1" } as AssessmentEntity,
			itemSettings: { requiredTools: [FEATURE] },
		}).decideFeature(FEATURE, ITEM_SCOPE);
		expect(decision).toMatchObject({
			granted: true,
			rule: "item-requirement",
			precedence: 6,
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
			precedence: 7,
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
			itemSettings: { toolParameters: { [FEATURE]: { signLang: "ase" } } },
		}).decideFeature(FEATURE, ITEM_SCOPE);
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

describe("an empty profile", () => {
	test("does not grant the accommodation", () => {
		const decision = engine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: [], prohibitedSupports: [] },
			} as AssessmentEntity,
		}).decideFeature(FEATURE);
		expect(decision.granted).toBe(false);
	});
});
