/**
 * The coordinator logs each policy diagnostic once per code and tool, from
 * toolbar and feature decisions and from the engine's resolved inputs, so a
 * host sees a misnamed id or an overruled requirement in its console without
 * reading decisions.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import type { ToolPolicyDiagnostic } from "../../src/policy/core/decision-types.js";
import {
	createTestToolRegistration,
	createTestToolRegistry,
} from "../fixtures/test-tool-registry.js";

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

const warnings = (fragment: string) =>
	warn.mock.calls
		.map((call: unknown[]) => String(call[0]))
		.filter((message: string) => message.includes(fragment));

function makeCoordinator(
	assessment: AssessmentEntity,
	toolRegistry = createTestToolRegistry(),
) {
	const coord = new ToolkitCoordinator({
		assessmentId: "diagnostic-warnings",
		lazyInit: true,
		toolRegistry,
		tools: {
			policy: { allowed: [], blocked: ["calculator"] },
			placement: { item: ["calculator", "lineReader"] },
		},
	});
	coord.updateAssessment(assessment);
	return coord;
}

const ITEM_TOOLBAR = {
	level: "item",
	scope: { level: "item", scopeId: "i1" },
} as const;

describe("coordinator diagnostic warnings", () => {
	test("an unregistered id warns once, however often toolbars decide", () => {
		const coord = makeCoordinator({
			id: "a1",
			personalNeedsProfile: { supports: ["lineReadr"] },
		} as AssessmentEntity);

		coord.decideToolPolicy(ITEM_TOOLBAR);
		coord.decideToolPolicy(ITEM_TOOLBAR);

		const reported = warnings('"lineReadr"');
		expect(reported).toHaveLength(1);
		expect(reported[0]).toContain("personalNeedsProfile.supports");
	});

	test("a blocked requirement warns once", () => {
		const coord = makeCoordinator({
			id: "a1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity);

		coord.decideToolPolicy(ITEM_TOOLBAR);
		coord.decideToolPolicy(ITEM_TOOLBAR);

		expect(warnings('"calculator"')).toHaveLength(1);
	});

	test("an unregistered id is warned from the inputs, before and without any decision", () => {
		const coord = makeCoordinator({
			id: "a1",
			personalNeedsProfile: { supports: ["signLanguag"] },
		} as AssessmentEntity);

		expect(warnings('"signLanguag"')).toHaveLength(1);
		const decision = coord.decideFeaturePolicy("lineReader");
		coord.decideToolPolicy(ITEM_TOOLBAR);

		expect(decision.diagnostics).toEqual([]);
		expect(
			coord.getPolicyInputs().diagnostics.map((d) => [d.code, d.toolId, d.level]),
		).toEqual([["tool-policy.unknownSupportId", "signLanguag", undefined]]);
		expect(warnings('"signLanguag"')).toHaveLength(1);
	});
});

describe("an unregistered id and the tool registry", () => {
	const replayed = (coord: ToolkitCoordinator) => {
		const seen: ToolPolicyDiagnostic[] = [];
		coord.onPolicyDiagnostic((diagnostic) => seen.push(diagnostic))();
		return seen
			.filter((d) => d.code === "tool-policy.unknownSupportId")
			.map((d) => d.toolId);
	};

	test("registering the id in place clears it, and unregistering reports it again", () => {
		const registry = createTestToolRegistry();
		const coord = makeCoordinator(
			{
				id: "a1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
			registry,
		);
		const live: string[] = [];
		coord.onPolicyDiagnostic((d) => live.push(d.toolId));
		expect(replayed(coord)).toEqual(["responseMasking"]);

		registry.register(
			createTestToolRegistration({
				toolId: "responseMasking",
				supportedLevels: ["item"],
			}),
		);
		expect(replayed(coord)).toEqual([]);
		expect(coord.getPolicyInputs().diagnostics).toEqual([]);

		registry.unregister("responseMasking");
		expect(replayed(coord)).toEqual(["responseMasking"]);
		expect(live).toEqual(["responseMasking", "responseMasking"]);
		expect(warnings('"responseMasking"')).toHaveLength(2);
	});
});

describe("a granting tool override below a restriction or prohibition", () => {
	function overrideCoordinator(
		assessment: AssessmentEntity,
		restrictedTools?: string[],
	) {
		const coord = new ToolkitCoordinator({
			assessmentId: "override-blocked",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
			tools: { placement: { item: ["calculator", "lineReader"] } },
		});
		coord.updateAssessment(assessment);
		if (restrictedTools) coord.registerItemSettings("i1", { restrictedTools });
		return coord;
	}
	const visible = (coord: ToolkitCoordinator) =>
		coord.decideToolPolicy(ITEM_TOOLBAR).visibleTools.map((e) => e.toolId);
	const overrideTrue = {
		testAdministration: { toolOverrides: { calculator: true } },
	};

	test("an item restriction withdraws it, reported once", () => {
		const coord = overrideCoordinator(
			{
				id: "a1",
				personalNeedsProfile: {
					supports: [],
					prohibitedSupports: ["calculator"],
				},
				settings: overrideTrue,
			} as AssessmentEntity,
			["calculator"],
		);

		const decision = coord.decideToolPolicy(ITEM_TOOLBAR);
		coord.decideToolPolicy(ITEM_TOOLBAR);

		expect(decision.visibleTools.map((e) => e.toolId)).not.toContain(
			"calculator",
		);
		expect(
			decision.diagnostics.filter(
				(d) => d.code === "tool-policy.overrideBlocked",
			),
		).toEqual([
			expect.objectContaining({
				toolId: "calculator",
				details: { rule: "item-restriction" },
			}),
		]);
		const reported = warnings("toolOverrides grants");
		expect(reported).toHaveLength(1);
		expect(reported[0]).toContain("item settings.restrictedTools");
	});

	test("a profile prohibition withdraws it, on a feature decision too", () => {
		const coord = overrideCoordinator({
			id: "a1",
			personalNeedsProfile: {
				supports: [],
				prohibitedSupports: ["calculator"],
			},
			settings: overrideTrue,
		} as AssessmentEntity);

		expect(visible(coord)).not.toContain("calculator");
		const decision = coord.decideFeaturePolicy("calculator");
		expect(decision).toMatchObject({ granted: false, rule: "pnp-prohibited" });
		expect(decision.diagnostics).toEqual([
			expect.objectContaining({
				code: "tool-policy.overrideBlocked",
				toolId: "calculator",
				details: { rule: "pnp-prohibited" },
			}),
		]);
		expect(warnings("toolOverrides grants")).toHaveLength(1);
	});

	test("with no restriction or prohibition it still grants", () => {
		const coord = overrideCoordinator({
			id: "a1",
			personalNeedsProfile: { supports: [] },
			settings: overrideTrue,
		} as AssessmentEntity);

		const decision = coord.decideToolPolicy(ITEM_TOOLBAR);
		expect(decision.visibleTools.map((e) => e.toolId)).toContain("calculator");
		expect(decision.diagnostics).toEqual([]);
		expect(coord.decideFeaturePolicy("calculator")).toMatchObject({
			granted: true,
			rule: "test-admin-override",
			precedence: 5,
		});
		expect(warnings("toolOverrides grants")).toHaveLength(0);
	});
});
