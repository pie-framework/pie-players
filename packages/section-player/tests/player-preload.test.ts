import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { BundleType } from "@pie-players/pie-players-shared";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

let definedTagsForTest: string[] = [];

function definePreloadedTag(tag: string): void {
	if (!customElements.get(tag)) {
		customElements.define(tag, class extends HTMLElement {});
		definedTagsForTest.push(tag);
	}
}

afterEach(() => {
	// happy-dom does not expose a customElements.unregister API; tags
	// installed by tests stay defined for the lifetime of the suite.
	// Tests that need a clean registry must use unique tag names.
	definedTagsForTest = [];
});

async function loadPlayerPreloadModule() {
	return import("../src/components/shared/player-preload");
}

describe("player-preload: backend config", () => {
	test("iife backend picks clientPlayer bundle by default", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "iife",
			resolvedPlayerProps: {
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
			},
			resolvedPlayerEnv: {},
		});
		expect(backend.kind).toBe("iife");
		if (backend.kind === "iife") {
			expect(backend.bundleHost).toBe("https://proxy.pie-api.com/bundles");
			expect(backend.bundleType).toBe(BundleType.clientPlayer);
		}
	});

	test("iife backend upgrades to player bundle when hosted=true", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "iife",
			resolvedPlayerProps: {
				hosted: true,
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
			},
			resolvedPlayerEnv: {},
		});
		if (backend.kind === "iife") {
			expect(backend.bundleType).toBe(BundleType.player);
		} else {
			throw new Error("expected iife backend");
		}
	});

	test("iife backend uses editor bundle in author mode", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "iife",
			resolvedPlayerProps: {
				mode: "author",
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
			},
			resolvedPlayerEnv: {},
		});
		if (backend.kind === "iife") {
			expect(backend.bundleType).toBe(BundleType.editor);
		} else {
			throw new Error("expected iife backend");
		}
	});

	test("iife backend falls back to iifeBundleHost arg when loaderOptions omit it", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "iife",
			resolvedPlayerProps: {},
			resolvedPlayerEnv: {},
			iifeBundleHost: "https://fallback.example.com/bundles",
		});
		if (backend.kind === "iife") {
			expect(backend.bundleHost).toBe("https://fallback.example.com/bundles");
		} else {
			throw new Error("expected iife backend");
		}
	});

	test("iife backend throws when no bundle host is available", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		expect(() =>
			buildBackendConfigFromProps({
				strategy: "iife",
				resolvedPlayerProps: {},
				resolvedPlayerEnv: {},
			}),
		).toThrow(/iifeBundleHost/);
	});

	test("esm backend reads loaderOptions.esmCdnUrl", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "esm",
			resolvedPlayerProps: {
				loaderOptions: { esmCdnUrl: "https://esm.sh" },
			},
			resolvedPlayerEnv: {},
		});
		expect(backend.kind).toBe("esm");
		if (backend.kind === "esm") {
			expect(backend.cdnBaseUrl).toBe("https://esm.sh");
			expect(backend.moduleResolution).toBe("url");
			expect(backend.view).toBe("delivery");
		}
	});

	test("esm backend honors author env for view", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "esm",
			resolvedPlayerProps: {},
			resolvedPlayerEnv: { mode: "author" },
		});
		if (backend.kind === "esm") {
			expect(backend.view).toBe("author");
		} else {
			throw new Error("expected esm backend");
		}
	});

	test("esm backend honors import-map moduleResolution", async () => {
		const { buildBackendConfigFromProps } = await loadPlayerPreloadModule();
		const backend = buildBackendConfigFromProps({
			strategy: "esm",
			resolvedPlayerProps: {
				loaderOptions: { moduleResolution: "import-map" },
			},
			resolvedPlayerEnv: {},
		});
		if (backend.kind === "esm") {
			expect(backend.moduleResolution).toBe("import-map");
		} else {
			throw new Error("expected esm backend");
		}
	});
});

