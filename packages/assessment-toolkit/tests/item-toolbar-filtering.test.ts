import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { ToolCoordinator, ZIndexLayer } from "../src/services/ToolCoordinator.js";
import {
	type ToolbarContext,
	ToolRegistry,
} from "../src/services/ToolRegistry.js";
import {
	loadItemToolbar,
	mountItemToolbar,
	resolvedItem,
	settle,
	toolbarTool,
} from "./fixtures/item-toolbar-harness.js";

// Every `<pie-item-toolbar>` component test lives in this file: the element is
// defined once, in the window registered first, and a later test file
// registers a fresh window without it.

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
await loadItemToolbar();

type Mounted = Awaited<ReturnType<typeof mountItemToolbar>>;
const mounted: Mounted[] = [];

afterEach(async () => {
	for (const toolbar of mounted.splice(0)) await toolbar.remove();
});

afterAll(async () => {
	document.body.replaceChildren();
	await settle();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

/** A registry of the given tools, recording which tool modules it loads. */
function registryWith(tools: Parameters<typeof toolbarTool>[0][]) {
	const registry = new ToolRegistry();
	const loaded: string[] = [];
	for (const spec of tools) registry.register(toolbarTool(spec));
	registry.setToolModuleLoaders(
		Object.fromEntries(
			tools.map(({ toolId }) => [
				toolId,
				async () => {
					loaded.push(toolId);
				},
			]),
		),
	);
	return { registry, loaded };
}

describe("<pie-item-toolbar> three-pass filtering", () => {
	test("renders and loads exactly the tools that survive all three passes", async () => {
		const { registry, loaded } = registryWith([
			{ toolId: "relevant" },
			{ toolId: "unplaced" },
			{ toolId: "sectionOnly", supportedLevels: ["section"] },
			{ toolId: "irrelevant", visible: () => false },
			{ toolId: "grantedIrrelevant", visible: () => false },
			{ toolId: "inapplicable", applicable: () => false },
			{ toolId: "grantedInapplicable", applicable: () => false },
		]);

		const toolbar = await mountItemToolbar({
			registry,
			placed: [
				{ toolId: "relevant" },
				{ toolId: "sectionOnly" },
				{ toolId: "irrelevant" },
				{ toolId: "grantedIrrelevant", required: true },
				{ toolId: "inapplicable" },
				{ toolId: "grantedInapplicable", alwaysAvailable: true },
			],
		});
		mounted.push(toolbar);

		// Pass 1 drops `unplaced`, the level drops `sectionOnly`, pass 2 drops
		// `irrelevant` but not its granted twin, and pass 3 drops both
		// inapplicable tools, granted or not.
		expect(toolbar.buttonLabels().sort()).toEqual([
			"grantedIrrelevant",
			"relevant",
		]);
		expect(loaded.sort()).toEqual(["grantedIrrelevant", "relevant"]);
	});

	test("takes pass 1 from the tools attribute when no coordinator is in scope", async () => {
		const { registry, loaded } = registryWith([
			{ toolId: "listed" },
			{ toolId: "unlisted" },
			{ toolId: "listedIrrelevant", visible: () => false },
		]);

		const toolbar = await mountItemToolbar({
			registry,
			tools: "listed,listedIrrelevant",
		});
		mounted.push(toolbar);

		expect(toolbar.buttonLabels()).toEqual(["listed"]);
		expect(loaded).toEqual(["listed"]);
	});
});

/** A registry with one toolbar tool that hands out its toolbar context. */
function probeRegistry() {
	const registry = new ToolRegistry();
	let toolbarContext: ToolbarContext | null = null;
	const tool = toolbarTool({ toolId: "probe" });
	registry.register({
		...tool,
		renderToolbar: (context, current) => {
			toolbarContext = current;
			return tool.renderToolbar?.(context, current) ?? null;
		},
	});
	registry.setToolModuleLoaders({ probe: async () => {} });
	return {
		registry,
		rendered: () => toolbarContext !== null,
		context: () => {
			if (!toolbarContext) throw new Error("probe did not render");
			return toolbarContext;
		},
	};
}

describe("<pie-item-toolbar> coordinator entries", () => {
	test("seeds a toggled tool on the tool layer and releases it with its scope", async () => {
		const coordinator = new ToolCoordinator();
		const { registry, rendered, context } = probeRegistry();
		const toolbar = await mountItemToolbar({
			registry,
			placed: [{ toolId: "probe" }],
			toolCoordinator: coordinator,
			item: resolvedItem("item-1"),
		});
		mounted.push(toolbar);
		for (let round = 0; round < 20 && !rendered(); round += 1) await settle();

		context().toggleTool("probe");
		const [seeded] = coordinator.getVisibleTools({ baseId: "probe" });
		expect(seeded?.id).toBe("probe:item:item-1");
		expect(seeded?.layer).toBe(ZIndexLayer.TOOL);
		expect(context().isToolVisible("probe")).toBe(true);

		toolbar.toolbar.setAttribute("item-id", "item-2");
		(toolbar.toolbar as HTMLElement & { item: unknown }).item =
			resolvedItem("item-2");
		await settle();
		expect(coordinator.getToolState("probe:item:item-1")).toBeUndefined();
		expect(context().isToolVisible("probe")).toBe(false);

		context().toggleTool("probe");
		expect(coordinator.getToolState("probe:item:item-2")?.isVisible).toBe(true);

		await mounted.splice(0)[0]?.remove();
		expect(coordinator.getVisibleTools({ baseId: "probe" })).toEqual([]);
	});
});
