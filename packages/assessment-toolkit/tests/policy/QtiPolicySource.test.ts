/**
 * QTI Policy Source — precedence rule tests (M8 PR 1).
 *
 * Mirrors the precedence covered by `services/PNPToolResolver.ts`'s
 * `resolveSupport` body, exercised through the new `apply(...)` entry
 * point. PR 5 retires the legacy resolver; until then this file is
 * the canonical regression net for the 6-level QTI precedence.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { QtiPolicySource } from "../../src/policy/sources/QtiPolicySource.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";

function source() {
	const registry = new ToolRegistry();
	return new QtiPolicySource(registry);
}

describe("QtiPolicySource — 6-level precedence", () => {
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

	test("missing pnpSupport → toolId mapping uses supportId verbatim", () => {
		const result = source().apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["customSupport"] },
			} as AssessmentEntity,
		});
		expect(result.perToolFlags.has("customSupport")).toBe(true);
	});

	test("mapSupportToToolId — first-registered tool wins when multiple tools share a support id (R1 N6)", () => {
		// Locks the documented "first-wins" semantics of
		// `QtiPolicySource.mapSupportToToolId(...)`. A second tool that
		// claims the same `pnpSupportIds` array must not silently steal
		// the mapping; integrators who want to override should
		// `unregister(...)` the default first.
		const registry = new ToolRegistry();
		const baseToolReg = {
			name: "x",
			description: "x",
			icon: "x",
			supportedLevels: ["item" as const],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
		};
		registry.register({
			...baseToolReg,
			toolId: "calculator-default",
			pnpSupportIds: ["calculator"],
		});
		registry.register({
			...baseToolReg,
			toolId: "calculator-replacement",
			pnpSupportIds: ["calculator"],
		});

		const result = new QtiPolicySource(registry).apply({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["calculator"] },
			} as AssessmentEntity,
		});

		expect(result.perToolFlags.has("calculator-default")).toBe(true);
		expect(result.perToolFlags.has("calculator-replacement")).toBe(false);
	});

	test("mapSupportToToolId — unmapped support id falls through verbatim across all rules (R1 N6)", () => {
		// Sister case: when no tool registers `customSupport`, the
		// support id itself becomes the `featureId` for every decision
		// the source emits — including non-PNP rules. Hosts that rely
		// on raw QTI strings for unmapped tools depend on this.
		const registry = new ToolRegistry();
		const result = new QtiPolicySource(registry).apply({
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