describe("player-preload: error helpers", () => {
	test("formats stage-based element load errors like item-player", async () => {
		const { formatElementLoadError } = await loadPlayerPreloadModule();
		const message = formatElementLoadError("iife-load", new Error("network down"));
		expect(message).toBe("Error loading elements (iife-load): network down");
	});

	test("describeBundleType returns null for esm and preloaded backends", async () => {
		const { describeBundleType } = await loadPlayerPreloadModule();
		expect(describeBundleType(null)).toBeNull();
		expect(
			describeBundleType({
				kind: "esm",
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			}),
		).toBeNull();
		expect(
			describeBundleType({
				kind: "iife",
				bundleHost: "https://proxy",
				bundleType: BundleType.clientPlayer,
			}),
		).toBe(String(BundleType.clientPlayer));
	});

	test("describeBundleHost returns '' for esm and preloaded backends", async () => {
		const { describeBundleHost } = await loadPlayerPreloadModule();
		expect(describeBundleHost(null)).toBe("");
		expect(
			describeBundleHost({
				kind: "esm",
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			}),
		).toBe("");
		expect(
			describeBundleHost({
				kind: "iife",
				bundleHost: "https://proxy",
			}),
		).toBe("https://proxy");
	});
});

describe("warmupSectionElements", () => {
	test(
		"preloaded strategy with all aggregate tags registered resolves without touching the loader",
		async () => {
			const { warmupSectionElements } = await loadPlayerPreloadModule();
			definePreloadedTag("pie-mc-pa--version-1-0-0");
			await warmupSectionElements({
				strategy: "preloaded",
				renderables: [
					{
						id: "item-1",
						config: {
							markup: '<pie-mc-pa id="m1"></pie-mc-pa>',
							elements: { "pie-mc-pa": "@pie-element/multiple-choice@1.0.0" },
							models: [{ id: "m1", element: "pie-mc-pa" }],
						},
					} as any,
				],
				resolvedPlayerProps: {},
				resolvedPlayerEnv: {},
			});
		},
	);

	test(
		"preloaded strategy with missing aggregate tags throws diagnostic-rich PreloadStageError(stage=preloaded-assert)",
		async () => {
			const { warmupSectionElements, PreloadStageError } =
				await loadPlayerPreloadModule();
			let caught: Error | undefined;
			try {
				await warmupSectionElements({
					strategy: "preloaded",
					renderables: [
						{
							id: "item-1",
							config: {
								markup: '<pie-pa-missing id="m1"></pie-pa-missing>',
								elements: {
									"pie-pa-missing": "@pie-element/missing@1.2.3",
								},
								models: [{ id: "m1", element: "pie-pa-missing" }],
							},
						} as any,
					],
					resolvedPlayerProps: {},
					resolvedPlayerEnv: {},
				});
			} catch (err) {
				caught = err as Error;
			}
			expect(caught).toBeInstanceOf(PreloadStageError);
			if (caught instanceof PreloadStageError) {
				expect(caught.stage).toBe("preloaded-assert");
				const cause = caught.cause as { name?: string; message?: string };
				expect(cause?.name).toBe("ElementAssertionError");
				expect(String(cause?.message)).toContain("pie-pa-missing");
			}
		},
	);

	test("no-op for preloaded strategy with empty renderables", async () => {
		const { warmupSectionElements } = await loadPlayerPreloadModule();
		await warmupSectionElements({
			strategy: "preloaded",
			renderables: [],
			resolvedPlayerProps: {},
			resolvedPlayerEnv: {},
		});
	});

	test("no-op for empty renderables", async () => {
		const { warmupSectionElements } = await loadPlayerPreloadModule();
		await warmupSectionElements({
			strategy: "iife",
			renderables: [],
			resolvedPlayerProps: {
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
			},
			resolvedPlayerEnv: {},
		});
	});

	test("rejects when iife preload is requested without bundle host", async () => {
		const { warmupSectionElements } = await loadPlayerPreloadModule();
		await expect(
			warmupSectionElements({
				strategy: "iife",
				renderables: [
					{
						id: "item-1",
						config: {
							markup: '<pie-x id="m1"></pie-x>',
							elements: { "pie-x": "@pie-element/x@1.0.0" },
							models: [{ id: "m1", element: "pie-x" }],
						},
					} as any,
				],
				resolvedPlayerProps: { loaderOptions: {} },
				resolvedPlayerEnv: {},
				iifeBundleHost: "",
			}),
		).rejects.toThrow(/iifeBundleHost/);
	});

	test("rejects on invalid PIE config contract before touching the loader", async () => {
		const { warmupSectionElements } = await loadPlayerPreloadModule();
		await expect(
			warmupSectionElements({
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
				resolvedPlayerProps: {
					loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
				},
				resolvedPlayerEnv: {},
				iifeBundleHost: "https://proxy.pie-api.com/bundles",
			}),
		).rejects.toThrow(/Invalid PIE config contract|broken-item/);
	});
});
