import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";

import { ToolRegistry } from "../src/services/ToolRegistry";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const realSetTimeout = globalThis.setTimeout;
let pendingTimers: Array<() => void> = [];

function captureTimers(): void {
	pendingTimers = [];
	globalThis.setTimeout = ((callback: () => void) => {
		pendingTimers.push(callback);
		return 0;
	}) as unknown as typeof setTimeout;
}

afterEach(() => {
	globalThis.setTimeout = realSetTimeout;
});

function registryMapping(toolId: string, tagName: string): ToolRegistry {
	const registry = new ToolRegistry();
	registry.setComponentOverrides({ toolTagMap: { [toolId]: tagName } });
	return registry;
}

describe("a tool with no module loader", () => {
	test("warns when its element is still undefined after the pending delay", async () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			captureTimers();
			const registry = registryMapping("ruler", "pie-test-undefined-ruler");
			await registry.ensureToolModuleLoaded("ruler");
			await registry.ensureToolModuleLoaded("ruler");
			expect(pendingTimers).toHaveLength(1);

			pendingTimers[0]();
			const messages = warn.mock.calls.map((call) => String(call[0]));
			expect(messages).toHaveLength(1);
			expect(messages[0]).toContain('Tool "ruler" renders <pie-test-undefined-ruler>');
			expect(messages[0]).toContain("toolModuleLoaders");
		} finally {
			warn.mockRestore();
		}
	});

	test("stays quiet when the host defines the element in time", async () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			captureTimers();
			const registry = registryMapping("protractor", "pie-test-late-protractor");
			await registry.ensureToolModuleLoaded("protractor");
			customElements.define("pie-test-late-protractor", class extends HTMLElement {});

			pendingTimers[0]();
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	test("is not watched when a loader or a component factory supplies it", async () => {
		captureTimers();
		const withLoader = registryMapping("graph", "pie-test-loaded-graph");
		withLoader.setToolModuleLoaders({ graph: async () => {} });
		await withLoader.ensureToolModuleLoaded("graph");

		const withFactory = new ToolRegistry();
		withFactory.setComponentOverrides({
			toolTagMap: { lineReader: "pie-test-factory-line-reader" },
			toolComponentFactories: {
				lineReader: () => document.createElement("div"),
			},
		});
		await withFactory.ensureToolModuleLoaded("lineReader");

		expect(pendingTimers).toHaveLength(0);
	});
});
