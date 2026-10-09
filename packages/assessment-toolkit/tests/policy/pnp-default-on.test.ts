/**
 * PNP auto-default — narrow auto-on rule.
 *
 * Locks the rule:
 *
 *   `pnpEnforcement` defaults to `"on"` only when the bound inputs
 *   actually carry profile material. A bare assessment record (just
 *   `id` / `name` / `title`) leaves profile gates disengaged.
 *   Hosts opt out of auto-on by passing
 *   `pnpEnforcement: "off"` explicitly (engine input or
 *   `ToolkitCoordinator.setPnpEnforcement("off")`).
 *
 * Covers four surfaces that share the rule:
 *
 *   1. The pure helpers (`assessmentHasPnpPolicyInputs`,
 *      `itemSettingsHavePnpPolicyInputs`, `resolveDefaultPnpEnforcement`).
 *   2. `ToolPolicyEngine`'s auto-mode, resolved per decision: an item's
 *      settings count only for decisions scoped to that item.
 *   3. `ToolkitCoordinator` via `updateAssessment` / `registerItemSettings`.
 *   4. The interaction with explicit `setPnpEnforcement` overrides.
 */

import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import {
	assessmentHasPnpPolicyInputs,
	itemSettingsHavePnpPolicyInputs,
	resolveDefaultPnpEnforcement,
} from "../../src/policy/core/pnp-policy-inputs.js";
import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";
import { normalizeToolsConfig } from "../../src/services/tools-config-normalizer.js";

function makeEngine(
	inputs: ConstructorParameters<typeof ToolPolicyEngine>[0]["inputs"] = {},
): ToolPolicyEngine {
	return new ToolPolicyEngine({
		toolRegistry: new ToolRegistry(),
		inputs: {
			tools: normalizeToolsConfig({
				placement: { section: ["graph"] },
			}),
			...inputs,
		},
	});
}

function makeCoordinator(
	tools?: ConstructorParameters<typeof ToolkitCoordinator>[0]["tools"],
) {
	return new ToolkitCoordinator({
		assessmentId: "pnp-default-on",
		lazyInit: true,
		tools: tools ?? {
			placement: { section: ["graph"] },
		},
	});
}

describe("assessmentHasPnpPolicyInputs — structural PNP/profile policy material on the assessment", () => {
	test("returns false for null / undefined / bare assessment", () => {
		expect(assessmentHasPnpPolicyInputs(null)).toBe(false);
		expect(assessmentHasPnpPolicyInputs(undefined)).toBe(false);
		expect(assessmentHasPnpPolicyInputs({ id: "a1" } as AssessmentEntity)).toBe(
			false,
		);
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				name: "Bare assessment",
				title: "Bare",
			} as AssessmentEntity),
		).toBe(false);
	});

	test("returns true when the assessment carries any PNP supports", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: { supports: ["graph"] },
			} as AssessmentEntity),
		).toBe(true);
	});

	test("returns true for PNP `prohibitedSupports`", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: {
					supports: [],
					prohibitedSupports: ["calculator"],
				},
			} as AssessmentEntity),
		).toBe(true);
	});

	test("ignores fields policy does not read", () => {
		// Removed from the types; a host still sending them must not switch
		// enforcement on, since no precedence level reads them.
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: { supports: [], activateAtInit: ["graph"] },
				settings: {
					districtPolicy: { policies: { calculator: { mode: "basic" } } },
					testAdministration: {
						mode: "test",
						startDate: "2026-10-08T08:00:00Z",
						endDate: "2026-10-08T10:00:00Z",
					},
				},
			} as never),
		).toBe(false);
	});

	test("ignores empty PNP arrays / empty objects", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: { supports: [] },
				settings: {
					districtPolicy: {
						blockedTools: [],
						requiredTools: [],
					},
					testAdministration: { toolOverrides: {} },
				},
			} as AssessmentEntity),
		).toBe(false);
	});

	test("returns true when district policy blocks or requires tools", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				settings: { districtPolicy: { blockedTools: ["graph"] } },
			} as AssessmentEntity),
		).toBe(true);
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				settings: { districtPolicy: { requiredTools: ["graph"] } },
			} as AssessmentEntity),
		).toBe(true);
	});

	test("returns true when test administration overrides a tool", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				settings: {
					testAdministration: { toolOverrides: { calculator: false } },
				},
			} as AssessmentEntity),
		).toBe(true);
	});
});

describe("itemSettingsHavePnpPolicyInputs — structural PNP/profile policy material in an item's settings", () => {
	test("returns false for null / undefined / empty settings", () => {
		expect(itemSettingsHavePnpPolicyInputs(null)).toBe(false);
		expect(itemSettingsHavePnpPolicyInputs(undefined)).toBe(false);
		expect(itemSettingsHavePnpPolicyInputs({})).toBe(false);
		expect(
			itemSettingsHavePnpPolicyInputs({
				requiredTools: [],
				restrictedTools: [],
				toolParameters: {},
			}),
		).toBe(false);
	});

	test("returns true for non-empty `requiredTools` / `restrictedTools`", () => {
		expect(itemSettingsHavePnpPolicyInputs({ requiredTools: ["graph"] })).toBe(
			true,
		);
		expect(
			itemSettingsHavePnpPolicyInputs({ restrictedTools: ["calculator"] }),
		).toBe(true);
	});

	test("returns false for tool parameters alone", () => {
		expect(
			itemSettingsHavePnpPolicyInputs({
				toolParameters: { calculator: { type: "basic" } },
			}),
		).toBe(false);
	});
});

