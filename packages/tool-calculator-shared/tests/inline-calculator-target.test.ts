import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
	ToolCoordinator,
	ToolkitCoordinator,
	ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import {
	canOpenInlineCalculator,
	resolveInlineCalculatorTarget,
	toggleInlineCalculator,
} from "../inline-calculator-target.js";

const itemShell = (itemId: string, canonicalItemId = "") => ({
	kind: "item" as const,
	itemId,
	canonicalItemId,
});

describe("resolveInlineCalculatorTarget", () => {
	test("targets the enclosing item's toolbar", () => {
		expect(
			resolveInlineCalculatorTarget("", itemShell("item-1", "canonical-1")),
		).toEqual({ toolId: "calculator", level: "item", scopeId: "canonical-1" });
		expect(resolveInlineCalculatorTarget("", null)).toBeNull();
	});

	test("reads another toolbar from a scoped target-tool-id", () => {
		expect(
			resolveInlineCalculatorTarget("calculator:section:s1", itemShell("item-1")),
		).toEqual({ toolId: "calculator", level: "section", scopeId: "s1" });
		expect(resolveInlineCalculatorTarget("calculator", itemShell("i"))).toBeNull();
		expect(
			resolveInlineCalculatorTarget("calculator:assessment:a1", itemShell("i")),
		).toBeNull();
	});
});

describe("inline calculator request path", () => {
	const spies: ReturnType<typeof spyOn>[] = [];
	afterEach(() => {
		for (const spy of spies.splice(0)) spy.mockRestore();
	});

	// Two item toolbars, as a section renders them: policy leaves the calculator
	// out of the second item's.
	function setup() {
		for (const method of ["log", "warn"] as const) {
			spies.push(spyOn(console, method).mockImplementation(() => {}));
		}
		const toolkitCoordinator = new ToolkitCoordinator({
			assessmentId: "inline-calculator",
			eagerInit: false,
			toolRegistry: new ToolRegistry(),
		});
		const toolCoordinator = new ToolCoordinator();
		const opened: string[] = [];
		for (const [scopeId, hosted] of [
			["item-1", ["calculator"]],
			["item-2", []],
		] as const) {
			toolkitCoordinator.registerToolRequestTarget({
				level: "item",
				scopeId,
				hostsTool: (toolId) => (hosted as readonly string[]).includes(toolId),
				open: (toolId) => {
					const instanceId = `${toolId}:item:${scopeId}`;
					opened.push(instanceId);
					toolCoordinator.registerTool(instanceId, toolId);
					toolCoordinator.showTool(instanceId);
				},
			});
		}
		return { toolkitCoordinator, toolCoordinator, opened };
	}

	test("is offered only where the item's toolbar renders the calculator", () => {
		const { toolkitCoordinator } = setup();
		const first = resolveInlineCalculatorTarget("", itemShell("item-1"));
		const second = resolveInlineCalculatorTarget("", itemShell("item-2"));
		if (!first || !second) throw new Error("targets did not resolve");

		expect(canOpenInlineCalculator(toolkitCoordinator, first)).toBe(true);
		expect(canOpenInlineCalculator(toolkitCoordinator, second)).toBe(false);
	});

	test("opens through its own item's toolbar and closes the instance it opened", () => {
		const { toolkitCoordinator, toolCoordinator, opened } = setup();
		const first = resolveInlineCalculatorTarget("", itemShell("item-1"));
		const second = resolveInlineCalculatorTarget("", itemShell("item-2"));
		if (!first || !second) throw new Error("targets did not resolve");

		expect(toggleInlineCalculator(toolCoordinator, toolkitCoordinator, second)).toBe(
			"unavailable",
		);
		expect(toggleInlineCalculator(toolCoordinator, toolkitCoordinator, first)).toBe(
			"opened",
		);
		expect(opened).toEqual(["calculator:item:item-1"]);
		expect(toggleInlineCalculator(toolCoordinator, toolkitCoordinator, first)).toBe(
			"closed",
		);
		expect(toolCoordinator.isToolVisible("calculator:item:item-1")).toBe(false);
	});
});
