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
import {
	createTestToolRegistration,
	createTestToolRegistry,
} from "../fixtures/test-tool-registry.js";

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
			pnpEnforcement: "off",
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

	test("updateInputs emits pnp-enforcement when only pnpEnforcement changes", () => {
		const engine = makeEngine();
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		engine.updateInputs({ pnpEnforcement: "on" });
		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("pnp-enforcement");
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
		expect(() => engine.updateInputs({ pnpEnforcement: "on" })).not.toThrow();
	});

	test("PNP enforcement toggle flips the alwaysAvailable flag", () => {
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
				pnpEnforcement: "off",
			},
		});
		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(false);
		engine.updateInputs({ pnpEnforcement: "on" });
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

	test("updateInputs({ assessment }) re-runs PNP/profile policy on subsequent decide() calls", () => {
		// R3 S3: PR 2 will pump in `assessment` reactively from the
		// toolkit; lock the input-swap path now so PR 2 doesn't silently
		// stop reacting.
		const registry = new ToolRegistry();
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: { tools: ITEM_PLACEMENT, pnpEnforcement: "on" },
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
		expect(
			after.provenance.features
				.get("calculator")
				?.allDecisions.map(({ rule }) => rule),
		).toContain("pnp-support");
	});

	test("an item's registered settings govern its own toolbar and no other", () => {
		const engine = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			inputs: {
				tools: ITEM_PLACEMENT,
				assessment: { id: "a1" } as AssessmentEntity,
				pnpEnforcement: "on",
			},
		});
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));

		const withdraw = engine.registerItemSettings("i2", {
			restrictedTools: ["calculator"],
		});

		expect(events.map((event) => event.reason)).toEqual(["item-settings"]);
		expect(engine.getVisibleToolIds("item", "i2")).toEqual(["tts"]);
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["calculator", "tts"]);

		withdraw();
		expect(events).toHaveLength(2);
		expect(engine.getVisibleToolIds("item", "i2")).toEqual(["calculator", "tts"]);
	});

	test("re-registering equal settings emits nothing, and the newest registration applies", () => {
		// Auto-mode: the item's settings turn enforcement on for its own toolbar.
		const engine = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			inputs: { tools: ITEM_PLACEMENT },
		});
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));

		const first = engine.registerItemSettings("i1", { restrictedTools: ["calculator"] });
		const second = engine.registerItemSettings("i1", { restrictedTools: ["calculator"] });
		expect(events).toHaveLength(1);

		const third = engine.registerItemSettings("i1", { restrictedTools: ["tts"] });
		expect(events).toHaveLength(2);
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["calculator"]);

		third();
		expect(events).toHaveLength(3);
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["tts"]);
		first();
		expect(events).toHaveLength(3);
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["tts"]);
		second();
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["calculator", "tts"]);
	});

	test("updateInputs({ pnpEnforcement: null }) returns to auto-mode", () => {
		const engine = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			inputs: {
				tools: ITEM_PLACEMENT,
				assessment: { id: "a1" } as AssessmentEntity,
				pnpEnforcement: "off",
			},
		});
		engine.registerItemSettings("i1", { restrictedTools: ["calculator"] });
		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["calculator", "tts"]);

		engine.updateInputs({ pnpEnforcement: null });

		expect(engine.getVisibleToolIds("item", "i1")).toEqual(["tts"]);
		expect(engine.getInputs().pnpEnforcement).toBe("off");
	});

	test("updateInputs({ pnpEnforcement: 'off' }) stops applying PNP/profile gates from the next decide()", () => {
		// R3 S4: only the on→on / off→off transitions had explicit
		// coverage. This locks the on→off case so PR 4's default-on
		// flip with `pnpEnforcement: "off"` opt-out cannot regress.
		const registry = new ToolRegistry();
		const assessment: AssessmentEntity = {
			id: "a1",
			personalNeedsProfile: { supports: ["calculator"] },
		} as AssessmentEntity;
		const engine = new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: { tools: ITEM_PLACEMENT, assessment, pnpEnforcement: "on" },
		});

		expect(
			engine.decide({
				level: "item",
				scope: { level: "item", scopeId: "i1" },
			}).visibleTools[0].alwaysAvailable,
		).toBe(true);

		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((e) => events.push(e));
		engine.updateInputs({ pnpEnforcement: "off" });

		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("pnp-enforcement");

		const after = engine.decide({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(after.visibleTools[0].alwaysAvailable).toBe(false);
		expect(
			after.provenance.features
				.get("calculator")
				?.allDecisions.map(({ rule }) => rule),
		).not.toContain("pnp-support");
	});
});

