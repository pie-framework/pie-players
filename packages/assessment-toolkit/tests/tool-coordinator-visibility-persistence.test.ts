import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ToolCoordinator } from "../src/services/ToolCoordinator";

/**
 * Regression coverage for the answer-eliminator "disables on model change" bug.
 *
 * An item re-render (e.g. selecting an answer choice) unmounts and re-mounts the
 * tool overlay element, which unregisters then re-registers the tool. The tool's
 * on/off state must survive that churn so only an explicit toggle turns it off.
 */
describe("ToolCoordinator activation persistence", () => {
	beforeAll(() => {
		if (!GlobalRegistrator.isRegistered) {
			GlobalRegistrator.register();
		}
	});

	afterAll(() => {
		if (GlobalRegistrator.isRegistered) {
			GlobalRegistrator.unregister();
		}
	});

	const TOOL_ID = "answerEliminator::item::i1";

	test("visibility survives unregister/re-register (item re-render)", () => {
		const coordinator = new ToolCoordinator();

		const firstElement = document.createElement("div");
		coordinator.registerTool(TOOL_ID, "Answer Eliminator", firstElement);
		coordinator.showTool(TOOL_ID);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(true);

		// Simulate the re-render: old element goes away...
		coordinator.unregisterTool(TOOL_ID);
		// ...state must still read as "on" during the gap.
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(true);

		// ...new element mounts and re-registers.
		const secondElement = document.createElement("div");
		coordinator.registerTool(TOOL_ID, "Answer Eliminator", secondElement);

		expect(coordinator.isToolVisible(TOOL_ID)).toBe(true);
	});

	test("an explicit toggle still turns the tool off", () => {
		const coordinator = new ToolCoordinator();
		const element = document.createElement("div");
		coordinator.registerTool(TOOL_ID, "Answer Eliminator", element);

		coordinator.toggleTool(TOOL_ID);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(true);

		coordinator.toggleTool(TOOL_ID);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(false);

		// The "off" state persists across a re-render too.
		coordinator.unregisterTool(TOOL_ID);
		const nextElement = document.createElement("div");
		coordinator.registerTool(TOOL_ID, "Answer Eliminator", nextElement);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(false);
	});

	test("releaseTool discards preserved activation state", () => {
		const coordinator = new ToolCoordinator();
		coordinator.registerTool(
			TOOL_ID,
			"Answer Eliminator",
			document.createElement("div"),
		);
		coordinator.showTool(TOOL_ID);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(true);

		coordinator.releaseTool(TOOL_ID);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(false);

		// Re-registering after a genuine release starts fresh (off).
		coordinator.registerTool(
			TOOL_ID,
			"Answer Eliminator",
			document.createElement("div"),
		);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(false);
	});

	test("hiding during the unregister gap holds through re-registration", () => {
		const coordinator = new ToolCoordinator();
		coordinator.registerTool(TOOL_ID, "Answer Eliminator");
		coordinator.showTool(TOOL_ID);
		coordinator.unregisterTool(TOOL_ID);

		coordinator.hideTool(TOOL_ID);
		coordinator.registerTool(
			TOOL_ID,
			"Answer Eliminator",
			document.createElement("div"),
		);
		expect(coordinator.isToolVisible(TOOL_ID)).toBe(false);
	});

	test("getVisibleTools agrees with isToolVisible, gap included", () => {
		const coordinator = new ToolCoordinator();
		coordinator.registerTool("calculator:item:i1", "Calculator");
		coordinator.showTool("calculator:item:i1");
		coordinator.unregisterTool("calculator:item:i1");

		expect(coordinator.isToolVisible("calculator:item:i1")).toBe(true);
		expect(coordinator.getVisibleTools().map((tool) => tool.id)).toEqual([
			"calculator:item:i1",
		]);
	});

	test("a known id takes the name and element of a later registration", () => {
		const coordinator = new ToolCoordinator();
		coordinator.registerTool("ruler:item:i1", "ruler");
		const element = document.createElement("div");
		coordinator.registerTool("ruler:item:i1", "Ruler", element);

		expect(coordinator.getToolState("ruler:item:i1")).toMatchObject({
			name: "Ruler",
			element,
		});
	});

	test("filters by base id, and hides all instances in one notification", () => {
		const coordinator = new ToolCoordinator();
		for (const id of ["calculator:item:i1", "calculator:item:i2", "ruler:item:i1"]) {
			coordinator.registerTool(id, id);
			coordinator.showTool(id);
		}
		expect(
			coordinator.getVisibleTools({ baseId: "calculator" }).map((tool) => tool.id),
		).toEqual(["calculator:item:i1", "calculator:item:i2"]);

		let notifications = 0;
		coordinator.subscribe(() => {
			notifications += 1;
		});
		coordinator.hideAllTools({ baseId: "calculator" });
		expect(notifications).toBe(1);
		expect(coordinator.getVisibleTools().map((tool) => tool.id)).toEqual([
			"ruler:item:i1",
		]);

		coordinator.hideAllTools();
		expect(notifications).toBe(2);
		expect(coordinator.getVisibleTools()).toEqual([]);
	});
});
