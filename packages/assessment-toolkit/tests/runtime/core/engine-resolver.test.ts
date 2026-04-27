/**
 * Engine resolver tests (M7).
 *
 * Canonical guardrail for the toolkit-side resolver
 * (`runtime/core/engine-resolver.ts`). As of M7 PR 7 the
 * section-player copies (`tests/section-player-runtime.test.ts`) have
 * been narrowed to cover only the player-coupled wrappers
 * (`resolvePlayerRuntime`, `resolveSectionPlayerRuntimeState`); all
 * `resolveRuntime` / `resolveToolsConfig` precedence coverage now
 * lives here.
 *
 * Coverage:
 *   - `resolveRuntime` precedence (per-key M5 mirror) and the player
 *     merge.
 *   - `resolveToolsConfig` overlay behavior.
 *   - `resolveSectionEngineRuntimeState` (the parametrized engine-side
 *     orchestrator) propagates handlers and applies precedence
 *     identically.
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({}));

async function loadEngineResolver() {
	return import("../../../src/runtime/core/engine-resolver.js");
}

describe("engine-resolver: resolveRuntime", () => {
	test("merges top-level player config with runtime.player overrides", async () => {
		const { resolveRuntime } = await loadEngineResolver();
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

describe("engine-resolver: onFrameworkError precedence", () => {
	test("runtime.onFrameworkError takes precedence over the top-level prop", async () => {
		const { resolveRuntime } = await loadEngineResolver();
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
		const { resolveRuntime } = await loadEngineResolver();
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
});

describe("engine-resolver: resolveSectionEngineRuntimeState", () => {
	test("propagates onFrameworkError into effectiveRuntime", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const handler = () => {};
		const stubPlayerRuntime = mock((args: { effectiveRuntime: Record<string, unknown> }) => ({
			tagFromCore: args.effectiveRuntime.playerType ?? "stub",
		}));
		const state = resolveSectionEngineRuntimeState(
			{
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
				toolConfigStrictness: "error",
				onFrameworkError: handler,
				runtime: null,
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: stubPlayerRuntime },
		);
		expect((state.effectiveRuntime as any).onFrameworkError).toBe(handler);
		expect(stubPlayerRuntime).toHaveBeenCalled();
	});

	test("propagates onStageChange into effectiveRuntime (M6 mirror)", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const handler = () => {};
		const state = resolveSectionEngineRuntimeState(
			{
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
				toolConfigStrictness: "error",
				onStageChange: handler,
				runtime: null,
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: () => ({}) },
		);
		expect((state.effectiveRuntime as any).onStageChange).toBe(handler);
	});

	test("propagates onLoadingComplete into effectiveRuntime (M6 mirror)", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const handler = () => {};
		const state = resolveSectionEngineRuntimeState(
			{
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
				toolConfigStrictness: "error",
				onLoadingComplete: handler,
				runtime: null,
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: () => ({}) },
		);
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(handler);
	});

	test("runtime.onStageChange wins over the top-level prop", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionEngineRuntimeState(
			{
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
				toolConfigStrictness: "error",
				onStageChange: fromProp,
				runtime: { onStageChange: fromRuntime },
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: () => ({}) },
		);
		expect((state.effectiveRuntime as any).onStageChange).toBe(fromRuntime);
	});

	test("runtime.onLoadingComplete wins over the top-level prop", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionEngineRuntimeState(
			{
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
				toolConfigStrictness: "error",
				onLoadingComplete: fromProp,
				runtime: { onLoadingComplete: fromRuntime },
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: () => ({}) },
		);
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(fromRuntime);
	});

	test("forwards effectiveRuntime + playerType + env into the injected resolvePlayerRuntime", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const calls: Array<{
			effectiveRuntime: Record<string, unknown>;
			playerType: string;
			env: Record<string, unknown> | null;
		}> = [];
		const stub = (resolverArgs: {
			effectiveRuntime: Record<string, unknown>;
			playerType: string;
			env: Record<string, unknown> | null;
		}) => {
			calls.push(resolverArgs);
			return { ok: true } as const;
		};
		const result = resolveSectionEngineRuntimeState(
			{
				assessmentId: "a1",
				playerType: "esm",
				player: null,
				lazyInit: true,
				tools: null,
				accessibility: null,
				coordinator: null,
				createSectionController: null,
				isolation: "inherit",
				env: { mode: "review" },
				toolConfigStrictness: "error",
				runtime: null,
				enabledTools: "",
				itemToolbarTools: "",
				passageToolbarTools: "",
			},
			{ resolvePlayerRuntime: stub },
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.playerType).toBe("esm");
		expect(calls[0]?.env).toEqual({ mode: "review" });
		expect((result.playerRuntime as any).ok).toBe(true);
	});
});

/**
 * Per-key precedence guardrail (M5 strict mirror, post-trim) — mirror
 * of the section-player suite. The post-trim demoted keys
 * (`policies`, `hooks`, `toolRegistry`, `*HostButtons`,
 * `iifeBundleHost`, `debug`, `contentMaxWidthNoPassage`,
 * `contentMaxWidthWithPassage`, `splitPaneMinRegionWidth`) are
 * deliberately absent — they are layout-shell-only and the runtime
 * tier does not mirror them.
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
	{ key: "onStageChange", runtimeValue: () => {}, topLevelValue: () => {} },
	{ key: "onLoadingComplete", runtimeValue: () => {}, topLevelValue: () => {} },
];

describe("engine-resolver: per-key precedence (M5 mirror)", () => {
	for (const fixture of PER_KEY_FIXTURES) {
		test(`runtime.${fixture.key} wins over top-level \`${fixture.key}\``, async () => {
			const { resolveRuntime } = await loadEngineResolver();
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
			const { resolveRuntime } = await loadEngineResolver();
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

describe("engine-resolver: resolveToolsConfig", () => {
	test("applies toolbar overlays without validating tool ids", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
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
		const { resolveToolsConfig } = await loadEngineResolver();
		const resolved = resolveToolsConfig({
			runtime: null,
			tools: null,
			enabledTools: "unknownTool",
			itemToolbarTools: "",
			passageToolbarTools: "",
		});
		expect(resolved.placement.section).toEqual(["unknownTool"]);
	});

	test("accepts canonical provider key textToSpeech", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
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
