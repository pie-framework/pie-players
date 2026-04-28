/**
 * ToolPolicyEngine — engine class behavior tests (M8 PR 1).
 *
 * Covers the engine surface that the composition pipeline does not:
 *   - bound inputs + `decide(...)`
 *   - `updateInputs(...)` + `onPolicyChange(...)` event order
 *   - `registerPolicySource(...)` + dispose handle
 *   - `dispose()` makes subsequent calls throw
 *   - subscriber errors do not bubble out
 *   - `getVisibleToolIds(...)` shorthand
 */

import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import type { ToolPolicyChangeEvent } from "../../src/policy/core/ToolPolicyEngine.js";
import type { PolicySource } from "../../src/policy/core/PolicySource.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";
import { normalizeToolsConfig } from "../../src/services/tools-config-normalizer.js";

const ITEM_PLACEMENT = normalizeToolsConfig({
	placement: { item: ["calculator", "tts"] },
});

function makeEngine(extra: Parameters<typeof normalizeToolsConfig>[0] = {}) {
	const registry = new ToolRegistry();
	return new ToolPolicyEngine({
		toolRegistry: registry,
		inputs: {
			tools: normalizeToolsConfig({
				placement: { item: ["calculator", "tts"] },
				...extra,
			}),
			qtiEnforcement: "off",
		},
	});
}

describe("ToolPolicyEngine", () => {
	test("decide() returns visible tools from bound inputs", () => {
		const engine = makeEngine();
		const decision = engine.decide({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual([
			"calculator",
			"tts",
		]);
	});

	test("getVisibleToolIds is a shorthand for decide().visibleTools", () => {
		const engine = makeEngine();
		expect(engine.getVisibleToolIds("item", "i1")).toEqual([
			"calculator",
			"tts",
		]);
	});

	test("updateInputs swaps tools and emits an `inputs` change event", () => {
		const engine = makeEngine();
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		engine.updateInputs({
			tools: normalizeToolsConfig({
				placement: { item: ["graph"] },
			}),
		});
		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("inputs");
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["graph"]);
	});

	test("updateInputs emits qti-enforcement when only qtiEnforcement changes", () => {
		const engine = makeEngine();
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		engine.updateInputs({ qtiEnforcement: "on" });
		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("qti-enforcement");
	});

	test("registerPolicySource adds a custom source and the dispose handle removes it", () => {
		const engine = makeEngine();
		const removeOne: PolicySource = {
			id: "remove-tts",
			refine: ({ candidates }) => ({
				refinedCandidates: candidates.filter((id) => id !== "tts"),
			}),
		};
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		const dispose = engine.registerPolicySource(removeOne);
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["calculator"]);
		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("policy-source-added");
		dispose();
		expect(engine.getVisibleToolIds("item", "i1")).toEqual([
			"calculator",
			"tts",
		]);
		expect(events.at(-1)?.reason).toBe("policy-source-removed");
	});

	test("dispose() emits a final change event and locks down decide()", () => {
		const engine = makeEngine();
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		engine.dispose();
		expect(events.at(-1)?.reason).toBe("disposed");
		expect(() =>
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}),
		).toThrow();
	});

	test("subscriber errors are swallowed (engine never throws on emit)", () => {
		const engine = makeEngine();
		engine.onPolicyChange(() => {
			throw new Error("listener crash");
		});
		expect(() => engine.updateInputs({ qtiEnforcement: "on" })).not.toThrow();
	});

	test("QTI enforcement toggle flips the alwaysAvailable flag", () => {
		const registry = new ToolRegistry();
		const assessment: AssessmentEntity = {
			id: "a1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: {
				tools: ITEM_PLACEMENT,
				assessment,
				qtiEnforcement: "off",
			},
		});
		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(false);
		engine.updateInputs({ qtiEnforcement: "on" });
		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(true);
	});

	test("getInputs() returns a frozen snapshot", () => {
		const engine = makeEngine();
		const snapshot = engine.getInputs();
		expect(Object.isFrozen(snapshot)).toBe(true);
	});

	test("updateInputs({ assessment }) re-runs QTI on subsequent decide() calls", () => {
		// R3 S3: PR 2 will pump in `assessment` reactively from the
		// toolkit; lock the input-swap path now so PR 2 doesn't silently
		// stop reacting.
		const registry = new ToolRegistry();
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: { tools: ITEM_PLACEMENT, qtiEnforcement: "on" },
		});

		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(false);

		engine.updateInputs({
			assessment: {
				id: "a1",
				personalNeedsProfile: { supports: ["calculator"] },
			} as AssessmentEntity,
		});

		const after = engine.decide({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(after.visibleTools[0].alwaysAvailable).toBe(true);
		expect(after.visibleTools[0].sources).toContain("qti.pnp-support");
	});

	test("updateInputs({ currentItemRef }) re-runs item-restriction on subsequent decide() calls", () => {
		// R3 S3 follow-up: per-item navigation will swap currentItemRef.
		const registry = new ToolRegistry();
		const assessment: AssessmentEntity = {
			id: "a1",
		} as AssessmentEntity;
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: {
				tools: ITEM_PLACEMENT,
				assessment,
				qtiEnforcement: "on",
			},
		});

		expect(engine.getVisibleToolIds("item", "i1").includes("calculator")).toBe(
			true,
		);

		engine.updateInputs({
			currentItemRef: {
				identifier: "item-2",
				settings: { restrictedTools: ["calculator"] },
			} as any,
		});

		expect(engine.getVisibleToolIds("item", "i2")).toEqual(["tts"]);
	});

	test("updateInputs({ qtiEnforcement: 'off' }) stops applying QTI from the next decide()", () => {
		// R3 S4: only the on→on / off→off transitions had explicit
		// coverage. This locks the on→off case so PR 4's default-on
		// flip with `qtiEnforcement: "off"` opt-out cannot regress.
		const registry = new ToolRegistry();
		const assessment: AssessmentEntity = {
			id: "a1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: { tools: ITEM_PLACEMENT, assessment, qtiEnforcement: "on" },
		});

		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(true);

		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((e) => events.push(e));
		engine.updateInputs({ qtiEnforcement: "off" });

		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("qti-enforcement");

		const after = engine.decide({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(after.visibleTools[0].alwaysAvailable).toBe(false);
		expect(after.visibleTools[0].sources).not.toContain("qti.pnp-support");
	});
});
