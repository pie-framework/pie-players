import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
	isWorkspacePackageDistJavaScript,
	workspaceDistFullReload,
} from "../vite-plugins/workspace-dist-full-reload";

const packagesRoot = path.resolve(import.meta.dir, "../../../packages");

describe("section demo workspace dist HMR", () => {
	test("recognizes built package JavaScript only", () => {
		expect(
			isWorkspacePackageDistJavaScript(
				path.join(packagesRoot, "section-player/dist/pie-section-player.js"),
				packagesRoot,
			),
		).toBe(true);
		expect(
			isWorkspacePackageDistJavaScript(
				path.join(packagesRoot, "section-player/src/pie-section-player.ts"),
				packagesRoot,
			),
		).toBe(false);
		expect(
			isWorkspacePackageDistJavaScript(
				path.join(packagesRoot, "theme/dist/components.css"),
				packagesRoot,
			),
		).toBe(false);
	});

	test("coalesces rapid bundle changes into one full reload", async () => {
		const plugin = workspaceDistFullReload(packagesRoot, 5);
		const hotUpdate = plugin.hotUpdate;
		if (typeof hotUpdate !== "function") {
			throw new Error("Expected a hotUpdate hook");
		}

		const changedModule = { id: "pie-section-player" };
		const changedChunk = { id: "pie-section-player-chunk" };
		const invalidated: unknown[] = [];
		const messages: unknown[] = [];
		const pluginContext = {
			environment: {
				name: "client",
				moduleGraph: {
					invalidateModule: (module: unknown) => invalidated.push(module),
				},
				hot: {
					send: (message: unknown) => messages.push(message),
				},
			},
		} as never;
		const firstResult = hotUpdate.call(pluginContext, {
			type: "update",
			file: path.join(
				packagesRoot,
				"section-player/dist/pie-section-player.js",
			),
			modules: [changedModule],
			timestamp: 123,
		} as never);
		const secondResult = hotUpdate.call(pluginContext, {
			type: "create",
			file: path.join(packagesRoot, "section-player/dist/chunks/layout.js"),
			modules: [changedChunk],
			timestamp: 124,
		} as never);

		expect(firstResult).toEqual([]);
		expect(secondResult).toEqual([]);
		expect(invalidated).toEqual([changedModule, changedChunk]);
		expect(messages).toEqual([]);
		await Bun.sleep(20);
		expect(messages).toEqual([{ type: "full-reload", path: "*" }]);
	});
});
