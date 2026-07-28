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
		expect(secondElement.style.display).toBe("");
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
		expect(nextElement.style.display).toBe("none");
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
});
