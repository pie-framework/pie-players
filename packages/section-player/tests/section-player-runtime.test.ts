import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({}));

async function loadRuntimeModule() {
	return import("../src/components/shared/section-player-runtime");
}

describe("resolvePlayerRuntime", () => {
	test("forwards runtime player.loaderConfig into resolved player props", async () => {
		const { resolvePlayerRuntime } = await loadRuntimeModule();
		const instrumentationProvider = {
			providerId: "custom",
			providerName: "Custom",
			initialize: async () => {},
			trackError: () => {},
			trackEvent: () => {},
			destroy: () => {},
			isReady: () => true,
		};
		const loaderConfig = {
			trackPageActions: true,
			instrumentationProvider,
		};

		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					loaderConfig,
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).loaderConfig).toBe(loaderConfig);
		expect(
			(runtime.resolvedPlayerProps as any).loaderConfig.instrumentationProvider,
		).toBe(instrumentationProvider);
	});

	test("merges runtime loaderOptions with strategy defaults", async () => {
		const { resolvePlayerRuntime } = await loadRuntimeModule();
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					loaderOptions: {
						moduleResolution: "import-map",
					},
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).loaderOptions.bundleHost).toBe(
			"https://proxy.pie-api.com/bundles",
		);
		expect((runtime.resolvedPlayerProps as any).loaderOptions.moduleResolution).toBe(
			"import-map",
		);
	});
});

describe("resolveRuntime", () => {
	test("merges top-level player config with runtime.player overrides", async () => {
		const { resolveRuntime } = await loadRuntimeModule();
		const merged = resolveRuntime({
			assessmentId: "a1",
			playerType: "iife",
			player: {
				loaderConfig: {
					trackPageActions: true,
					maxResourceRetries: 2,
				},
				loaderOptions: {
					bundleHost: "https://top-level.example",
				},
			},
			lazyInit: true,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			runtime: {
				toolConfigStrictness: "off",
				player: {
					loaderConfig: {
						resourceRetryDelay: 750,
					},
					loaderOptions: {
						moduleResolution: "import-map",
					},
				},
			},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});

		expect((merged.player as any).loaderConfig.trackPageActions).toBe(true);
		expect((merged.player as any).loaderConfig.maxResourceRetries).toBe(2);
		expect((merged.player as any).loaderConfig.resourceRetryDelay).toBe(750);
		expect((merged.player as any).loaderOptions.bundleHost).toBe(
			"https://top-level.example",
		);
		expect((merged.player as any).loaderOptions.moduleResolution).toBe("import-map");
		expect((merged as any).toolConfigStrictness).toBe("off");
	});
});

describe("resolveToolsConfig", () => {
	test("applies toolbar overlays without validating tool ids", async () => {
		const { resolveToolsConfig } = await loadRuntimeModule();
		const resolved = resolveToolsConfig({
			runtime: {
				toolConfigStrictness: "error",
			},
			tools: null,
			enabledTools: "unknownTool",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect(resolved.placement.section).toEqual(["unknownTool"]);
	});

	test("keeps overlay behavior when runtime is omitted", async () => {
		const { resolveToolsConfig } = await loadRuntimeModule();
		const resolved = resolveToolsConfig({
			runtime: null,
			tools: null,
			enabledTools: "unknownTool",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		// Strict tool-id validation now happens in toolkit coordinator initialization.
		expect(resolved.placement.section).toEqual(["unknownTool"]);
	});

	test("accepts canonical provider key textToSpeech", async () => {
		const { resolveToolsConfig } = await loadRuntimeModule();
		const resolved = resolveToolsConfig({
			runtime: {
				toolConfigStrictness: "error",
			},
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
						layoutMode: "left-aligned",
					},
				},
			},
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((resolved as any).providers.textToSpeech?.enabled).toBe(true);
		expect((resolved as any).providers.textToSpeech?.layoutMode).toBe("left-aligned");
	});
});