describe("resolveDefaultPnpEnforcement — precedence", () => {
	test("returns 'off' when neither input carries profile policy material", () => {
		expect(resolveDefaultPnpEnforcement({})).toBe("off");
		expect(
			resolveDefaultPnpEnforcement({
				assessment: { id: "a1" } as AssessmentEntity,
				itemSettings: {},
			}),
		).toBe("off");
	});

	test("returns 'on' when the assessment carries profile policy material", () => {
		expect(
			resolveDefaultPnpEnforcement({
				assessment: {
					id: "a1",
					personalNeedsProfile: { supports: ["graph"] },
				} as AssessmentEntity,
			}),
		).toBe("on");
	});

	test("returns 'on' when only the item's settings carry profile policy material", () => {
		expect(
			resolveDefaultPnpEnforcement({
				assessment: { id: "a1" } as AssessmentEntity,
				itemSettings: { restrictedTools: ["calculator"] },
			}),
		).toBe("on");
	});
});

const ITEM_TOOLS = normalizeToolsConfig({
	placement: { item: ["graph", "calculator"] },
});

const itemRequest = (scopeId: string) =>
	({ level: "item", scope: { level: "item", scopeId } }) as const;

const visibleIds = (decision: { visibleTools: Array<{ toolId: string }> }) =>
	decision.visibleTools.map((entry) => entry.toolId);

describe("ToolPolicyEngine — pnpEnforcement auto-mode", () => {
	test("defaults to 'off' with no inputs", () => {
		const engine = makeEngine();
		expect(engine.getInputs().pnpEnforcement).toBe("off");
	});

	test("defaults to 'off' with a bare assessment (no profile policy material)", () => {
		const engine = makeEngine({ assessment: { id: "a1" } as AssessmentEntity });
		expect(engine.getInputs().pnpEnforcement).toBe("off");
	});

	test("defaults to 'on' when the bound assessment carries PNP supports", () => {
		const engine = makeEngine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["graph"] },
			} as AssessmentEntity,
		});
		expect(engine.getInputs().pnpEnforcement).toBe("on");
	});

	test("an item's settings turn enforcement on for decisions scoped to that item only", () => {
		const engine = makeEngine({ tools: ITEM_TOOLS });
		engine.registerItemSettings("i1", { restrictedTools: ["calculator"] });

		expect(visibleIds(engine.decide(itemRequest("i1")))).toEqual(["graph"]);
		expect(visibleIds(engine.decide(itemRequest("i2")))).toEqual([
			"graph",
			"calculator",
		]);
		expect(engine.getInputs().pnpEnforcement).toBe("off");
	});

	test("explicit pnpEnforcement override wins over the auto-detected default", () => {
		const engine = makeEngine({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["graph"] },
			} as AssessmentEntity,
			pnpEnforcement: "off",
		});
		expect(engine.getInputs().pnpEnforcement).toBe("off");
	});
});

describe("ToolkitCoordinator — auto-mode follows bound profile policy material", () => {
	test("starts at 'off' before any assessment is bound", () => {
		const coord = makeCoordinator();
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");
	});

	test("flips to 'on' when an assessment with PNP supports is bound", () => {
		const coord = makeCoordinator();
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");
	});

	test("a registered item's settings enforce on that item's toolbar", () => {
		const coord = makeCoordinator({
			placement: { item: ["graph", "calculator"] },
		});
		coord.registerItemSettings("i1", { restrictedTools: ["calculator"] });

		expect(visibleIds(coord.decideToolPolicy(itemRequest("i1")))).toEqual([
			"graph",
		]);
		expect(visibleIds(coord.decideToolPolicy(itemRequest("i2")))).toEqual([
			"graph",
			"calculator",
		]);
	});

	test("stays at 'off' when the host explicitly sets pnpEnforcement: 'off' even with profile material bound", () => {
		const coord = makeCoordinator({
			placement: { item: ["graph", "calculator"] },
		});
		coord.setPnpEnforcement("off");
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");

		// An item's settings do not break the override either.
		coord.registerItemSettings("i1", { restrictedTools: ["calculator"] });
		expect(visibleIds(coord.decideToolPolicy(itemRequest("i1")))).toEqual([
			"graph",
			"calculator",
		]);
	});

	test("auto-mode reverts to 'off' when the profile-bearing assessment is unbound", () => {
		const coord = makeCoordinator();
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");

		coord.updateAssessment(null);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");
	});
});
