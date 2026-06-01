/**
 * PNP auto-default — narrow auto-on rule (M8 PR 4).
 *
 * Locks the rule documented in `.cursor/plans/m8-design.md` F2:
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
 *      `itemRefHasPnpPolicyInputs`, `resolveDefaultPnpEnforcement`).
 *   2. `ToolPolicyEngine`'s constructor default for
 *      `pnpEnforcement`.
 *   3. `ToolkitCoordinator.resolveEffectivePnpEnforcement` via
 *      `updateAssessment` / `updateCurrentItemRef`.
 *   4. The interaction with explicit `setPnpEnforcement` overrides.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import {
	assessmentHasPnpPolicyInputs,
	itemRefHasPnpPolicyInputs,
	resolveDefaultPnpEnforcement,
} from "../../src/policy/internal.js";
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
		expect(assessmentHasPnpPolicyInputs({ id: "a1" } as AssessmentEntity)).toBe(false);
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

	test("returns true for PNP `prohibitedSupports` and `activateAtInit`", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: {
					supports: [],
					prohibitedSupports: ["calculator"],
				},
			} as AssessmentEntity),
		).toBe(true);
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				personalNeedsProfile: {
					supports: [],
					activateAtInit: ["graph"],
				},
			} as AssessmentEntity),
		).toBe(true);
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
						policies: {},
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
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				settings: { districtPolicy: { policies: { calculator: { mode: "basic" } } } },
			} as AssessmentEntity),
		).toBe(true);
	});

	test("returns true when test administration carries any populated key", () => {
		expect(
			assessmentHasPnpPolicyInputs({
				id: "a1",
				settings: { testAdministration: { mode: "test" } },
			} as AssessmentEntity),
		).toBe(true);
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

describe("itemRefHasPnpPolicyInputs — structural PNP/profile policy material on the bound item ref", () => {
	test("returns false for null / undefined / bare item ref", () => {
		expect(itemRefHasPnpPolicyInputs(null)).toBe(false);
		expect(itemRefHasPnpPolicyInputs(undefined)).toBe(false);
		expect(
			itemRefHasPnpPolicyInputs({ identifier: "i1" } as AssessmentItemRef),
		).toBe(false);
		expect(
			itemRefHasPnpPolicyInputs({
				identifier: "i1",
				settings: { requiredTools: [], restrictedTools: [], toolParameters: {} },
			} as AssessmentItemRef),
		).toBe(false);
	});

	test("returns true for non-empty `requiredTools` / `restrictedTools` / `toolParameters`", () => {
		expect(
			itemRefHasPnpPolicyInputs({
				identifier: "i1",
				settings: { requiredTools: ["graph"] },
			} as AssessmentItemRef),
		).toBe(true);
		expect(
			itemRefHasPnpPolicyInputs({
				identifier: "i1",
				settings: { restrictedTools: ["calculator"] },
			} as AssessmentItemRef),
		).toBe(true);
		expect(
			itemRefHasPnpPolicyInputs({
				identifier: "i1",
				settings: { toolParameters: { calculator: { mode: "basic" } } },
			} as AssessmentItemRef),
		).toBe(true);
	});
});

describe("resolveDefaultPnpEnforcement — precedence", () => {
	test("returns 'off' when neither input carries profile policy material", () => {
		expect(resolveDefaultPnpEnforcement({})).toBe("off");
		expect(
			resolveDefaultPnpEnforcement({
				assessment: { id: "a1" } as AssessmentEntity,
				currentItemRef: { identifier: "i1" } as AssessmentItemRef,
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

	test("returns 'on' when only the item ref carries profile policy material", () => {
		expect(
			resolveDefaultPnpEnforcement({
				assessment: { id: "a1" } as AssessmentEntity,
				currentItemRef: {
					identifier: "i1",
					settings: { restrictedTools: ["calculator"] },
				} as AssessmentItemRef,
			}),
		).toBe("on");
	});
});

describe("ToolPolicyEngine — pnpEnforcement constructor default", () => {
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

	test("defaults to 'on' when only the bound item ref carries profile policy material", () => {
		const engine = makeEngine({
			currentItemRef: {
				identifier: "i1",
				settings: { restrictedTools: ["calculator"] },
			} as AssessmentItemRef,
		});
		expect(engine.getInputs().pnpEnforcement).toBe("on");
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

describe("ToolkitCoordinator — auto-mode flips on bound profile policy material", () => {
	test("starts at 'off' before any assessment / item ref is bound", () => {
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

	test("flips to 'on' when only the current item ref carries profile policy material", () => {
		const coord = makeCoordinator({
			placement: { item: ["graph", "calculator"] },
		});
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");
		coord.updateCurrentItemRef({
			identifier: "i1",
			settings: { restrictedTools: ["calculator"] },
		} as AssessmentItemRef);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");
	});

	test("stays at 'off' when the host explicitly sets pnpEnforcement: 'off' even with profile material bound", () => {
		const coord = makeCoordinator();
		coord.setPnpEnforcement("off");
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");

		// Item-level profile policy material does not break the override either.
		coord.updateCurrentItemRef({
			identifier: "i1",
			settings: { restrictedTools: ["calculator"] },
		} as AssessmentItemRef);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");
	});

	test("auto-mode reverts to 'off' when the profile-bearing assessment is unbound and the item ref has no profile policy material", () => {
		const coord = makeCoordinator();
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");

		coord.updateAssessment(null);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");

		coord.updateCurrentItemRef({ identifier: "i1" } as AssessmentItemRef);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("off");
	});

	test("auto-mode survives item ref churn when the assessment carries profile policy material", () => {
		const coord = makeCoordinator();
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		coord.updateCurrentItemRef({ identifier: "i1" } as AssessmentItemRef);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");

		coord.updateCurrentItemRef(null);
		expect(coord.getPolicyInputs().pnpEnforcement).toBe("on");
	});
});