describe("tool parameters", () => {
	const assessment = {
		id: "a1",
		settings: { toolParameters: { calculator: { type: "graphing" } } },
	} as AssessmentEntity;

	function parametersEngine() {
		const engine = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			inputs: {
				tools: normalizeToolsConfig({
					placement: { item: ["calculator"], section: ["calculator"] },
				}),
				assessment,
				pnpEnforcement: "off",
			},
		});
		engine.registerItemSettings("i1", {
			toolParameters: { calculator: { type: "basic" } },
		});
		return engine;
	}

	test("reach a placed tool no grant admits, with enforcement off", () => {
		const decision = parametersEngine().decide({
			level: "section",
			scope: { level: "section", scopeId: "s1" },
		});
		expect(decision.visibleTools[0]).toMatchObject({
			toolId: "calculator",
			parameters: { type: "graphing" },
		});
	});

	test("take the item's entry on the item's own toolbar", () => {
		const engine = parametersEngine();
		const scope = { level: "item", scopeId: "i1" } as const;
		expect(
			engine.decide({ level: "item", scope }).visibleTools[0].parameters,
		).toEqual({ type: "basic" });
		expect(engine.decideFeature("calculator", scope).parameters).toEqual({
			type: "basic",
		});
	});

	test("reach an ungranted feature decision", () => {
		const decision = parametersEngine().decideFeature("calculator");
		expect(decision.granted).toBe(false);
		expect(decision.parameters).toEqual({ type: "graphing" });
	});
});

describe("assessmentExpected", () => {
	test("is true unless the engine is built assessmentOptional", () => {
		expect(makeEngine().getInputs().assessmentExpected).toBe(true);
	});

	test("an assessmentOptional engine expects one only under an `on` override", () => {
		const engine = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			assessmentOptional: true,
		});
		expect(engine.getInputs().assessmentExpected).toBe(false);
		engine.updateInputs({ pnpEnforcement: "on" });
		expect(engine.getInputs().assessmentExpected).toBe(true);
		engine.updateInputs({ pnpEnforcement: "off" });
		expect(engine.getInputs().assessmentExpected).toBe(false);
	});
});

