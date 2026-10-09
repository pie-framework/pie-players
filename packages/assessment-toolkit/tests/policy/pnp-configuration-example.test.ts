/**
 * The complete example in `docs/PNP_CONFIGURATION.md`, run as written: the
 * tools it says an item's toolbar shows and the diagnostics it says the
 * configuration raises.
 */

import { describe, expect, spyOn, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import type { ToolPolicyDiagnostic } from "../../src/policy/engine.js";
import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "../fixtures/test-tool-registry.js";

const assessment: AssessmentEntity = {
	id: "spring-2024-ela",
	name: "Spring 2024 ELA Assessment",
	personalNeedsProfile: {
		supports: [
			"textToSpeech",
			"magnification",
			"annotationToolbar",
			"lineReader",
			"calculator",
		],
	},
	settings: {
		districtPolicy: {
			blockedTools: ["calculator"],
			requiredTools: ["textToSpeech"],
		},
		testAdministration: { toolOverrides: {} },
	},
} as AssessmentEntity;

describe("PNP_CONFIGURATION.md complete example", () => {
	test("the item toolbar shows annotationToolbar, with the two diagnostics the doc names", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const coordinator = new ToolkitCoordinator({
				assessmentId: "spring-2024-ela",
				lazyInit: true,
				toolRegistry: createTestToolRegistry(),
				tools: {
					placement: {
						item: ["calculator", "textToSpeech", "annotationToolbar"],
						section: ["theme"],
						passage: ["textToSpeech", "lineReader"],
					},
				},
			});
			const reported: ToolPolicyDiagnostic[] = [];
			coordinator.onPolicyDiagnostic((d) => reported.push(d));
			coordinator.updateAssessment(assessment);
			coordinator.registerItemSettings("item-1", {
				restrictedTools: ["textToSpeech"],
			});

			const item = coordinator.decideToolPolicy({
				level: "item",
				scope: { level: "item", scopeId: "item-1" },
			});
			expect(item.visibleTools.map((tool) => tool.toolId)).toEqual([
				"annotationToolbar",
			]);

			// The other levels a section renders. textToSpeech is placed at item and
			// passage level, so the section toolbar leaving it out is no conflict with
			// the district requirement; the passage toolbar serves it, which the item's
			// restriction does not reach.
			coordinator.decideToolPolicy({
				level: "section",
				scope: { level: "section", scopeId: "*" },
			});
			coordinator.decideToolPolicy({
				level: "passage",
				scope: { level: "passage", scopeId: "passage-1" },
			});

			expect(reported.map((d) => [d.code, d.level, d.toolId])).toEqual([
				["tool-policy.unknownSupportId", "item", "magnification"],
				["tool-policy.itemSettingNotApplied", "passage", "textToSpeech"],
			]);
		} finally {
			warn.mockRestore();
		}
	});
});
