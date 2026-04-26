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

describe("resolveRuntime onFrameworkError precedence", () => {
	test("runtime.onFrameworkError takes precedence over the top-level prop", async () => {
		const { resolveRuntime } = await loadRuntimeModule();
		const topLevel = () => {};
		const fromRuntime = () => {};
		const merged = resolveRuntime({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			runtime: {
				onFrameworkError: fromRuntime,
			},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
			onFrameworkError: topLevel,
		});
		expect((merged as any).onFrameworkError).toBe(fromRuntime);
	});

	test("falls back to top-level onFrameworkError when runtime omits it", async () => {
		const { resolveRuntime } = await loadRuntimeModule();
		const topLevel = () => {};
		const merged = resolveRuntime({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			runtime: {},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
			onFrameworkError: topLevel,
		});
		expect((merged as any).onFrameworkError).toBe(topLevel);
	});

	test("resolveSectionPlayerRuntimeState propagates onFrameworkError into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadRuntimeModule();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			toolRegistry: null,
			toolConfigStrictness: "error",
			onFrameworkError: handler,
			runtime: null,
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((state.effectiveRuntime as any).onFrameworkError).toBe(handler);
	});
});

describe("resolveRuntime onStageChange / onLoadingComplete propagation (M6)", () => {
	test("resolveSectionPlayerRuntimeState propagates onStageChange into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadRuntimeModule();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			toolRegistry: null,
			toolConfigStrictness: "error",
			onStageChange: handler,
			runtime: null,
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(handler);
	});

	test("resolveSectionPlayerRuntimeState propagates onLoadingComplete into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadRuntimeModule();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			toolRegistry: null,
			toolConfigStrictness: "error",
			onLoadingComplete: handler,
			runtime: null,
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(handler);
	});

	test("runtime.onStageChange wins over the top-level prop in resolveSectionPlayerRuntimeState", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadRuntimeModule();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			toolRegistry: null,
			toolConfigStrictness: "error",
			onStageChange: fromProp,
			runtime: { onStageChange: fromRuntime },
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(fromRuntime);
	});

	test("runtime.onLoadingComplete wins over the top-level prop in resolveSectionPlayerRuntimeState", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadRuntimeModule();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			createSectionController: null,
			isolation: "inherit",
			env: null,
			toolRegistry: null,
			toolConfigStrictness: "error",
			onLoadingComplete: fromProp,
			runtime: { onLoadingComplete: fromRuntime },
			enabledTools: "",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(fromRuntime);
	});
});

/**
 * Per-key precedence guardrail (M5 strict mirror rule).
 *
 * For every key in `RuntimeConfig` that flows through `resolveRuntime`'s
 * single-value `pick(...)` slot, prove that `runtime.<key>` wins over the
 * top-level prop. This is the *behavioral* counterpart to the
 * source-parsing test in `m5-mirror-rule.test.ts`.
 *
 * Two-arg picks only — `player` is a merge (not a pick) and `tools` runs
 * through `resolveToolsConfig` first, so they're covered by their own
 * dedicated tests above and below.
 */
const PER_KEY_FIXTURES: ReadonlyArray<{
	key: string;
	runtimeValue: unknown;
	topLevelValue: unknown;
}> = [
	{ key: "assessmentId", runtimeValue: "from-runtime", topLevelValue: "from-prop" },
	{ key: "playerType", runtimeValue: "esm", topLevelValue: "iife" },
	{ key: "lazyInit", runtimeValue: false, topLevelValue: true },
	{ key: "accessibility", runtimeValue: { fontSize: "lg" }, topLevelValue: { fontSize: "sm" } },
	{ key: "coordinator", runtimeValue: { id: "rt" }, topLevelValue: { id: "tp" } },
	{ key: "createSectionController", runtimeValue: () => ({}), topLevelValue: () => ({}) },
	{ key: "isolation", runtimeValue: "shadow", topLevelValue: "inherit" },
	{ key: "env", runtimeValue: { mode: "review" }, topLevelValue: { mode: "gather" } },
	{ key: "toolConfigStrictness", runtimeValue: "off", topLevelValue: "error" },
	{ key: "toolRegistry", runtimeValue: { tools: { foo: {} } }, topLevelValue: { tools: { bar: {} } } },
	{ key: "policies", runtimeValue: { sample: 1 }, topLevelValue: { sample: 2 } },
	{ key: "hooks", runtimeValue: { onItemMount: () => {} }, topLevelValue: { onItemMount: () => {} } },
	{ key: "sectionHostButtons", runtimeValue: [{ id: "rt" }], topLevelValue: [{ id: "tp" }] },
	{ key: "itemHostButtons", runtimeValue: [{ id: "rt" }], topLevelValue: [{ id: "tp" }] },
	{ key: "passageHostButtons", runtimeValue: [{ id: "rt" }], topLevelValue: [{ id: "tp" }] },
	{ key: "iifeBundleHost", runtimeValue: "https://rt.example", topLevelValue: "https://tp.example" },
	{ key: "debug", runtimeValue: "tools", topLevelValue: "all" },
	{ key: "contentMaxWidthNoPassage", runtimeValue: 800, topLevelValue: 1024 },
	{ key: "contentMaxWidthWithPassage", runtimeValue: 1280, topLevelValue: 1440 },
	{ key: "splitPaneMinRegionWidth", runtimeValue: 240, topLevelValue: 320 },
	{ key: "onStageChange", runtimeValue: () => {}, topLevelValue: () => {} },
	{
		key: "onLoadingComplete",
		runtimeValue: () => {},
		topLevelValue: () => {},
	},
];

describe("resolveRuntime per-key precedence (M5 mirror rule)", () => {
	for (const fixture of PER_KEY_FIXTURES) {
		test(`runtime.${fixture.key} wins over top-level \`${fixture.key}\``, async () => {
			const { resolveRuntime } = await loadRuntimeModule();
			const baseArgs: Record<string, unknown> = {
				assessmentId: "a1",
				playerType: "iife",
				player: null,
				lazyInit: true,
				accessibility: null,
				coordinator: null,
				createSectionController: null,
				isolation: "inherit",
				env: null,
				runtime: { [fixture.key]: fixture.runtimeValue },
				effectiveToolsConfig: {},
				toolConfigStrictness: "error",
			};
			baseArgs[fixture.key] = fixture.topLevelValue;
			const merged = resolveRuntime(baseArgs as never);
			expect((merged as Record<string, unknown>)[fixture.key]).toBe(
				fixture.runtimeValue as never,
			);
		});

		test(`runtime falls back to top-level \`${fixture.key}\` when omitted`, async () => {
			const { resolveRuntime } = await loadRuntimeModule();
			const baseArgs: Record<string, unknown> = {
				assessmentId: "a1",
				playerType: "iife",
				player: null,
				lazyInit: true,
				accessibility: null,
				coordinator: null,
				createSectionController: null,
				isolation: "inherit",
				env: null,
				runtime: {},
				effectiveToolsConfig: {},
				toolConfigStrictness: "error",
			};
			baseArgs[fixture.key] = fixture.topLevelValue;
			const merged = resolveRuntime(baseArgs as never);
			expect((merged as Record<string, unknown>)[fixture.key]).toBe(
				fixture.topLevelValue as never,
			);
		});
	}
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
