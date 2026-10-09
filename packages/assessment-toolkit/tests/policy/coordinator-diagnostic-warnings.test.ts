/**
 * The coordinator logs each policy diagnostic once per code and tool, from
 * toolbar and feature decisions alike, so a host sees a misnamed id or an
 * overruled requirement in its console without reading decisions.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "../fixtures/test-tool-registry.js";

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

function makeCoordinator(assessment: AssessmentEntity) {
	const coord = new ToolkitCoordinator({
		assessmentId: "diagnostic-warnings",
		lazyInit: true,
		toolRegistry: createTestToolRegistry(),
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

	test("a feature decision carries and warns an unregistered id", () => {
		const coord = makeCoordinator({
			id: "a1",
			personalNeedsProfile: { supports: ["signLanguag"] },
		} as AssessmentEntity);

		const decision = coord.decideFeaturePolicy("lineReader");
		coord.decideFeaturePolicy("lineReader");

		expect(decision.diagnostics.map((d) => [d.code, d.toolId])).toEqual([
			["tool-policy.unknownSupportId", "signLanguag"],
		]);
		expect(decision.diagnostics[0]?.level).toBeUndefined();
		expect(warnings('"signLanguag"')).toHaveLength(1);
	});
});
