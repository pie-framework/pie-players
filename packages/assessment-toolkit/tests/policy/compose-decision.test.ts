/**
 * Compose-decision pipeline tests (M8 PR 1).
 *
 * Locks in the orchestration order from `m8-design.md` § 3:
 *
 *   1. Membership filter   → entries reflect `tools.placement[level]`
 *   2. Provider veto       → `tools.providers[id].enabled === false`
 *                            removes the tool
 *   3. Host whitelist      → `tools.policy.allowed` (when non-empty)
 *                            removes anything not in the list
 *   4. Host blocklist      → `tools.policy.blocked` removes
 *                            unconditionally
 *   5. QTI gates           → applied only when `enforcement === "on"`
 *                            and an assessment is supplied
 *   6. Custom PolicySources → can only narrow the candidate set;
 *                             attempts to add new IDs are rejected
 *                             with a `tool-policy.placementMissing`
 *                             diagnostic
 *
 * The QTI source's *internal* precedence rules are exercised by
 * `tests/policy/QtiPolicySource.test.ts`; this file only asserts how
 * the engine wires QTI's output into the surrounding pipeline.
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { composeDecision } from "../../src/policy/core/compose-decision.js";
import type { PolicySource } from "../../src/policy/core/PolicySource.js";
import type { ToolPolicyDecisionRequest } from "../../src/policy/core/decision-types.js";
import { QtiPolicySource } from "../../src/policy/sources/QtiPolicySource.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";
import {
	normalizeToolsConfig,
	type CanonicalToolsConfig,
} from "../../src/services/tools-config-normalizer.js";

const baseRequest: ToolPolicyDecisionRequest = {
	level: "item",
	scope: { level: "item", scopeId: "item-1" },
};

function tools(overrides: Partial<CanonicalToolsConfig>): CanonicalToolsConfig {
	return normalizeToolsConfig({
		policy: { allowed: [], blocked: [] },
		placement: { section: [], item: [], passage: [] },
		providers: {},
		...overrides,
	});
}

describe("composeDecision — host-only pipeline", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	test("empty tools config produces empty decision", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools).toEqual([]);
		expect(decision.diagnostics).toEqual([]);
	});

	test("step 1 — placement membership produces entries with `placement` source", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual([
			"calculator",
			"tts",
		]);
		expect(decision.visibleTools[0].sources).toEqual(["placement"]);
		expect(decision.visibleTools[0].required).toBe(false);
		expect(decision.visibleTools[0].alwaysAvailable).toBe(false);
	});

	test("step 2 — provider veto removes tools with enabled === false", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
				providers: { calculator: { enabled: false } },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);
	});

	test("step 2 — `enabled: undefined` is NOT a veto (only explicit false)", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
				providers: { calculator: { settings: {} } },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["calculator"]);
	});

	test("step 3 — host whitelist (when non-empty) narrows to listed IDs", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: ["calculator"], blocked: [] },
				placement: {
					section: [],
					item: ["calculator", "tts", "graph"],
					passage: [],
				},
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["calculator"]);
	});

	test("step 3 — empty whitelist is a no-op (does NOT block everything)", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: [], blocked: [] },
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual([
			"calculator",
			"tts",
		]);
	});

	test("step 4 — host blocklist removes tools unconditionally", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: [], blocked: ["graph"] },
				placement: {
					section: [],
					item: ["calculator", "tts", "graph"],
					passage: [],
				},
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual([
			"calculator",
			"tts",
		]);
	});

	test("step 5 — qtiEnforcement: 'off' skips QTI entirely even when source/assessment present", () => {
		const assessment: AssessmentEntity = {
			id: "asm-1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "off",
			},
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools[0].alwaysAvailable).toBe(false);
		// No QTI provenance entries when enforcement is off.
		expect(
			decision.provenance.decisionLog.some((d) => d.rule === "pnp-support"),
		).toBe(false);
	});

	test("step 5 — PNP support flags surviving entries with alwaysAvailable=true", () => {
		const assessment: AssessmentEntity = {
			id: "asm-1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools[0].toolId).toBe("calculator");
		expect(decision.visibleTools[0].alwaysAvailable).toBe(true);
		expect(decision.visibleTools[0].sources).toEqual([
			"placement",
			"qti.pnp-support",
		]);
	});

	test("step 5 — host blocklist wins over QTI district requirement (qtiRequiredBlocked diagnostic)", () => {
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: {
				districtPolicy: { requiredTools: ["calculator"] },
			},
		} as AssessmentEntity;
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: [], blocked: ["calculator"] },
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);
		expect(decision.diagnostics).toHaveLength(1);
		expect(decision.diagnostics[0]).toMatchObject({
			code: "tool-policy.qtiRequiredBlocked",
			toolId: "calculator",
			level: "item",
			details: {
				rule: "district-requirement",
				hostRule: "host-blocked",
				hostValue: ["calculator"],
			},
		});
	});

	test("step 5 — QTI item restriction removes a host-listed tool", () => {
		const assessment: AssessmentEntity = {
			id: "asm-1",
		} as AssessmentEntity;
		const itemRef = {
			identifier: "item-1",
			settings: { restrictedTools: ["calculator"] },
		} as any;
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				currentItemRef: itemRef,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);
		expect(decision.diagnostics).toEqual([]);
	});

	test("step 6 — custom source narrows the candidate set", () => {
		const oddOnly: PolicySource = {
			id: "even-only",
			refine: ({ candidates }) => ({
				refinedCandidates: candidates.filter((id) => id !== "tts"),
				decisions: [
					{
						rule: "custom-source",
						featureId: "tts",
						action: "block",
						sourceType: "custom",
						reason: "Custom rule removed tts",
					},
				],
			}),
		};
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [oddOnly],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["calculator"]);
		expect(decision.visibleTools[0].sources).toEqual([
			"placement",
			"custom.even-only",
		]);
	});

	test("step 6 — custom source attempting to add IDs is rejected with placementMissing", () => {
		const sneakyAdder: PolicySource = {
			id: "sneaky",
			refine: ({ candidates }) => ({
				refinedCandidates: [...candidates, "ghost-tool"],
			}),
		};
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [sneakyAdder],
			contextId: "test",
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["calculator"]);
		expect(decision.diagnostics).toHaveLength(1);
		expect(decision.diagnostics[0]).toMatchObject({
			code: "tool-policy.placementMissing",
			toolId: "ghost-tool",
			source: "custom.sneaky",
		});
	});

	test("provenance — final state is `enabled` for surviving entries", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("enabled");
	});

	test("provenance — final state is `blocked` for host-blocked entries", () => {
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: [], blocked: ["calculator"] },
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});
		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("blocked");
		expect(trail?.winningDecision?.rule).toBe("host-blocked");
	});
});

describe("composeDecision — provenance reconciliation (M8 PR 1 R2 M1 fix)", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	test("QTI mandate not in placement → finalState='blocked', diagnostic fires", () => {
		// Repro of R2 M1 case A: QTI mandates `calculator` via district
		// `requiredTools`, but the host's placement.item is empty. The
		// pre-fix engine logged a `district-requirement / enable`
		// decision and `provenance.features.get("calculator").finalState`
		// stayed `"enabled"` despite the tool not being visible.
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: {
				districtPolicy: { requiredTools: ["calculator"] },
			},
		} as AssessmentEntity;

		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: [], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});

		expect(decision.visibleTools).toEqual([]);
		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("blocked");
		// The diagnostic still fires — the host did remove the mandated
		// tool, just by omitting it from placement (steps 1-4 collectively).
		expect(decision.diagnostics).toHaveLength(1);
		expect(decision.diagnostics[0]).toMatchObject({
			code: "tool-policy.qtiRequiredBlocked",
			toolId: "calculator",
			details: {
				rule: "district-requirement",
				hostRule: "placement-missing",
				hostValue: [],
			},
		});
	});

	test("R2 S2 — qtiRequiredBlocked.details enriched with hostRule for each host gate", () => {
		// Locks the cross-gate enrichment: every host gate that step 5b
		// can detect must populate `details.hostRule` and `hostValue`
		// distinctly so consumers can render the conflict without
		// re-deriving the gate from `provenance.features`.
		const assessment: AssessmentEntity = {
			id: "asm-1",
			settings: {
				districtPolicy: { requiredTools: ["calculator"] },
			},
		} as AssessmentEntity;

		// Gate 2 — provider-disabled
		const providerDecision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
				providers: { calculator: { enabled: false } },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});
		expect(providerDecision.diagnostics[0]).toMatchObject({
			code: "tool-policy.qtiRequiredBlocked",
			details: {
				rule: "district-requirement",
				hostRule: "provider-disabled",
				hostValue: false,
			},
		});

		// Gate 3 — host-allowlist
		const allowlistDecision = composeDecision({
			request: baseRequest,
			tools: tools({
				policy: { allowed: ["tts"], blocked: [] },
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});
		expect(allowlistDecision.diagnostics[0]).toMatchObject({
			code: "tool-policy.qtiRequiredBlocked",
			details: {
				rule: "district-requirement",
				hostRule: "host-allowlist",
				hostValue: ["tts"],
			},
		});
	});

	test("custom source silent removal → finalState='blocked', auto-logged decision", () => {
		// Repro of R2 M1 case B / R2 S1: a custom PolicySource removes a
		// QTI-PNP-supported tool from the candidate set without emitting
		// a `decisions` entry. The auto-log keeps the trail honest.
		const assessment: AssessmentEntity = {
			id: "asm-1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;

		const silentBlocker: PolicySource = {
			id: "silent-blocker",
			refine: ({ candidates }) => ({
				refinedCandidates: candidates.filter((id) => id !== "calculator"),
			}),
		};

		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [silentBlocker],
			contextId: "test",
		});

		expect(decision.visibleTools).toEqual([]);
		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("blocked");
		const synthesizedBlock = trail?.allDecisions.find(
			(d) => d.rule === "custom-source" && d.action === "block",
		);
		expect(synthesizedBlock).toBeDefined();
		expect(synthesizedBlock?.source.type).toBe("custom");
	});

	test("custom source explicit block → no duplicate auto-log", () => {
		// The auto-log only fires for *silent* removals — sources that
		// already emit a `block` decision must not get a second log.
		const explicitBlocker: PolicySource = {
			id: "explicit-blocker",
			refine: ({ candidates }) => ({
				refinedCandidates: candidates.filter((id) => id !== "calculator"),
				decisions: [
					{
						rule: "custom-source",
						featureId: "calculator",
						action: "block",
						sourceType: "custom",
						reason: "explicit reason",
					},
				],
			}),
		};

		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [explicitBlocker],
			contextId: "test",
		});

		const trail = decision.provenance.features.get("calculator");
		const blockDecisions =
			trail?.allDecisions.filter(
				(d) => d.rule === "custom-source" && d.action === "block",
			) ?? [];
		expect(blockDecisions).toHaveLength(1);
		expect(blockDecisions[0].reason).toBe("explicit reason");
	});

	test("survivor with no logged decisions → trail is `enabled` and dense", () => {
		// `reconcileFinalStates` synthesizes a minimal trail for any
		// surviving id that never collected a decision (this happens
		// when QTI is off and no policy/provider/custom rules touched
		// the tool). Hosts iterating `provenance.features` to find the
		// visible set rely on this density.
		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["pencil"], passage: [] },
			}),
			qti: { source: null, enforcement: "off" },
			customSources: [],
			contextId: "test",
		});

		const trail = decision.provenance.features.get("pencil");
		expect(trail?.finalState).toBe("enabled");
		expect(trail?.featureId).toBe("pencil");
	});

	test("R1 S1 — QTI's own block of a QTI-mandated tool does NOT fire qtiRequiredBlocked", () => {
		// Repro of R1 S1: when two PNP supports map to the same toolId
		// (legitimate case — e.g. "calculator-basic" and
		// "calculator-scientific" both map to "calculator"), QTI can
		// land the same toolId in BOTH `mandatedToolIds` (one support
		// fired item/district `requiredTools` at p=4/5) AND
		// `blockedToolIds` (the other support fired pnp-prohibited at
		// p=6). The host did nothing wrong — QTI's own internal
		// precedence resolved the conflict — so step 5b must not blame
		// the host with a `qtiRequiredBlocked` diagnostic.
		registry.register({
			toolId: "calculator",
			name: "Calculator",
			description: "A calculator",
			icon: "calc",
			supportedLevels: ["item"],
			pnpSupportIds: ["calculator-basic", "calculator-scientific"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
		});

		const assessment: AssessmentEntity = {
			id: "asm-1",
			personalNeedsProfile: {
				supports: ["calculator-basic"],
				prohibitedSupports: ["calculator-basic"],
			},
			settings: {
				districtPolicy: { requiredTools: ["calculator-scientific"] },
			},
		} as AssessmentEntity;

		const decision = composeDecision({
			request: baseRequest,
			tools: tools({
				placement: { section: [], item: ["calculator", "tts"], passage: [] },
			}),
			qti: {
				source: new QtiPolicySource(registry),
				assessment,
				enforcement: "on",
			},
			customSources: [],
			contextId: "test",
		});

		expect(decision.visibleTools.map((e) => e.toolId)).toEqual(["tts"]);
		const qtiBlocked = decision.diagnostics.filter(
			(d) => d.code === "tool-policy.qtiRequiredBlocked",
		);
		expect(qtiBlocked).toEqual([]);
		// The provenance trail still tells the full story.
		const trail = decision.provenance.features.get("calculator");
		expect(trail?.finalState).toBe("blocked");
	});
});
