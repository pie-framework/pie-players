/**
 * `tool-policy.qtiRequiredBlocked` end-to-end diagnostic (M8 PR 4).
 *
 * `compose-decision.test.ts` already covers the diagnostic at the
 * pipeline layer. PR 4 needs a higher-level test that proves the
 * diagnostic still fires — with full host + QTI provenance — when
 * the engine is driven through `ToolPolicyEngine.decide(...)` and
 * through `ToolkitCoordinator.decideToolPolicy(...)`. PR 3 toolbars
 * read decisions through this surface; this test is the regression
 * net for the host-conflict signal those toolbars surface to the
 * UI.
 *
 * For each host gate (`host-blocked`, `placement-missing`,
 * `provider-disabled`, `host-allowlist`) we assert:
 *
 *   1. The diagnostic fires with `code: "tool-policy.qtiRequiredBlocked"`,
 *      the right `toolId`, and the right `level`.
 *   2. `details` carries the QTI rule (`district-requirement` or
 *      `item-requirement`) and the host gate (`hostRule`, `hostValue`).
 *   3. The provenance trail records both contributors — the QTI
 *      `district-requirement` / `item-requirement` decision and the
 *      host gate decision — so consumers can render the conflict
 *      without re-deriving anything from the host config.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import type { ToolPolicyDiagnostic } from "../../src/policy/core/decision-types.js";
import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";
import {
	normalizeToolsConfig,
	type CanonicalToolsConfig,
} from "../../src/services/tools-config-normalizer.js";

const SECTION_REQUEST = {
	level: "section",
	scope: { level: "section", scopeId: "*" },
} as const;

const ITEM_REQUEST = {
	level: "item",
	scope: { level: "item", scopeId: "i1" },
} as const;

function decideViaEngine(
	tools: CanonicalToolsConfig,
	assessment: AssessmentEntity | null,
	currentItemRef: AssessmentItemRef | null = null,
	level: "section" | "item" = "item",
) {
	const engine = new ToolPolicyEngine({
		toolRegistry: new ToolRegistry(),
		inputs: {
			tools,
			assessment,
			currentItemRef,
			qtiEnforcement: "on",
		},
	});
	return engine.decide(level === "section" ? SECTION_REQUEST : ITEM_REQUEST);
}

function findRequiredBlocked(
	diagnostics: readonly ToolPolicyDiagnostic[],
	toolId: string,
): ToolPolicyDiagnostic | undefined {
	return diagnostics.find(
		(d) => d.code === "tool-policy.qtiRequiredBlocked" && d.toolId === toolId,
	);
}

describe("tool-policy.qtiRequiredBlocked — engine-level (district-requirement)", () => {
	test("host `policy.blocked` collides with district `requiredTools` → diagnostic + provenance from both decisions", () => {
		const tools = normalizeToolsConfig({
			policy: { allowed: [], blocked: ["calculator"] },
			placement: { item: ["calculator", "tts"] },
		});
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity;

		const decision = decideViaEngine(tools, assessment, null, "item");

		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.level).toBe("item");
		expect(diag?.message).toContain("QTI mandates");
		expect(diag?.details).toEqual({
			rule: "district-requirement",
			hostRule: "host-blocked",
			hostValue: ["calculator"],
		});

		const trail = decision.provenance.features.get("calculator");
		expect(trail).toBeDefined();
		const decisions = trail?.allDecisions ?? [];

		// Host contribution: `policy.blocked` removed the tool.
		const hostBlock = decisions.find((d) => d.rule === "host-blocked");
		expect(hostBlock).toBeDefined();
		expect(hostBlock?.action).toBe("block");
		expect(hostBlock?.source.type).toBe("host");

		// QTI contribution: district-requirement mandated the tool.
		// `QtiPolicySource` emits `action: "enable"` on requirement rules
		// (the precedence and `rule` carry the "this is a requirement"
		// signal — `action` describes what the source does, not what
		// the rule type is).
		const districtRequire = decisions.find(
			(d) => d.rule === "district-requirement",
		);
		expect(districtRequire).toBeDefined();
		expect(districtRequire?.action).toBe("enable");
		expect(districtRequire?.source.type).toBe("assessment");

		// Advisory entry the diagnostic is paired with.
		const advisory = decisions.find((d) => d.rule === "qti-required-blocked");
		expect(advisory).toBeDefined();
		expect(advisory?.action).toBe("advisory");
	});

	test("placement-missing collides with district `requiredTools` → `placement-missing` host gate", () => {
		// `calculator` is required by district but never listed in the
		// host's `placement.item` set. Step 5b should still fire and
		// label the gate as `placement-missing`.
		const tools = normalizeToolsConfig({
			placement: { item: ["tts"] },
		});
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity;

		const decision = decideViaEngine(tools, assessment, null, "item");

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.details?.hostRule).toBe("placement-missing");
	});

	test("provider-disabled collides with district `requiredTools` → `provider-disabled` host gate", () => {
		const tools = normalizeToolsConfig({
			placement: { item: ["calculator", "tts"] },
			providers: { calculator: { enabled: false } },
		});
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity;

		const decision = decideViaEngine(tools, assessment, null, "item");

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.details?.hostRule).toBe("provider-disabled");
		expect(diag?.details?.hostValue).toBe(false);
	});

	test("host `policy.allowed` excludes a district-required tool → `host-allowlist` host gate", () => {
		const tools = normalizeToolsConfig({
			policy: { allowed: ["tts"], blocked: [] },
			placement: { item: ["calculator", "tts"] },
		});
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity;

		const decision = decideViaEngine(tools, assessment, null, "item");

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.details?.hostRule).toBe("host-allowlist");
		expect(diag?.details?.hostValue).toEqual(["tts"]);
	});
});

describe("tool-policy.qtiRequiredBlocked — engine-level (item-requirement)", () => {
	test("host `policy.blocked` collides with item `requiredTools` → diagnostic with `rule: item-requirement`", () => {
		const tools = normalizeToolsConfig({
			policy: { allowed: [], blocked: ["calculator"] },
			placement: { item: ["calculator", "tts"] },
		});
		const assessment: AssessmentEntity = { id: "asm-1" } as AssessmentEntity;
		const itemRef: AssessmentItemRef = {
			identifier: "i1",
			settings: { requiredTools: ["calculator"] },
		};

		const decision = decideViaEngine(tools, assessment, itemRef, "item");

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.details).toEqual({
			rule: "item-requirement",
			hostRule: "host-blocked",
			hostValue: ["calculator"],
		});

		const trail = decision.provenance.features.get("calculator");
		const decisions = trail?.allDecisions ?? [];
		expect(
			decisions.some(
				(d) => d.rule === "item-requirement" && d.action === "enable",
			),
		).toBe(true);
		expect(
			decisions.some((d) => d.rule === "host-blocked" && d.action === "block"),
		).toBe(true);
	});
});

describe("tool-policy.qtiRequiredBlocked — coordinator surface (PR 3 toolbar contract)", () => {
	test("`ToolkitCoordinator.decideToolPolicy(...)` propagates the diagnostic and provenance unchanged", () => {
		// PR 3's toolbars read decisions exclusively through the
		// coordinator's `decideToolPolicy`. Re-running the
		// district-required-blocked scenario through the coordinator
		// makes sure the diagnostic and provenance survive the
		// extra layer of indirection.
		//
		// `toolConfigStrictness: "off"` is intentional — the
		// engine-level pipeline is the unit under test, and we want
		// to feed it the same minimal tools shape the engine-level
		// tests use without dragging in tool-registry validation.
		const coord = new ToolkitCoordinator({
			assessmentId: "qti-required-blocked",
			lazyInit: true,
			toolConfigStrictness: "off",
			tools: {
				policy: { allowed: [], blocked: ["calculator"] },
				placement: { item: ["calculator", "tts"] },
			},
		});
		coord.updateAssessment({
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity);

		const decision = coord.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});

		const diag = findRequiredBlocked(decision.diagnostics, "calculator");
		expect(diag).toBeDefined();
		expect(diag?.details).toEqual({
			rule: "district-requirement",
			hostRule: "host-blocked",
			hostValue: ["calculator"],
		});

		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("blocked");
		const ruleNames = (trail?.allDecisions ?? []).map((d) => d.rule);
		expect(ruleNames).toContain("host-blocked");
		expect(ruleNames).toContain("district-requirement");
		expect(ruleNames).toContain("qti-required-blocked");
	});

	test("with `qtiEnforcement: 'off'` the diagnostic does NOT fire (host policy applies but QTI is gated off)", () => {
		const coord = new ToolkitCoordinator({
			assessmentId: "qti-required-blocked-off",
			lazyInit: true,
			toolConfigStrictness: "off",
			tools: {
				policy: { allowed: [], blocked: ["calculator"] },
				placement: { item: ["calculator", "tts"] },
			},
		});
		coord.setQtiEnforcement("off");
		coord.updateAssessment({
			id: "asm-1",
			settings: { districtPolicy: { requiredTools: ["calculator"] } },
		} as AssessmentEntity);

		const decision = coord.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);
		expect(
			decision.diagnostics.find(
				(d) => d.code === "tool-policy.qtiRequiredBlocked",
			),
		).toBeUndefined();
	});
});
