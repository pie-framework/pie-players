/**
 * ToolkitCoordinator ↔ ToolPolicyEngine integration (M8 PR 2 + PR 4).
 *
 * Verifies the additive engine surface introduced in PR 2 and the
 * auto-detection heuristic tightened in PR 4:
 *
 *   - `decideToolPolicy(...)` round-trips through the engine and
 *     stays consistent with `getFloatingTools()` for the section
 *     level under the no-assessment default.
 *   - `onPolicyChange(...)` fires for `updateAssessment`,
 *     `updateCurrentItemRef`, `updateToolConfig`, `updateFloatingTools`,
 *     and `setQtiEnforcement`.
 *   - `qtiEnforcement: "off"` short-circuits the QTI source so a
 *     PNP-supported tool does NOT auto-promote to `alwaysAvailable`.
 *   - The auto-mode heuristic — `qtiEnforcement` defaults to `"off"`
 *     until QTI material is bound (PNP / district policy / test
 *     administration on the assessment, or
 *     `requiredTools` / `restrictedTools` / `toolParameters` on the
 *     item ref). A bare assessment record (just `id` / `name`) keeps
 *     `"off"`. Host overrides via {@link setQtiEnforcement} are
 *     sticky across assessment swaps.
 *   - PR 3 toolbars read decisions through this surface; the legacy
 *     `getFloatingTools()` shim agrees with the engine under the
 *     default (no-QTI) path so no consumer regresses.
 */

import { describe, expect, test } from "bun:test";

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { resolveToolsForLevel } from "../../src/services/tools-config-normalizer.js";
import type { CanonicalToolsConfig } from "../../src/services/tools-config-normalizer.js";
import type {
	PolicySource,
	PolicySourceResult,
	ToolPolicyChangeEvent,
} from "../../src/policy/engine.js";

// Tool ids chosen to satisfy the registry's per-tool `supportedLevels`
// validation. `graph` / `periodicTable` are section-only; `theme` is
// assessment+section; `lineReader` works across section/passage/item.
// `textToSpeech` is item+passage. The default packaged registry
// (`createPackagedToolRegistry`) registers all of these.
function makeCoordinator(extra?: {
	tools?: ConstructorParameters<typeof ToolkitCoordinator>[0]["tools"];
}) {
	return new ToolkitCoordinator({
		assessmentId: "coord-integration",
		lazyInit: true,
		tools: extra?.tools ?? {
			placement: {
				section: ["graph", "theme"],
				item: ["textToSpeech"],
			},
		},
	});
}

