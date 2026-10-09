/**
 * Toolkit-side resolver (`runtime/core/engine-resolver.ts`): runtime-owned
 * config, defaults, the `toolConfigStrictness` element input and
 * `resolveToolsConfig`. The section-player wrappers are covered in
 * section-player's `section-player-runtime.test.ts`.
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
			runtime: {
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
		});

		expect((merged.player as any).loaderConfig.resourceRetryDelay).toBe(750);
		expect((merged.player as any).loaderOptions.moduleResolution).toBe(
			"import-map",
		);
		expect(merged.playerType).toBe("esm");
	});

	test("takes toolConfigStrictness from the element input, defaulting to error", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		expect(
			resolveRuntime({
				runtime: {},
				effectiveToolsConfig: {},
				toolConfigStrictness: "off",
			}).toolConfigStrictness,
		).toBe("off");
		expect(
			resolveRuntime({ runtime: {}, effectiveToolsConfig: {} })
				.toolConfigStrictness,
		).toBe("error");
	});
});

describe("engine-resolver: resolveSectionEngineRuntimeState", () => {
	test("carries the runtime callbacks onto effectiveRuntime", async () => {
		const { resolveSectionEngineRuntimeState } = await loadEngineResolver();
		const onFrameworkError = () => {};
		const onStageChange = () => {};
		const onLoadingComplete = () => {};
		const stubPlayerRuntime = mock(() => ({}));
		const state = resolveSectionEngineRuntimeState(
			{
				toolConfigStrictness: "error",
				runtime: { onFrameworkError, onStageChange, onLoadingComplete },
			},
			{ resolvePlayerRuntime: stubPlayerRuntime },
		);
		expect(state.effectiveRuntime.onFrameworkError).toBe(onFrameworkError);
		expect(state.effectiveRuntime.onStageChange).toBe(onStageChange);
		expect(state.effectiveRuntime.onLoadingComplete).toBe(onLoadingComplete);
		expect(stubPlayerRuntime).toHaveBeenCalled();
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
			runtime: {
				assessmentId: "from-runtime",
				playerType: "esm",
				lazyInit: false,
				accessibility,
				coordinator,
				env,
			},
			effectiveToolsConfig: {},
		});

		expect((merged as any).assessmentId).toBe("from-runtime");
		expect((merged as any).playerType).toBe("esm");
		expect((merged as any).lazyInit).toBe(false);
		expect((merged as any).accessibility).toBe(accessibility);
		expect((merged as any).coordinator).toBe(coordinator);
		expect((merged as any).env).toBe(env);
	});

	test("fills defaults when runtime omits runtime-owned values", async () => {
		const {
			DEFAULT_ENV,
			DEFAULT_LAZY_INIT,
			DEFAULT_PLAYER_TYPE,
			resolveRuntime,
		} = await loadEngineResolver();
		const merged = resolveRuntime({
			runtime: {},
			effectiveToolsConfig: {},
		});

		expect((merged as any).assessmentId).toBeUndefined();
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
 * none has a top-level prop on layout CEs, so the resolver
 * only honors them via `runtime.<key>`.
 */
describe("engine-resolver: createSectionController is runtime-only", () => {
	test("runtime.createSectionController is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const factory = () => ({ kind: "from-runtime" });
		const merged = resolveRuntime({
			runtime: { createSectionController: factory },
			effectiveToolsConfig: {},
		});
		expect((merged as any).createSectionController).toBe(factory);
	});

	test("createSectionController is undefined when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			runtime: {},
			effectiveToolsConfig: {},
		});
		expect((merged as any).createSectionController).toBeUndefined();
	});
});

describe("engine-resolver: toolContextResolvers is runtime-only", () => {
	test("runtime.toolContextResolvers is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const resolvers = { calculator: () => ({ visible: true }) };
		const merged = resolveRuntime({
			runtime: { toolContextResolvers: resolvers },
			effectiveToolsConfig: {},
		});
		expect((merged as any).toolContextResolvers).toBe(resolvers);
	});

	test("toolContextResolvers is undefined when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			runtime: {},
			effectiveToolsConfig: {},
		});
		expect((merged as any).toolContextResolvers).toBeUndefined();
	});
});

describe("engine-resolver: isolation is runtime-only", () => {
	test("runtime.isolation is exposed on the effective runtime", async () => {
		const { resolveRuntime } = await loadEngineResolver();
		const merged = resolveRuntime({
			runtime: { isolation: "force" },
			effectiveToolsConfig: {},
		});
		expect((merged as any).isolation).toBe("force");
	});

	test("isolation falls back to DEFAULT_ISOLATION when runtime omits it (no top-level fallback)", async () => {
		const { resolveRuntime, DEFAULT_ISOLATION } = await loadEngineResolver();
		const merged = resolveRuntime({
			runtime: {},
			effectiveToolsConfig: {},
		});
		expect((merged as any).isolation).toBe(DEFAULT_ISOLATION);
	});
});

describe("engine-resolver: resolveToolsConfig", () => {
	test("returns runtime tools without validating tool ids", async () => {
		const { resolveToolsConfig } = await loadEngineResolver();
		const resolved = resolveToolsConfig({
			runtime: {
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

describe("engine-resolver: resolveSectionId", () => {
	test("takes the host's id, then the section's identifier, then one named after the assessment", async () => {
		const { resolveSectionId } = await loadEngineResolver();
		const section = { identifier: "from-section" };
		expect(
			resolveSectionId({ sectionId: "from-host", section, assessmentId: "a1" }),
		).toBe("from-host");
		expect(resolveSectionId({ sectionId: "", section, assessmentId: "a1" })).toBe(
			"from-section",
		);
		expect(resolveSectionId({ sectionId: "", section: {}, assessmentId: "a1" })).toBe(
			"section-a1",
		);
		expect(resolveSectionId({ section: null })).toBe("section-default");
	});
});