describe("input diagnostics — unknown PNP support id", () => {
	const unknownIds = (engine: ToolPolicyEngine) =>
		engine
			.getInputs()
			.diagnostics.filter((d) => d.code === "tool-policy.unknownSupportId")
			.map((d) => d.toolId);

	function engineFor(
		assessment: AssessmentEntity | null,
		registry: ToolRegistry = createTestToolRegistry(),
	) {
		return new ToolPolicyEngine({
			toolRegistry: registry,
			inputs: { tools: ITEM_PLACEMENT, assessment },
		});
	}

	// A host naming a capability in its own vocabulary rather than by its tool id
	// used to get silence: the id matches nothing in placement, and the
	// capability is simply absent.
	test("a support id no tool is registered under is reported on the inputs", () => {
		const engine = engineFor({
			id: "asm-1",
			personalNeedsProfile: { supports: ["responseMasking"] },
		} as AssessmentEntity);

		const [diagnostic] = engine.getInputs().diagnostics;
		expect(engine.getInputs().diagnostics).toHaveLength(1);
		expect(diagnostic.code).toBe("tool-policy.unknownSupportId");
		expect(diagnostic.toolId).toBe("responseMasking");
		expect(diagnostic.level).toBeUndefined();
		expect(diagnostic.message).toContain("personalNeedsProfile.supports");
		expect(diagnostic.details).toEqual({ origins: ["pnp-support"] });
	});

	test("it is reported whatever the enforcement mode, and on no decision", () => {
		const engine = engineFor({
			id: "asm-1",
			personalNeedsProfile: { supports: ["responseMasking"] },
		} as AssessmentEntity);
		engine.updateInputs({ pnpEnforcement: "off" });
		expect(unknownIds(engine)).toEqual(["responseMasking"]);
		engine.updateInputs({ pnpEnforcement: "on" });
		expect(unknownIds(engine)).toEqual(["responseMasking"]);
		const scope = { level: "item", scopeId: "i1" } as const;
		expect(engine.decide({ level: "item", scope }).diagnostics).toEqual([]);
		expect(engine.decideFeature("responseMasking", scope).diagnostics).toEqual(
			[],
		);
	});

	test("an id in a district list is labelled by that list", () => {
		const engine = engineFor({
			id: "asm-1",
			settings: { districtPolicy: { blockedTools: ["calcualtor"] } },
		} as AssessmentEntity);
		const [diagnostic] = engine.getInputs().diagnostics;
		expect(diagnostic.message).toContain("settings.districtPolicy.blockedTools");
		expect(diagnostic.details).toEqual({ origins: ["district-block"] });
	});

	test("the tool id for the same capability produces none", () => {
		const engine = engineFor({
			id: "asm-1",
			personalNeedsProfile: { supports: ["answerEliminator"] },
		} as AssessmentEntity);
		expect(engine.getInputs().diagnostics).toEqual([]);
	});

	// With nothing registered there is no vocabulary to check against, so every
	// id would be reported.
	test("an empty registry reports nothing", () => {
		const engine = engineFor(
			{
				id: "asm-1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
			new ToolRegistry(),
		);
		expect(engine.getInputs().diagnostics).toEqual([]);
	});

	test("is recomputed when the assessment changes, and the snapshot is shared until then", () => {
		const engine = engineFor(null);
		const before = engine.getInputs().diagnostics;
		expect(before).toEqual([]);
		expect(engine.getInputs().diagnostics).toBe(before);

		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		engine.updateInputs({
			assessment: {
				id: "asm-1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
		});
		expect(events.map((event) => event.reason)).toEqual(["inputs"]);
		expect(events[0].inputs.diagnostics.map((d) => d.toolId)).toEqual([
			"responseMasking",
		]);
		const after = engine.getInputs().diagnostics;
		engine.decide({ level: "item", scope: { level: "item", scopeId: "i1" } });
		expect(engine.getInputs().diagnostics).toBe(after);
	});

	test("an item's settings contribute while registered", () => {
		const engine = engineFor({ id: "asm-1" } as AssessmentEntity);
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));

		const withdraw = engine.registerItemSettings("i1", {
			requiredTools: ["itemTypo"],
		});
		expect(unknownIds(engine)).toEqual(["itemTypo"]);
		expect(events.at(-1)?.inputs.diagnostics.map((d) => d.toolId)).toEqual([
			"itemTypo",
		]);

		withdraw();
		expect(unknownIds(engine)).toEqual([]);
	});

	test("a registration in place clears the id, and withdrawing it reports it again", () => {
		const registry = createTestToolRegistry();
		const engine = engineFor(
			{
				id: "asm-1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
			registry,
		);
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));

		registry.register(
			createTestToolRegistration({
				toolId: "responseMasking",
				supportedLevels: ["item"],
			}),
		);
		expect(unknownIds(engine)).toEqual([]);
		expect(events.map((event) => event.reason)).toEqual(["inputs"]);

		registry.unregister("responseMasking");
		expect(unknownIds(engine)).toEqual(["responseMasking"]);
		expect(events.map((event) => event.reason)).toEqual(["inputs", "inputs"]);
	});

	test("a registry change that leaves the unknown ids alone emits nothing", () => {
		const registry = createTestToolRegistry();
		const engine = engineFor(
			{
				id: "asm-1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
			registry,
		);
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));
		registry.unregister("ruler");
		expect(events).toEqual([]);
	});

	test("a replaced registry is no longer watched", () => {
		const first = createTestToolRegistry();
		const engine = engineFor(
			{
				id: "asm-1",
				personalNeedsProfile: { supports: ["responseMasking"] },
			} as AssessmentEntity,
			first,
		);
		const second = createTestToolRegistry();
		engine.replaceToolRegistry(second, ITEM_PLACEMENT);
		const events: ToolPolicyChangeEvent[] = [];
		engine.onPolicyChange((event) => events.push(event));

		first.register(
			createTestToolRegistration({
				toolId: "responseMasking",
				supportedLevels: ["item"],
			}),
		);
		expect(events).toEqual([]);
		expect(unknownIds(engine)).toEqual(["responseMasking"]);

		second.register(
			createTestToolRegistration({
				toolId: "responseMasking",
				supportedLevels: ["item"],
			}),
		);
		expect(unknownIds(engine)).toEqual([]);
	});

	test("a disposed engine ignores registry changes", () => {
		const registry = createTestToolRegistry();
		const engine = engineFor(null, registry);
		engine.dispose();
		expect(() =>
			registry.register(
				createTestToolRegistration({
					toolId: "responseMasking",
					supportedLevels: ["item"],
				}),
			),
		).not.toThrow();
	});
});
