/**
 * A toolbar re-decides on every policy change but re-renders its tools only
 * when what it renders from changed. An item's settings registering re-decides
 * the section toolbar, for its diagnostics, and must keep its rendered tools:
 * rendering swaps in fresh elements, which would drop a section tool's state
 * whenever an item with settings mounts.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolPolicyChangeEvent } from "../src/policy/core/ToolPolicyEngine.js";
import type { ToolPolicyDecisionRequest } from "../src/policy/core/decision-types.js";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { createDecidedToolsTracker } from "../src/services/toolbar-decided-tools.js";
import { createTestToolRegistry } from "./fixtures/test-tool-registry.js";

const SECTION_TOOLBAR: ToolPolicyDecisionRequest = {
	level: "section",
	scope: { level: "section", scopeId: "s1" },
};
const Q1_TOOLBAR: ToolPolicyDecisionRequest = {
	level: "item",
	scope: { level: "item", scopeId: "q1", canonicalItemId: "q1" },
};

/** A toolbar's two counters, bumped the way `<pie-item-toolbar>` bumps them. */
function followPolicy(coordinator: ToolkitCoordinator) {
	const versions = { decide: 0, render: 0 };
	coordinator.onPolicyChange((event: ToolPolicyChangeEvent) => {
		versions.decide += 1;
		if (event.reason !== "item-settings") versions.render += 1;
	});
	return versions;
}

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

function makeCoordinator() {
	return new ToolkitCoordinator({
		assessmentId: "a1",
		lazyInit: true,
		toolRegistry: createTestToolRegistry(),
		tools: {
			placement: { section: ["calculator"], item: ["calculator", "lineReader"] },
		},
	});
}

describe("a toolbar's decided tools", () => {
	test("an item's settings registering keeps the section toolbar's tools and still re-decides it", () => {
		const coordinator = makeCoordinator();
		const versions = followPolicy(coordinator);
		const track = createDecidedToolsTracker();
		const before = track(coordinator.decideToolPolicy(SECTION_TOOLBAR), versions.render);

		coordinator.registerItemSettings("q1", { restrictedTools: ["calculator"] });
		const decision = coordinator.decideToolPolicy(SECTION_TOOLBAR);

		expect(versions.decide).toBe(1);
		expect(track(decision, versions.render)).toBe(before);
		expect(
			decision.diagnostics.map((diagnostic) => diagnostic.code),
		).toContain("tool-policy.itemSettingNotApplied");
	});

	test("the item's own toolbar gets a new list when its tools change", () => {
		const coordinator = makeCoordinator();
		const versions = followPolicy(coordinator);
		const track = createDecidedToolsTracker();
		const before = track(coordinator.decideToolPolicy(Q1_TOOLBAR), versions.render);

		coordinator.registerItemSettings("q1", { restrictedTools: ["calculator"] });
		const after = track(coordinator.decideToolPolicy(Q1_TOOLBAR), versions.render);

		expect(after).not.toBe(before);
		expect(after?.map((tool) => tool.toolId)).toEqual(["lineReader"]);
	});

	test("any other policy change re-renders, even with the same tools", () => {
		const coordinator = makeCoordinator();
		const versions = followPolicy(coordinator);
		const track = createDecidedToolsTracker();
		const before = track(coordinator.decideToolPolicy(SECTION_TOOLBAR), versions.render);

		coordinator.setPnpEnforcement("on");
		const after = track(coordinator.decideToolPolicy(SECTION_TOOLBAR), versions.render);

		expect(after).toEqual(before);
		expect(after).not.toBe(before);
	});

	test("<pie-item-toolbar> renders from the tracked tools and skips item-settings changes for rendering", () => {
		const source = readFileSync(
			resolve(__dirname, "../src/components/ItemToolBar.svelte"),
			"utf8",
		);
		expect(source).toContain(
			"if (event?.reason !== 'item-settings') toolRenderVersion += 1;",
		);
		expect(source).toContain(
			"const decidedTools = $derived(trackDecidedTools(policyDecision, toolRenderVersion));",
		);
		expect(source).not.toContain("policyDecision.visibleTools");
	});
});
