import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { ToolRegistry } from "../src/services/ToolRegistry.js";
import {
	loadItemToolbar,
	mountItemToolbar,
	settle,
	toolbarTool,
} from "./fixtures/item-toolbar-harness.js";

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
