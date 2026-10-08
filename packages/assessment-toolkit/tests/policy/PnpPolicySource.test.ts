/**
 * PNP Policy Source — precedence rule tests (M8 PR 1).
 *
 * Exercises the canonical `PnpPolicySource.apply(...)` entry point for
 * PNP/profile precedence.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { PnpPolicySource } from "../../src/policy/sources/PnpPolicySource.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";
import { createTestToolRegistry } from "../fixtures/test-tool-registry.js";

function source() {
	const registry = new ToolRegistry();
	return new PnpPolicySource(registry);
}

describe("PnpPolicySource — 6-level precedence", () => {
	test("1. district-block overrides everything else", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				settings: {
					districtPolicy: {
						blockedTools: ["calculator"],
						requiredTools: ["calculator"],
					},
				},
				personalNeedsProfile: { supports: ["calculator"] },
			} as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: { requiredTools: ["calculator"] },
			} as AssessmentItemRef,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(true);
		expect(result.mandatedToolIds.has("calculator")).toBe(false);
		expect(result.decisions[0]).toMatchObject({
			rule: "district-block",
			action: "block",
			precedence: 1,
		});
	});

	test("2. test-admin override blocks even if district requires it", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				settings: {
					testAdministration: { toolOverrides: { calculator: false } },
					districtPolicy: { requiredTools: ["calculator"] },
				},
			} as AssessmentEntity,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(true);
		expect(
			result.decisions.find((d) => d.rule === "test-admin-override"),
		).toBeDefined();
	});

	test("3. item-restriction beats item-requirement", () => {
		const result = source().apply({
			assessment: { id: "a1" } as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: {
					requiredTools: ["calculator"],
					restrictedTools: ["calculator"],
				},
			} as AssessmentItemRef,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(true);
		expect(result.mandatedToolIds.has("calculator")).toBe(false);
	});

	test("4. item-requirement marks the tool required + mandated", () => {
		const result = source().apply({
			assessment: { id: "a1" } as AssessmentEntity,
			currentItemRef: {
				identifier: "i1",
				settings: { requiredTools: ["calculator"] },
			} as AssessmentItemRef,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(false);
		expect(result.mandatedToolIds.has("calculator")).toBe(true);
		expect(result.perToolFlags.get("calculator")).toMatchObject({
			required: true,
			alwaysAvailable: false,
			rule: "item-requirement",
		});
	});

	test("5. district-requirement marks the tool required + mandated", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				settings: { districtPolicy: { requiredTools: ["calculator"] } },
			} as AssessmentEntity,
		});
		expect(result.mandatedToolIds.has("calculator")).toBe(true);
		expect(result.perToolFlags.get("calculator")?.rule).toBe(
			"district-requirement",
		);
	});

	test("6. pnp-support marks the tool alwaysAvailable but NOT required", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["calculator"] },
			} as AssessmentEntity,
		});
		expect(result.perToolFlags.get("calculator")).toMatchObject({
			required: false,
			alwaysAvailable: true,
			rule: "pnp-support",
		});
		expect(result.mandatedToolIds.has("calculator")).toBe(false);
	});

	test("6. pnp-prohibited blocks even when supports lists the tool", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: {
					supports: ["calculator"],
					prohibitedSupports: ["calculator"],
				},
			} as AssessmentEntity,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(true);
		expect(
			result.decisions.find((d) => d.rule === "pnp-prohibited"),
		).toBeDefined();
	});

	test("6. pnp-prohibited blocks even when supports omits the tool", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: {
					prohibitedSupports: ["calculator"],
				},
			} as AssessmentEntity,
		});
		expect(result.blockedToolIds.has("calculator")).toBe(true);
		expect(result.perToolFlags.has("calculator")).toBe(false);
		expect(
			result.decisions.find((d) => d.rule === "pnp-prohibited"),
		).toMatchObject({
			action: "block",
			featureId: "calculator",
		});
	});

	test("an unregistered support id is carried through verbatim", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["customSupport"] },
			} as AssessmentEntity,
		});
		expect(result.perToolFlags.has("customSupport")).toBe(true);
	});

	test("an unregistered support id is reported only against a non-empty registry", () => {
		const assessment = {
			id: "a1",
			personalNeedsProfile: { supports: ["calculator", "customSupport"] },
		} as AssessmentEntity;

		expect([
			...new PnpPolicySource(createTestToolRegistry()).apply({ assessment })
				.unmappedSupportIds,
		]).toEqual(["customSupport"]);
		expect(
			new PnpPolicySource(new ToolRegistry()).apply({ assessment })
				.unmappedSupportIds.size,
		).toBe(0);
	});

	test("an unregistered support id is carried through verbatim across all rules", () => {
		// The support id itself becomes the `featureId` for every decision the
		// source emits, including non-PNP rules.
		const registry = new ToolRegistry();
		const result = new PnpPolicySource(registry).apply({
			assessment: {
				id: "a1",
				settings: {
					districtPolicy: { blockedTools: ["customSupport"] },
				},
			} as AssessmentEntity,
		});
		expect(result.blockedToolIds.has("customSupport")).toBe(true);
		expect(
			result.decisions.find(
				(d) => d.rule === "district-block" && d.featureId === "customSupport",
			),
		).toBeDefined();
	});

	test("attaches assessment + student source metadata when present", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				name: "Math Test",
				settings: { districtPolicy: { requiredTools: ["calculator"] } },
				personalNeedsProfile: { supports: ["lineReader"] },
			} as AssessmentEntity,
		});
		expect(result.sources.assessment).toMatchObject({
			id: "a1",
			name: "Math Test",
		});
		expect(result.sources.student?.id).toBe("student");
	});
});
