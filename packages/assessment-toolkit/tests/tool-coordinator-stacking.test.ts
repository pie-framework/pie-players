import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ToolCoordinator, ZIndexLayer } from "../src/services/ToolCoordinator";

const zIndexOf = (element: HTMLElement) => Number(element.style.zIndex);

/**
 * A toolbar registers a tool when it activates it, naming no layer, and binds
 * its floating window; the tool's own component registers the same id with its
 * layer and binds an element inside that window.
 */
function openToolbarTool(
	coordinator: ToolCoordinator,
	id: string,
	layer?: ZIndexLayer,
): HTMLElement {
	coordinator.registerTool(id, id);
	if (layer !== undefined) coordinator.registerTool(id, id, undefined, layer);
	coordinator.showTool(id);
	const shell = document.createElement("div");
	document.body.appendChild(shell);
	coordinator.updateToolElement(id, shell);
	return shell;
}

describe("ToolCoordinator stacking", () => {
	beforeAll(() => {
		if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
	});
	afterAll(() => {
		if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
	});

	test("a tool's declared layer replaces the default its toolbar registered it under", () => {
		const coordinator = new ToolCoordinator();
		const shell = openToolbarTool(
			coordinator,
			"ruler:section:s1",
			ZIndexLayer.TOOL,
		);

		expect(coordinator.getToolState("ruler:section:s1")?.layer).toBe(
			ZIndexLayer.TOOL,
		);
		expect(zIndexOf(shell)).toBeGreaterThan(ZIndexLayer.TOOL);
		expect(zIndexOf(shell)).toBeLessThan(ZIndexLayer.MODAL);
	});

	test("a window bound while its tool is shown comes to the front of its layer", () => {
		const coordinator = new ToolCoordinator();
		const first = openToolbarTool(coordinator, "calculator:item:i1");
		const second = openToolbarTool(coordinator, "calculator:item:i2");

		expect(zIndexOf(second)).toBeGreaterThan(zIndexOf(first));

		first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		expect(zIndexOf(first)).toBeGreaterThan(zIndexOf(second));
	});

	test("z-indices stay within the layer however often tools are raised", () => {
		const coordinator = new ToolCoordinator();
		const first = openToolbarTool(coordinator, "calculator:item:i1");
		const second = openToolbarTool(coordinator, "calculator:item:i2");

		for (let i = 0; i < 1500; i++) {
			coordinator.bringToFront(i % 2 === 0 ? first : second);
		}

		expect(zIndexOf(second)).toBe(ZIndexLayer.MODAL + 2);
		expect(zIndexOf(first)).toBe(ZIndexLayer.MODAL + 1);
	});

	test("the outermost element stacks: binding an element inside the bound window keeps the window", () => {
		const coordinator = new ToolCoordinator();
		const shell = openToolbarTool(
			coordinator,
			"protractor:section:s1",
			ZIndexLayer.TOOL,
		);
		const inner = document.createElement("div");
		shell.appendChild(inner);

		coordinator.updateToolElement("protractor:section:s1", inner);

		expect(coordinator.getToolElement("protractor:section:s1")).toBe(shell);
	});

	test("the coordinator leaves display to whoever renders the tool", () => {
		const coordinator = new ToolCoordinator();
		const element = document.createElement("div");
		element.style.display = "flex";
		coordinator.registerTool("lineReader", "Line Reader", element);

		coordinator.showTool("lineReader");
		expect(element.style.display).toBe("flex");
		coordinator.hideTool("lineReader");
		expect(element.style.display).toBe("flex");
		expect(coordinator.isToolVisible("lineReader")).toBe(false);
	});

	test("the toolbar binds each floating window to its tool's registration", () => {
		const source = readFileSync(
			resolve(__dirname, "../src/components/ItemToolBar.svelte"),
			"utf8",
		);
		expect(source).toContain(
			"effectiveToolCoordinator.updateToolElement(instanceToolId, shellEl)",
		);
	});
});
