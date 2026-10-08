/**
 * An item's settings govern the decisions scoped to that item.
 *
 * They reach the coordinator through the item's registration, as
 * `<pie-item-scope>` dispatches it, and apply to the item's own item-level
 * toolbar. A section- or assessment-level toolbar is the host's section-wide
 * choice: it ignores item settings and reports each tool on it that an item
 * restricts or requires.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { ItemSettings } from "@pie-players/pie-players-shared/types";

import type {
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
} from "../../src/policy/core/decision-types.js";
import { registerContentWithCoordinator } from "../../src/runtime/content-registration.js";
import type { RuntimeRegistrationDetail } from "../../src/runtime/registration-events.js";
import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "../fixtures/test-tool-registry.js";

function makeCoordinator() {
	return new ToolkitCoordinator({
		assessmentId: "item-settings-scope",
		lazyInit: true,
		toolRegistry: createTestToolRegistry(),
		tools: {
			placement: {
				section: ["calculator"],
				item: ["calculator", "lineReader"],
			},
		},
	});
}

/** The registration an item's `<pie-item-scope>` dispatches. */
function itemRegistration(
	itemId: string,
	settings?: ItemSettings,
): RuntimeRegistrationDetail {
	return {
		kind: "item",
		itemId: `rendered-${itemId}`,
		canonicalItemId: itemId,
		contentKind: "assessment-item",
		item: { id: `rendered-${itemId}`, config: { models: [] } },
		element: {} as HTMLElement,
		...(settings ? { settings } : {}),
	};
}

function register(coord: ToolkitCoordinator, detail: RuntimeRegistrationDetail) {
	const cleanups = registerContentWithCoordinator(coord, detail, {
		assessmentId: "a1",
		sectionId: "s1",
	});
	return () => {
		for (const cleanup of cleanups) cleanup();
	};
}

const itemToolbar = (itemId: string): ToolPolicyDecisionRequest => ({
	level: "item",
	scope: {
		level: "item",
		scopeId: itemId,
		itemId: `rendered-${itemId}`,
		canonicalItemId: itemId,
	},
});

const SECTION_TOOLBAR: ToolPolicyDecisionRequest = {
	level: "section",
	scope: { level: "section", scopeId: "s1" },
};

// ItemToolBar at assessment level requests the item bucket under an
// assessment scope.
const ASSESSMENT_TOOLBAR: ToolPolicyDecisionRequest = {
	level: "item",
	scope: { level: "assessment", scopeId: "a1" },
};

const visibleIds = (decision: ToolPolicyDecision) =>
	decision.visibleTools.map((entry) => entry.toolId);

const notApplied = (decision: ToolPolicyDecision) =>
	decision.diagnostics
		.filter((d) => d.code === "tool-policy.itemSettingNotApplied")
		.map((d) => [d.toolId, d.details]);

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

describe("item settings govern their own item's toolbar", () => {
	test("two items on one page each get their own item-toolbar decision", () => {
		const coord = makeCoordinator();
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));
		register(coord, itemRegistration("q2", { requiredTools: ["calculator"] }));

		expect(visibleIds(coord.decideToolPolicy(itemToolbar("q1")))).toEqual([
			"lineReader",
		]);
		const second = coord.decideToolPolicy(itemToolbar("q2"));
		expect(visibleIds(second)).toEqual(["calculator", "lineReader"]);
		expect(
			second.visibleTools.find((entry) => entry.toolId === "calculator")
				?.required,
		).toBe(true);
		expect(visibleIds(coord.decideToolPolicy(itemToolbar("q3")))).toEqual([
			"calculator",
			"lineReader",
		]);
	});

	test("withdrawing the registration withdraws the item's settings", () => {
		const coord = makeCoordinator();
		const withdraw = register(
			coord,
			itemRegistration("q1", { restrictedTools: ["calculator"] }),
		);
		withdraw();

		expect(visibleIds(coord.decideToolPolicy(itemToolbar("q1")))).toEqual([
			"calculator",
			"lineReader",
		]);
	});

	test("a passage registration files no item settings", () => {
		const coord = makeCoordinator();
		register(coord, {
			...itemRegistration("q1", { restrictedTools: ["calculator"] }),
			kind: "passage",
		});

		expect(visibleIds(coord.decideToolPolicy(itemToolbar("q1")))).toEqual([
			"calculator",
			"lineReader",
		]);
	});
});

describe("a shared toolbar ignores item settings", () => {
	test("a restricted tool placed at section level stays visible there and raises the diagnostic", () => {
		const coord = makeCoordinator();
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));
		register(coord, itemRegistration("q2", { requiredTools: ["calculator"] }));

		const decision = coord.decideToolPolicy(SECTION_TOOLBAR);

		expect(visibleIds(decision)).toEqual(["calculator"]);
		expect(decision.visibleTools[0]?.required).toBe(false);
		expect(notApplied(decision)).toEqual([
			[
				"calculator",
				{ itemId: "q1", settings: ["restrictedTools"], toolbarLevel: "section" },
			],
			[
				"calculator",
				{ itemId: "q2", settings: ["requiredTools"], toolbarLevel: "section" },
			],
		]);
		expect(decision.diagnostics[0]?.message).toContain("Place \"calculator\" at item level");
	});

	test("an assessment-level toolbar reports at its own level", () => {
		const coord = makeCoordinator();
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));

		const decision = coord.decideToolPolicy(ASSESSMENT_TOOLBAR);

		expect(visibleIds(decision)).toContain("calculator");
		expect(notApplied(decision)).toEqual([
			[
				"calculator",
				{ itemId: "q1", settings: ["restrictedTools"], toolbarLevel: "assessment" },
			],
		]);
	});

	test("the coordinator warns once per tool and item, however often the toolbar decides", () => {
		const coord = makeCoordinator();
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));
		register(coord, itemRegistration("q2", { restrictedTools: ["calculator"] }));

		coord.decideToolPolicy(SECTION_TOOLBAR);
		coord.decideToolPolicy(SECTION_TOOLBAR);
		coord.decideToolPolicy(ASSESSMENT_TOOLBAR);

		const reported = warn.mock.calls
			.map((call: unknown[]) => String(call[0]))
			.filter((message: string) => message.includes("item settings do not reach"));
		expect(reported).toHaveLength(2);
		expect(reported[0]).toContain('Item "q1"');
		expect(reported[1]).toContain('Item "q2"');
	});

	test("an item the host does not enforce for raises nothing", () => {
		const coord = makeCoordinator();
		coord.setPnpEnforcement("off");
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));

		expect(notApplied(coord.decideToolPolicy(SECTION_TOOLBAR))).toEqual([]);
	});

	test("an item's own toolbar raises nothing", () => {
		const coord = makeCoordinator();
		register(coord, itemRegistration("q1", { restrictedTools: ["calculator"] }));

		expect(notApplied(coord.decideToolPolicy(itemToolbar("q1")))).toEqual([]);
	});
});
