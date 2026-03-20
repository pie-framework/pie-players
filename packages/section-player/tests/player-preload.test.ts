import { describe, expect, mock, test } from "bun:test";
import { BundleType } from "@pie-players/pie-players-shared";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

async function loadPlayerPreloadModule() {
	return import("../src/components/shared/player-preload");
}

describe("player-preload signatures", () => {
	test("renderables signature changes when element map changes", async () => {
		const { getRenderablesSignature } = await loadPlayerPreloadModule();
		const renderablesBase = [
			{
				entity: {
					id: "item-1",
					version: "1",
					config: {
						elements: {
							"pie-multiple-choice": "@pie-element/multiple-choice@1.0.0",
						},
					},
				},
			},
		];
		const renderablesUpdated = [
			{
				entity: {
					id: "item-1",
					version: "1",
					config: {
						elements: {
							"pie-multiple-choice": "@pie-element/multiple-choice@2.0.0",
						},
					},
				},
			},
		];

		const baseSignature = getRenderablesSignature(renderablesBase);
		const updatedSignature = getRenderablesSignature(renderablesUpdated);

		expect(baseSignature).not.toBe(updatedSignature);
	});

	test("preload signature differs for iife bundle types", async () => {
		const { buildPreloadSignature } = await loadPlayerPreloadModule();
		const baseArgs = {
			strategy: "iife",
			loaderView: "delivery",
			esmCdnUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "url" as const,
			bundleHost: "https://proxy.pie-api.com/bundles",
			renderablesSignature: "renderables:v1",
		};

		const clientPlayerSignature = buildPreloadSignature({
			...baseArgs,
			iifeBundleType: BundleType.clientPlayer,
		});
		const playerSignature = buildPreloadSignature({
			...baseArgs,
			iifeBundleType: BundleType.player,
		});

		expect(clientPlayerSignature).not.toBe(playerSignature);
	});
});