describe("ToolkitCoordinator policy-engine integration", () => {
	test("decideToolPolicy returns the section placement and matches getFloatingTools", () => {
		const coord = makeCoordinator();

		const decision = coord.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId: "*" },
		});
		const decisionIds = decision.visibleTools.map((entry) => entry.toolId);

		expect(decisionIds).toEqual(["graph", "theme"]);
		expect(coord.getFloatingTools()).toEqual(decisionIds);
	});

	test("decideToolPolicy honors level scoping (item placement is independent)", () => {
		const coord = makeCoordinator();

		const itemDecision = coord.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: "i1" },
		});
		expect(itemDecision.visibleTools.map((e) => e.toolId)).toEqual([
			"textToSpeech",
		]);
	});

	test("updateToolConfig pushes tools changes into the engine and emits a change event", () => {
		const coord = makeCoordinator();
		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		coord.updateToolConfig("graph", { enabled: false });

		expect(events.length).toBeGreaterThanOrEqual(1);
		expect(events.at(-1)?.reason).toBe("inputs");
		// Provider veto removes the tool from the section decision.
		expect(coord.getFloatingTools()).toEqual(["theme"]);
	});

	test("updateFloatingTools rewrites section placement and emits a change event", () => {
		const coord = makeCoordinator();
		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		coord.updateFloatingTools(["theme"]);

		expect(events.length).toBeGreaterThanOrEqual(1);
		expect(events.at(-1)?.reason).toBe("inputs");
		expect(coord.getFloatingTools()).toEqual(["theme"]);
	});

	test("updateAssessment with PNP supports auto-promotes qtiEnforcement to 'on'", () => {
		const coord = makeCoordinator({
			tools: {
				placement: { section: ["graph"] },
			},
		});
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");

		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		const assessment: AssessmentEntity = {
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity;
		coord.updateAssessment(assessment);

		expect(coord.getPolicyInputs().qtiEnforcement).toBe("on");
		expect(coord.getPolicyInputs().assessment).toBe(assessment);
		expect(events.length).toBeGreaterThanOrEqual(1);
		expect(events.at(-1)?.reason).toBe("inputs");

		const decision = coord.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId: "*" },
		});
		// PNP-supported tool flips alwaysAvailable when QTI is on.
		const graph = decision.visibleTools.find((e) => e.toolId === "graph");
		expect(graph?.alwaysAvailable).toBe(true);
	});

	test("updateAssessment(bare-assessment-no-QTI) keeps auto-mode qtiEnforcement at 'off'", () => {
		// PR 4 narrows the heuristic: a non-null assessment that
		// carries no QTI material (no PNP, no district policy, no
		// test-administration settings) must NOT auto-promote QTI to
		// "on". Hosts that want QTI in that case opt in explicitly via
		// `setQtiEnforcement("on")` or via attribute on the toolkit.
		const coord = makeCoordinator();
		coord.updateAssessment({ id: "a1" } as AssessmentEntity);
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");
	});

	test("updateAssessment(null) keeps qtiEnforcement at 'off' under auto-mode", () => {
		const coord = makeCoordinator();
		// Bind QTI material so auto-mode resolves to "on".
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("on");

		coord.updateAssessment(null);
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");
		expect(coord.getPolicyInputs().assessment).toBeNull();
	});

	test("setQtiEnforcement('off') overrides auto-promotion even when assessment is bound", () => {
		const coord = makeCoordinator({
			tools: { placement: { section: ["graph"] } },
		});
		coord.setQtiEnforcement("off");

		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);

		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");
		const decision = coord.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId: "*" },
		});
		const graph = decision.visibleTools.find((e) => e.toolId === "graph");
		expect(graph?.alwaysAvailable).toBe(false);
	});

	test("setQtiEnforcement('on') opts in even before an assessment is bound", () => {
		const coord = makeCoordinator({
			tools: { placement: { section: ["graph"] } },
		});
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");

		coord.setQtiEnforcement("on");
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("on");
	});

	test("setQtiEnforcement(null) clears the override and re-enters auto-mode", () => {
		const coord = makeCoordinator();
		coord.setQtiEnforcement("on");
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("on");

		// Clear override; no assessment bound → auto-mode gives "off".
		coord.setQtiEnforcement(null);
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");

		// Bind an assessment carrying QTI material → auto-mode gives "on".
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(coord.getPolicyInputs().qtiEnforcement).toBe("on");
	});

	test("updateCurrentItemRef pushes the ref into the engine and emits a change event", () => {
		const coord = makeCoordinator({
			tools: { placement: { item: ["textToSpeech"] } },
		});
		coord.updateAssessment({ id: "a1" } as AssessmentEntity);

		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		const itemRef: AssessmentItemRef = {
			identifier: "item-1",
			settings: { restrictedTools: ["textToSpeech"] },
		};
		coord.updateCurrentItemRef(itemRef);

		expect(events.length).toBeGreaterThanOrEqual(1);
		expect(events.at(-1)?.reason).toBe("inputs");

		const decision = coord.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: "item-1" },
		});
		expect(decision.visibleTools.map((e) => e.toolId)).toEqual([]);
	});

	test("onPolicyChange unsubscribe stops further notifications", () => {
		const coord = makeCoordinator();
		const events: ToolPolicyChangeEvent[] = [];
		const off = coord.onPolicyChange((event) => events.push(event));

		coord.updateFloatingTools(["theme"]);
		const beforeUnsub = events.length;
		expect(beforeUnsub).toBeGreaterThan(0);

		off();
		coord.updateFloatingTools(["graph"]);
		expect(events.length).toBe(beforeUnsub);
	});

	test("getFloatingTools matches legacy resolveToolsForLevel under no-extras default", () => {
		// Under no-assessment, no-override, no-provider-veto config the
		// engine path must equal the legacy `resolveToolsForLevel` path
		// for `placement → policy.allowed → policy.blocked`. This is
		// the contract PR 5 will inherit when the legacy resolver is
		// deleted.
		const tools: CanonicalToolsConfig = {
			placement: { section: ["graph", "theme"] },
			policy: { blocked: ["theme"] },
		} as CanonicalToolsConfig;
		const coord = makeCoordinator({ tools });

		const legacy = resolveToolsForLevel(
			coord["config"].tools as CanonicalToolsConfig,
			"section",
		);
		expect(coord.getFloatingTools()).toEqual(legacy);
		expect(coord.getFloatingTools()).toEqual(["graph"]);
	});

	test("getFloatingTools intentionally diverges from legacy when a provider is disabled (M8 PR 2 contract change)", () => {
		// PR 2 routes `getFloatingTools()` through the engine, which
		// applies provider-veto (Step 2 of `composeDecision`). The
		// legacy `resolveToolsForLevel` did NOT honor provider-veto for
		// floating tools. This is a deliberate, documented contract
		// change — see the docblock on
		// `ToolkitCoordinator.getFloatingTools()`. Lock it down so PR 3
		// reviewers don't reintroduce the legacy semantics by accident.
		const coord = makeCoordinator({
			tools: {
				placement: { section: ["graph", "theme"] },
				providers: { graph: { enabled: false } },
			},
		});

		const legacy = resolveToolsForLevel(
			coord["config"].tools as CanonicalToolsConfig,
			"section",
		);
		expect(legacy).toEqual(["graph", "theme"]); // legacy keeps disabled provider
		expect(coord.getFloatingTools()).toEqual(["theme"]); // engine vetoes it
	});

	test("re-pushing the same input reference is a no-op (no spurious onPolicyChange events)", () => {
		// `ToolPolicyEngine.updateInputs` value-diffs each key with
		// `Object.is`. Re-running `PieAssessmentToolkit.svelte`'s
		// prop-forwarding effect because of an unrelated tracked
		// read must not fan out a new "inputs" event when nothing
		// changed. PR 3 toolbars subscribe via `onPolicyChange`;
		// they rely on this contract to avoid render thrash.
		const assessment = { id: "a1" } as AssessmentEntity;
		const itemRef: AssessmentItemRef = { identifier: "i1" };

		const coord = makeCoordinator();
		coord.updateAssessment(assessment);
		coord.updateCurrentItemRef(itemRef);

		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		coord.updateAssessment(assessment); // same reference
		coord.updateCurrentItemRef(itemRef); // same reference
		coord.setQtiEnforcement(null); // override unchanged

		expect(events).toEqual([]);
	});

	test("setQtiEnforcement runs before updateAssessment in batched effects to avoid transient wrong-state events", () => {
		// PieAssessmentToolkit.svelte applies override → assessment →
		// itemRef in that order. Verify the contract here: when a
		// host configures `assessment={x}` (carrying QTI material) and
		// `qti-enforcement="off"` in one render, the effective mode
		// after the batch is "off" (the override wins). The ordering
		// on the coordinator is what makes this work without a
		// transient "on" emit between assessment-bind and override.
		const coord = makeCoordinator();

		coord.setQtiEnforcement("off");
		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		coord.updateCurrentItemRef(null);

		expect(coord.getPolicyInputs().qtiEnforcement).toBe("off");
	});

	test("subscriber pattern matches the M8 PR 3 toolbar contract: every input mutation reaches a re-read", () => {
		// PR 3's `pie-item-toolbar`, `pie-section-toolbar`,
		// `pie-section-player-base`, and `pie-section-player-tools-pnp-debugger`
		// all wire reactivity through the same shape:
		//
		//   $effect(() => coord.onPolicyChange(() => version += 1));
		//   $derived(() => { void version; return coord.decideToolPolicy(...); });
		//
		// Validate the contract end-to-end: every input mutation
		// (assessment binding, QTI override, custom `PolicySource`
		// registration) must (a) fire `onPolicyChange` and (b) make
		// the next `decideToolPolicy` call reflect the new state.
		// This is the direct unit-test equivalent of mounting the
		// toolbar in happy-dom — the toolbar adds nothing on top of
		// this loop except component-render fanout.
		const coord = makeCoordinator({
			tools: { placement: { section: ["graph", "theme"] } },
		});

		let version = 0;
		coord.onPolicyChange(() => {
			version += 1;
		});
		const readVisible = () =>
			coord
				.decideToolPolicy({
					level: "section",
					scope: { level: "section", scopeId: "*" },
				})
				.visibleTools.map((entry) => entry.toolId);

		expect(version).toBe(0);
		expect(readVisible()).toEqual(["graph", "theme"]);

		coord.updateAssessment({
			id: "a1",
			personalNeedsProfile: { supports: ["graph"] },
		} as AssessmentEntity);
		expect(version).toBeGreaterThan(0);
		const versionAfterAssessment = version;
		const decisionAfterAssessment = coord.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId: "*" },
		});
		expect(
			decisionAfterAssessment.visibleTools.find(
				(entry) => entry.toolId === "graph",
			)?.alwaysAvailable,
		).toBe(true);

		coord.setQtiEnforcement("off");
		expect(version).toBeGreaterThan(versionAfterAssessment);
		const decisionAfterOverride = coord.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId: "*" },
		});
		expect(
			decisionAfterOverride.visibleTools.find(
				(entry) => entry.toolId === "graph",
			)?.alwaysAvailable,
		).toBe(false);

		const versionBeforeSource = version;
		const blockingSource: PolicySource = {
			id: "test-blocker",
			refine: (context): PolicySourceResult => ({
				refinedCandidates: context.candidates.filter((id) => id !== "graph"),
				decisions: [
					{
						rule: "custom-source",
						featureId: "graph",
						action: "block",
						sourceType: "custom",
						reason: "blocker test",
					},
				],
			}),
		};
		const dispose = coord.registerPolicySource(blockingSource);
		expect(version).toBeGreaterThan(versionBeforeSource);
		const decisionAfterSource = readVisible();
		expect(decisionAfterSource).not.toContain("graph");

		const versionBeforeDispose = version;
		dispose();
		expect(version).toBeGreaterThan(versionBeforeDispose);
		expect(readVisible()).toContain("graph");
	});

	test("registerPolicySource delegates to the engine and is observable from decideToolPolicy", () => {
		const coord = makeCoordinator();

		const events: ToolPolicyChangeEvent[] = [];
		coord.onPolicyChange((event) => events.push(event));

		const source: PolicySource = {
			id: "delegation-test",
			refine: (context): PolicySourceResult => ({
				refinedCandidates: context.candidates.filter((id) => id !== "theme"),
				decisions: [
					{
						rule: "custom-source",
						featureId: "theme",
						action: "block",
						sourceType: "custom",
						reason: "scoped block",
					},
				],
			}),
		};

		const dispose = coord.registerPolicySource(source);

		expect(events.at(-1)?.reason).toBe("policy-source-added");
		const beforeDispose = coord
			.decideToolPolicy({
				level: "section",
				scope: { level: "section", scopeId: "*" },
			})
			.visibleTools.map((entry) => entry.toolId);
		expect(beforeDispose).not.toContain("theme");

		dispose();
		expect(events.at(-1)?.reason).toBe("policy-source-removed");
		const afterDispose = coord
			.decideToolPolicy({
				level: "section",
				scope: { level: "section", scopeId: "*" },
			})
			.visibleTools.map((entry) => entry.toolId);
		expect(afterDispose).toContain("theme");

		// Idempotent dispose: calling the returned function twice
		// must not re-fire `policy-source-removed` (the engine
		// guards against duplicate removal).
		const lengthAfterFirstDispose = events.length;
		dispose();
		expect(events.length).toBe(lengthAfterFirstDispose);
	});
});
