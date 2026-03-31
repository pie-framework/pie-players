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

describe("player-preload retry behavior", () => {
	test("formats stage-based element load errors like item-player", async () => {
		const { formatElementLoadError } = await loadPlayerPreloadModule();
		const message = formatElementLoadError("iife-load", new Error("network down"));
		expect(message).toBe("Error loading elements (iife-load): network down");
	});

	test("retries bounded preload attempts before succeeding", async () => {
		const { preloadPlayerElementsWithRetry } = await loadPlayerPreloadModule();
		let attempts = 0;
		await preloadPlayerElementsWithRetry({
			componentTag: "pie-test",
			strategy: "iife",
			renderables: [{ config: { elements: {} } } as any],
			iifeBundleType: BundleType.clientPlayer,
			loaderView: "delivery",
			esmCdnUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "url",
			bundleHost: "https://proxy.pie-api.com/bundles",
			retryCount: 1,
			retryDelayMs: 0,
			logger: {
				warn: () => undefined,
			} as any,
			loadOnce: async () => {
				attempts += 1;
				if (attempts < 2) {
					throw new Error("first attempt failed");
				}
			},
		});
		expect(attempts).toBe(2);
	});

	test("throws item-player style error when retries are exhausted", async () => {
		const { preloadPlayerElementsWithRetry } = await loadPlayerPreloadModule();
		await expect(
			preloadPlayerElementsWithRetry({
				componentTag: "pie-test",
				strategy: "iife",
				renderables: [{ config: { elements: {} } } as any],
				iifeBundleType: BundleType.clientPlayer,
				loaderView: "delivery",
				esmCdnUrl: "https://cdn.jsdelivr.net/npm",
				moduleResolution: "url",
				bundleHost: "https://proxy.pie-api.com/bundles",
				retryCount: 1,
				retryDelayMs: 0,
				logger: {
					warn: () => undefined,
				} as any,
				loadOnce: async () => {
					throw new Error("still failing");
				},
			}),
		).rejects.toThrow("Error loading elements (iife-load-retry): still failing");
	});

	test("emits retry and final error details for instrumentation hooks", async () => {
		const { preloadPlayerElementsWithRetry } = await loadPlayerPreloadModule();
		const retryEvents: Array<Record<string, unknown>> = [];
		const finalErrors: Array<Record<string, unknown>> = [];
		await expect(
			preloadPlayerElementsWithRetry({
				componentTag: "pie-test",
				strategy: "iife",
				renderables: [{ config: { elements: {} } } as any],
				iifeBundleType: BundleType.clientPlayer,
				loaderView: "delivery",
				esmCdnUrl: "https://cdn.jsdelivr.net/npm",
				moduleResolution: "url",
				bundleHost: "https://proxy.pie-api.com/bundles",
				retryCount: 1,
				retryDelayMs: 0,
				logger: {
					warn: () => undefined,
				} as any,
				onRetry: (detail) => retryEvents.push(detail as Record<string, unknown>),
				onFinalError: (detail) =>
					finalErrors.push(detail as Record<string, unknown>),
				loadOnce: async () => {
					throw new Error("still failing");
				},
			}),
		).rejects.toThrow();

		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0]?.componentTag).toBe("pie-test");
		expect(retryEvents[0]?.stage).toBe("iife-load");
		expect(retryEvents[0]?.attempt).toBe(1);
		expect(finalErrors).toHaveLength(1);
		expect(finalErrors[0]?.componentTag).toBe("pie-test");
		expect(finalErrors[0]?.stage).toBe("iife-load-retry");
		expect(finalErrors[0]?.error).toBe("still failing");
	});

	test("keeps elements gated when iife preload is requested without bundle host", async () => {
		const { orchestratePlayerElementPreload } = await loadPlayerPreloadModule();
		const state = {
			lastPreloadSignature: "",
			preloadRunToken: 0,
			elementsLoaded: false,
		};
		orchestratePlayerElementPreload({
			componentTag: "pie-test",
			strategy: "iife",
			renderables: [{ config: { elements: { "pie-x": "@pie-element/x@1.0.0" } } } as any],
			renderablesSignature: "sig-1",
			resolvedPlayerProps: {
				loaderOptions: {},
			},
			resolvedPlayerEnv: {},
			iifeBundleHost: "",
			getState: () => state,
			setState: (next) => Object.assign(state, next),
		});

		expect(state.elementsLoaded).toBe(false);
		expect(state.preloadRunToken).toBe(1);
	});

	test("emits preload error and keeps gated on invalid PIE contract", async () => {
		const { orchestratePlayerElementPreload } = await loadPlayerPreloadModule();
		const state = {
			lastPreloadSignature: "",
			preloadRunToken: 0,
			elementsLoaded: false,
		};
		const preloadErrors: Array<Record<string, unknown>> = [];
		orchestratePlayerElementPreload({
			componentTag: "pie-test",
			strategy: "iife",
			renderables: [
				{
					id: "broken-item",
					config: {
						markup: '<pie-mc id="m1"></pie-mc>',
						elements: { "pie-mc": "@pie-element/multiple-choice@1.0.0" },
						models: [{ id: "m1", element: "pie-missing" }],
					},
				} as any,
			],
			renderablesSignature: "sig-invalid",
			resolvedPlayerProps: {
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
			},
			resolvedPlayerEnv: {},
			iifeBundleHost: "https://proxy.pie-api.com/bundles",
			getState: () => state,
			setState: (next) => Object.assign(state, next),
			onPreloadError: (detail) => preloadErrors.push(detail as Record<string, unknown>),
		});

		expect(state.elementsLoaded).toBe(false);
		expect(preloadErrors).toHaveLength(1);
		expect(preloadErrors[0]?.stage).toBe("validate-config");
		expect(String(preloadErrors[0]?.error || "")).toContain(
			"Invalid PIE config contract",
		);
	});
});
