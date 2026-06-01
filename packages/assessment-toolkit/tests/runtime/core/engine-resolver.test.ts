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
 *   - `resolveRuntime` runtime-owned config and callback precedence.
 *   - `resolveToolsConfig` runtime tools behavior.
 *   - `resolveSectionEngineRuntimeState` (the parametrized engine-side
 *     orchestrator) propagates handlers and applies precedence
 *     identically.
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

async function loadEngineResolver() {
	return import("../../../src/runtime/core/engine-resolver.js");
}

describe("engine-resolver: resolveRuntime", () => {
	test("uses runtime.player config directly", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: {
				toolConfigStrictness: "off",
				playerType: "esm",
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

		expect((merged.player as any).loaderConfig.resourceRetryDelay).toBe(750);
		expect((merged.player as any).loaderOptions.moduleResolution).toBe(
			"import-map",
		);
		expect((merged as any).playerType).toBe("esm");
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
		const stubPlayerRuntime = mock(
			(args: { effectiveRuntime: Record<string, unknown> }) => ({
				tagFromCore: args.effectiveRuntime.playerType ?? "stub",
			}),
		);
		const state = resolveSectionEngineRuntimeState(
			{
				assessmentId: "a1",
				toolConfigStrictness: "error",
				onFrameworkError: handler,
				runtime: null,
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
				toolConfigStrictness: "error",
				onStageChange: handler,
				runtime: null,
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
				toolConfigStrictness: "error",
				onLoadingComplete: handler,
				runtime: null,
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
				toolConfigStrictness: "error",
				onStageChange: fromProp,
				runtime: { onStageChange: fromRuntime },
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
				toolConfigStrictness: "error",
				onLoadingComplete: fromProp,
				runtime: { onLoadingComplete: fromRuntime },
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
				toolConfigStrictness: "error",
				runtime: { playerType: "esm", env: { mode: "review" } },
			},
			{ resolvePlayerRuntime: stub },
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.playerType).toBe("esm");
		expect(calls[0]?.env).toEqual({ mode: "review" });
		expect((result.playerRuntime as any).ok).toBe(true);
	});
});

describe("engine-resolver: runtime-owned keys", () => {
	test("runtime-owned values are exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const coordinator = { id: "rt" };
		const accessibility = { fontSize: "lg" };
		const env = { mode: "review" };
		const merged = resolveRuntime({
			assessmentId: "from-prop",
			runtime: {
				assessmentId: "from-runtime",
				playerType: "esm",
				lazyInit: false,
				accessibility,
				coordinator,
				env,
				toolConfigStrictness: "off",
			},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});

		expect((merged as any).assessmentId).toBe("from-runtime");
		expect((merged as any).playerType).toBe("esm");
		expect((merged as any).lazyInit).toBe(false);
		expect((merged as any).accessibility).toBe(accessibility);
		expect((merged as any).coordinator).toBe(coordinator);
		expect((merged as any).env).toBe(env);
		expect((merged as any).toolConfigStrictness).toBe("off");
	});

	test("fills defaults when runtime omits runtime-owned values", async () => {
		const {
			DEFAULT_ENV,
			DEFAULT_LAZY_INIT,
			DEFAULT_PLAYER_TYPE,
			resolveRuntime,
		} = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: {},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});

		expect((merged as any).assessmentId).toBe("a1");
		expect((merged as any).playerType).toBe(DEFAULT_PLAYER_TYPE);
		expect((merged as any).lazyInit).toBe(DEFAULT_LAZY_INIT);
		expect((merged as any).accessibility).toBeNull();
		expect((merged as any).coordinator).toBeNull();
		expect((merged as any).env).toEqual(DEFAULT_ENV);
	});
});

/**
 * `createSectionController`, `isolation`, and `toolContextResolvers` are intentionally
 * **runtime-only** post the broad-architecture-review compat sweep —
 * neither has a top-level prop mirror on layout CEs, so the resolver
 * only honors them via `runtime.<key>`.
 */
describe("engine-resolver: createSectionController is runtime-only", () => {
	test("runtime.createSectionController is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const factory = () => ({ kind: "from-runtime" });
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: { createSectionController: factory },
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).createSectionController).toBe(factory);
	});

	test("createSectionController is undefined when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: {},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).createSectionController).toBeUndefined();
	});
});

describe("engine-resolver: toolContextResolvers is runtime-only", () => {
	test("runtime.toolContextResolvers is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const resolvers = { calculator: () => ({ visible: true }) };
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: { toolContextResolvers: resolvers },
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).toolContextResolvers).toBe(resolvers);
	});

	test("toolContextResolvers is undefined when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: {},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).toolContextResolvers).toBeUndefined();
	});
});

describe("engine-resolver: isolation is runtime-only", () => {
	test("runtime.isolation is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: { isolation: "force" },
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).isolation).toBe("force");
	});

	test("isolation falls back to DEFAULT_ISOLATION when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime, DEFAULT_ISOLATION } = await loadEngineResolver();
		const merged = resolveRuntime({
			assessmentId: "a1",
			runtime: {},
			effectiveToolsConfig: {},
			toolConfigStrictness: "error",
		});
		expect((merged as any).isolation).toBe(DEFAULT_ISOLATION);
	});
});

describe("engine-resolver: resolveToolsConfig", () => {
	test("returns runtime tools without validating tool ids", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
		const resolved = resolveToolsConfig({
			runtime: {
				toolConfigStrictness: "error",
				tools: {
					placement: {
						section: ["unknownTool"],
					},
				},
			},
		});
		expect(resolved.placement.section).toEqual(["unknownTool"]);
	});

	test("returns empty placement object when runtime is omitted", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
		const resolved = resolveToolsConfig({
			runtime: null,
		});
		expect(resolved).toEqual({ placement: {} });
	});

	test("accepts canonical provider key textToSpeech", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
		const resolved = resolveToolsConfig({
			runtime: {
				toolConfigStrictness: "error",
				tools: {
					providers: {
						textToSpeech: {
							enabled: true,
							backend: "browser",
							layoutMode: "left-aligned",
						},
					},
				},
			},
		});
		expect((resolved as any).providers.textToSpeech?.enabled).toBe(true);
		expect((resolved as any).providers.textToSpeech?.layoutMode).toBe(
			"left-aligned",
		);
	});
});
